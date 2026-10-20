"""Gemini AI interpretation for QORA."""
from __future__ import annotations
import logging
import os
import time
from functools import lru_cache
from google import genai
from google.genai import types

logger=logging.getLogger(__name__)

MAX_ATTEMPTS=3
RETRY_DELAYS=(2,5)

@lru_cache(maxsize=1)
def get_client():
    key=os.getenv("GEMINI_API_KEY","").strip()
    if not key:
        raise RuntimeError("GEMINI_API_KEY belum tersedia.")
    return genai.Client(api_key=key)

def interpret_prediction(label:str,probabilities:dict[str,float],confidence:float)->str:
    model_name=os.getenv("GEMINI_MODEL","gemini-2.5-flash").strip() or "gemini-2.5-flash"
    tb=float(probabilities.get("TB",0))
    normal=float(probabilities.get("Normal",0))

    prompt=(
        "Anda adalah asisten pendukung keputusan klinis QORA. "
        "QORA memakai Hybrid QCNN ResNet-50 dan sirkuit kuantum 6-qubit untuk klasifikasi Chest X-Ray Normal/TB. "
        "Anda hanya menerima angka hasil model, bukan gambar. "
        "Jangan mengarang temuan radiologi atau lokasi lesi. "
        "Confidence bukan kepastian diagnosis. "
        "Grad-CAM hanya menunjukkan kontribusi fitur, bukan lokasi penyakit.\n\n"
        f"Prediksi: {label}\nConfidence: {confidence:.2%}\n"
        f"TB: {tb:.2%}\nNormal: {normal:.2%}\n\n"
        "Tulis dalam bahasa Indonesia profesional, maksimal 120 kata. "
        "WAJIB gunakan format berikut secara persis: "
        "judul dicetak tebal dengan tanda **, isi pada paragraf baru, "
        "dan beri satu baris kosong antarbagian.\n\n"
        "**1. Ringkasan Hasil Klasifikasi**\n\n"
        "[Jelaskan hasil dan skor model]\n\n"
        "**2. Interpretasi Hasil**\n\n"
        "[Jelaskan arti prediksi tanpa diagnosis definitif]\n\n"
        "**3. Rekomendasi Tindak Lanjut**\n\n"
        "[Sarankan evaluasi klinis, pembacaan radiologi, dan pemeriksaan konfirmasi sesuai indikasi]\n\n"
        "**4. Disclaimer**\n\n"
        "[Tegaskan QORA hanya alat bantu skrining dan tidak menggantikan dokter]\n\n"
        "Jangan menambahkan judul lain atau catatan fallback."
    )

    start=time.monotonic()

    for attempt in range(1,MAX_ATTEMPTS+1):
        logger.info(
            "Gemini request started: model=%s attempt=%s/%s",
            model_name,attempt,MAX_ATTEMPTS
        )

        try:
            response=get_client().models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.1,
                    max_output_tokens=350,
                    thinking_config=types.ThinkingConfig(
                        thinking_budget=0
                    ),
                    automatic_function_calling=types.AutomaticFunctionCallingConfig(
                        disable=True
                    )
                )
            )

            text=(response.text or "").strip()
            reason=response.candidates[0].finish_reason if response.candidates else None

            if not text or reason!=types.FinishReason.STOP:
                raise RuntimeError(
                    f"Respons Gemini kosong atau tidak lengkap: {reason}"
                )

            logger.info(
                "Gemini response completed in %.2f seconds",
                time.monotonic()-start
            )

            return text

        except Exception as exc:
            status_code=getattr(exc,"status_code",None)
            code=getattr(exc,"code",None)
            error_text=str(exc).lower()

            temporary_error=(
                status_code in (500,502,503,504)
                or code in (500,502,503,504)
                or "503 unavailable" in error_text
                or "high demand" in error_text
            )

            if not temporary_error or attempt==MAX_ATTEMPTS:
                logger.exception(
                    "Gemini request failed after %.2f seconds",
                    time.monotonic()-start
                )
                raise

            delay=RETRY_DELAYS[attempt-1]

            logger.warning(
                "Gemini temporarily unavailable. Retrying in %s seconds...",
                delay
            )

            time.sleep(delay)

    raise RuntimeError("Gemini interpretation failed.")