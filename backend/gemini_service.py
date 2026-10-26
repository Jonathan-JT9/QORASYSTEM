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


def answer_chat_query(
    message: str,
    history: list[dict] | None = None,
    context: dict | None = None
) -> str:
    """Answer clinical follow-up questions from doctor strictly constrained to QORA, CXR, Grad-CAM, TB & Normal."""
    model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip() or "gemini-2.5-flash"
    context = context or {}

    label = context.get("label", "Tidak spesifik")
    confidence = float(context.get("confidence", 0.0))
    probs = context.get("probabilities") or {}
    tb_prob = float(probs.get("TB", 0.0))
    normal_prob = float(probs.get("Normal", 0.0))
    filename = context.get("filename", "Citra CXR Pasien")
    interpretation = context.get("interpretation", "Belum ada interpretasi.")

    gradcam_info = context.get("gradcam_analysis") or {}
    if isinstance(gradcam_info, dict):
        gradcam_summary = gradcam_info.get("summary") or "Visualisasi Grad-CAM menunjukkan area kontribusi fitur model."
        primary_zone = gradcam_info.get("primary_zone", "Lapang pandang toraks terkait")
        primary_max = float(gradcam_info.get("primary_max", 0.0))
    else:
        gradcam_summary = str(gradcam_info)
        primary_zone = "Lapang pandang toraks terkait"
        primary_max = 0.0

    system_instruction = (
        "Anda adalah Asisten Klinis Interaktif QORA (Quantum-Optimized Radiograph Analysis).\n"
        "Tugas Anda adalah mendampingi dokter dan tenaga medis dalam berdiskusi secara interaktif mengenai hasil "
        "analisis citra Chest X-Ray (CXR) saat ini, peta perhatian Grad-CAM, serta sistem QORA dan kondisi Tuberkulosis / Paru Normal.\n\n"
        "--- DATA HASIL PEMERIKSAAN PASIEN SAAT INI ---\n"
        f"- Nama Berkas: {filename}\n"
        f"- Hasil Klasifikasi: {label}\n"
        f"- Tingkat Keyakinan (Confidence): {confidence:.2%}\n"
        f"- Probabilitas Kelas: Tuberkulosis (TB): {tb_prob:.2%} | Normal: {normal_prob:.2%}\n"
        f"- Analisis Spasial Grad-CAM: {gradcam_summary}\n"
        f"- Zona Fokus Puncak Grad-CAM: {primary_zone} (Intensitas: {primary_max:.1%})\n"
        f"- Interpretasi Klinis 1-4 yang telah dihasilkan:\n{interpretation}\n\n"
        "--- ATURAN DAN BATASAN CAKUPAN KETAT (GUARDRAILS) ---\n"
        "1. CAKUPAN YANG DIPERBOLEHKAN (PERMITTED SCOPE):\n"
        "   Anda HANYA diperbolehkan menjawab pertanyaan yang berkaitan dengan:\n"
        "   a. Sistem QORA: Arsitektur Hybrid QCNN (ResNet-50 + 6-Qubit VQC PennyLane), threshold klasifikasi, cara kerja pipeline.\n"
        "   b. Hasil klasifikasi saat ini: Arti label prediksi, nilai confidence, skor probabilitas TB vs Normal.\n"
        "   c. Grad-CAM: Makna warna merah/kuning (aktivasi tinggi/kontribusi fitur terbesar terhadap prediksi) vs biru/dingin (aktivasi rendah), "
        "lokasi fokus atensi pada lapang paru pasien, dan batasan Explainable AI (Grad-CAM adalah atensi komputasi visual jaringan saraf, bukan visualisasi mikroskopis kuman atau batas lesi biologis mutlak).\n"
        "   d. Citra Thoraks (Chest X-Ray / CXR): Anatomi radiologis paru (lapang atas/apikal, tengah, bawah, corakan bronkovaskular, hilus, diafragma, sinus kostofrenikus).\n"
        "   e. Tuberkulosis (TBC / TB) dan Paru Normal: Patofisiologi Mycobacterium tuberculosis, tanda/gejala klinis TB, bentuk lesi CXR tipikal TB (infiltrat, kavitas, fibroinfiltrat, efusi), "
        "konfirmasi diagnostik standar (Tes Cepat Molekuler TCM/GeneXpert MTB/RIF, BTA sputum, kultur), tatalaksana klinis (panduan OAT lini pertama Kemenkes/WHO), serta temuan foto toraks normal.\n\n"
        "2. CAKUPAN YANG DILARANG (OUT-OF-SCOPE REFUSAL RULE):\n"
        "   Jika pengguna menanyakan hal APAPUN di luar topik di atas (seperti penyakit umum lain di luar TB/paru, resep makanan, pemrograman umum, politik, "
        "olahraga, percakapan umum tanpa kaitan dengan sistem/TB/CXR/Grad-CAM):\n"
        "   ANDA WAJIB MENOLAK SECARA SOPAN menggunakan kalimat berikut:\n"
        "   \"Maaf, saya tidak bisa membantu menjawab pertanyaan tersebut. Pertanyaan ini berada di luar ruang lingkup sistem QORA.\"\n"
        "   (Jika pengguna bertanya dalam bahasa Inggris, gunakan: \"I'm sorry, I can't help you with that. This inquiry is outside the scope of the QORA system.\")\n\n"
        "3. GAYA KOMUNIKASI:\n"
        "   - Berikan jawaban yang lugas, ilmiah, berbasis panduan medis, dan mudah dipahami klinisi.\n"
        "   - Gunakan format markdown yang rapi (bullet points, bold untuk kata kunci).\n"
        "   - Ingatkan bahwa QORA adalah alat bantu skrining dan keputusan klinis, bukan pengganti pemeriksaan klinis langsung dan konfirmasi mikrobiologis."
    )

    contents: list[types.Content] = []

    safe_history = (history or [])[-10:]
    for item in safe_history:
        role = item.get("role")
        text = (item.get("text") or item.get("content") or "").strip()
        if not text:
            continue
        gemini_role = "user" if role in ("user", "human") else "model"
        contents.append(
            types.Content(
                role=gemini_role,
                parts=[types.Part.from_text(text=text)]
            )
        )

    contents.append(
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=message.strip())]
        )
    )

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            logger.info("Gemini chat query started: model=%s attempt=%s", model_name, attempt)
            response = get_client().models.generate_content(
                model=model_name,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.2,
                    max_output_tokens=600,
                    thinking_config=types.ThinkingConfig(thinking_budget=0),
                    automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True)
                )
            )

            text = (response.text or "").strip()
            if not text:
                raise RuntimeError("Respons Gemini kosong.")
            return text

        except Exception as exc:
            logger.exception("Gemini chat query failed on attempt %s", attempt)
            if attempt == MAX_ATTEMPTS:
                raise
            time.sleep(RETRY_DELAYS[min(attempt - 1, len(RETRY_DELAYS) - 1)])

    raise RuntimeError("Gemini chat failed after maximum attempts.")