"""Gemini AI interpretation for QORA."""
from __future__ import annotations
import json
import logging
import os
import re
import time
from functools import lru_cache
from PIL import Image
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


VALIDATION_MESSAGES = {
    "SUPPORTED_CHEST_XRAY": "Gambar berhasil divalidasi. Melanjutkan klasifikasi...",
    "NOT_CHEST_XRAY": "Gambar tidak sesuai. Silakan unggah citra Chest X-Ray yang sesuai.",
    "LATERAL_PROJECTION": "Proyeksi citra tidak didukung. Silakan unggah Chest X-Ray tampak depan (PA/AP).",
    "COLORIZED_XRAY": "Format tampilan citra tidak didukung. Silakan unggah citra Chest X-Ray grayscale.",
    "POOR_QUALITY": "Kualitas citra tidak memadai. Silakan unggah gambar yang lebih jelas dan tidak terpotong.",
    "OTHER_BODY_OR_MODALITY": "Jenis citra tidak didukung. Sistem hanya menerima Chest X-Ray.",
    "OUT_OF_SCOPE": "Citra mungkin berada di luar cakupan klasifikasi Normal dan Tuberkulosis. Silakan gunakan citra yang sesuai dengan cakupan penelitian.",
    "UNCERTAIN": "Sistem belum dapat memastikan kesesuaian citra. Silakan unggah citra lain yang lebih jelas.",
    "SERVICE_ERROR": "Validasi gambar sedang tidak tersedia. Silakan coba kembali beberapa saat lagi.",
}

GEMINI_VALIDATION_PROMPT = """You are a strict, specialized medical image validator for QORA (Quantum-Optimized Radiograph Analysis).
QORA's classification pipeline strictly evaluates frontal chest radiographs for binary classification: Normal vs Tuberculosis (TB).

Evaluate the provided image against all the following criteria:
1. Is it a genuine human chest X-ray (CXR)? Reject selfies, portraits, photos, non-medical images, CT, MRI, ultrasound, or X-rays of other body parts (hand, knee, dental, skull, pelvis, spine).
2. Projection: Is it a frontal projection (PA or AP)? Lateral or oblique views must be rejected.
3. Appearance: Is it a conventional grayscale radiograph (black, white, shades of gray)? Artificially colorized or false-color images (red, green, blue tones) must be rejected.
4. Image quality: Are chest and lung fields sufficiently visible and diagnostic (not severely blurry, corrupted, or severely cropped)?
5. Scope assessment: Does the image align with the Normal vs Tuberculosis scope? If it clearly exhibits prominent other pulmonary pathologies outside this binary scope (e.g., massive pleural effusion, pneumothorax, pulmonary edema, large lung mass, or severe COVID-19/ARDS), flag it as 'possible_other_disease'.
6. If the image's suitability or findings cannot be definitively established, return decision='uncertain'.

Allowed values:
- projection: "PA", "AP", "lateral", "other", "unknown"
- image_quality: "acceptable", "poor", "uncertain"
- scope_assessment: "in_scope", "possible_other_disease", "uncertain"
- decision: "pass", "reject", "uncertain"
- reason_code:
  "SUPPORTED_CHEST_XRAY" (when passing)
  "NOT_CHEST_XRAY" (non-medical, portrait, photo, selfie, document, screenshot)
  "OTHER_BODY_OR_MODALITY" (CT, MRI, ultrasound, or non-chest X-ray like skull, hand, knee)
  "LATERAL_PROJECTION" (lateral or side view)
  "COLORIZED_XRAY" (false-color or RGB colorized X-ray)
  "POOR_QUALITY" (blurry, corrupted, or severely cropped)
  "OUT_OF_SCOPE" (findings outside Normal vs TB scope)
  "UNCERTAIN" (suitability or findings cannot be confirmed)

Return ONLY a valid JSON object matching this schema:
{
  "is_chest_xray": boolean,
  "body_part": string,
  "projection": "PA" | "AP" | "lateral" | "other" | "unknown",
  "is_grayscale": boolean,
  "image_quality": "acceptable" | "poor" | "uncertain",
  "scope_assessment": "in_scope" | "possible_other_disease" | "uncertain",
  "decision": "pass" | "reject" | "uncertain",
  "reason_code": string,
  "reason": string
}"""


def validate_image_with_gemini(image: Image.Image) -> dict:
    """Stage 1: Evaluate an uploaded image using Gemini Vision for QORA CXR criteria."""
    model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip() or "gemini-2.5-flash"

    # Prepare image for Gemini (standard RGB, resize if excessively large)
    prep_img = image.convert("RGB")
    max_dim = 1536
    if max(prep_img.size) > max_dim:
        scale = max_dim / max(prep_img.size)
        new_size = (int(prep_img.width * scale), int(prep_img.height * scale))
        prep_img = prep_img.resize(new_size, Image.Resampling.LANCZOS)

    start_time = time.monotonic()
    raw_response = None

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            logger.info("Gemini Vision validation started: model=%s attempt=%s/%s", model_name, attempt, MAX_ATTEMPTS)
            client = get_client()
            response = client.models.generate_content(
                model=model_name,
                contents=[GEMINI_VALIDATION_PROMPT, prep_img],
                config=types.GenerateContentConfig(
                    temperature=0.0,
                    response_mime_type="application/json",
                    max_output_tokens=500,
                    thinking_config=types.ThinkingConfig(thinking_budget=0),
                    automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True)
                )
            )

            raw_text = (response.text or "").strip()
            if not raw_text:
                raise ValueError("Respons Gemini kosong.")

            # Clean potential Markdown code fences
            clean_json = re.sub(r"^```(?:json)?\s*", "", raw_text, flags=re.IGNORECASE)
            clean_json = re.sub(r"\s*```$", "", clean_json.strip())

            raw_response = json.loads(clean_json)
            break

        except Exception as exc:
            duration = time.monotonic() - start_time
            logger.warning("Gemini Vision attempt %s failed after %.2fs: %s", attempt, duration, exc)
            if attempt == MAX_ATTEMPTS:
                logger.exception("Gemini Vision validation failed all attempts.")
                return {
                    "accepted": False,
                    "stage": "gemini",
                    "decision": "error",
                    "reason_code": "SERVICE_ERROR",
                    "message": VALIDATION_MESSAGES["SERVICE_ERROR"],
                    "error": str(exc),
                    "duration": round(duration, 3)
                }
            time.sleep(RETRY_DELAYS[min(attempt - 1, len(RETRY_DELAYS) - 1)])

    duration = round(time.monotonic() - start_time, 3)

    if not isinstance(raw_response, dict):
        return {
            "accepted": False,
            "stage": "gemini",
            "decision": "error",
            "reason_code": "SERVICE_ERROR",
            "message": VALIDATION_MESSAGES["SERVICE_ERROR"],
            "duration": duration
        }

    # Extract and normalize values
    is_chest_xray = bool(raw_response.get("is_chest_xray", False))
    body_part = str(raw_response.get("body_part", "unknown")).lower().strip()

    raw_proj = str(raw_response.get("projection", "unknown")).strip()
    norm_proj = raw_proj.upper()
    if norm_proj in ("PA", "AP"):
        projection = norm_proj
    elif "LAT" in norm_proj:
        projection = "lateral"
    elif norm_proj in ("OTHER", "UNKNOWN"):
        projection = norm_proj.lower()
    else:
        projection = "unknown"

    is_grayscale = bool(raw_response.get("is_grayscale", True))

    raw_quality = str(raw_response.get("image_quality", "uncertain")).lower().strip()
    image_quality = raw_quality if raw_quality in ("acceptable", "poor", "uncertain") else "uncertain"

    raw_scope = str(raw_response.get("scope_assessment", "uncertain")).lower().strip()
    scope_assessment = raw_scope if raw_scope in ("in_scope", "possible_other_disease", "uncertain") else "uncertain"

    raw_decision = str(raw_response.get("decision", "uncertain")).lower().strip()
    decision = raw_decision if raw_decision in ("pass", "reject", "uncertain") else "uncertain"

    reason_code = str(raw_response.get("reason_code", "")).upper().strip()
    reason = str(raw_response.get("reason", "")).strip()

    # Server-side consistency enforcement
    non_chest_keywords = ("knee", "hand", "foot", "skull", "dental", "pelvis", "spine", "leg", "arm", "head", "ct", "mri", "ultrasound", "sonogram")
    is_other_modality_or_body = any(kw in body_part for kw in non_chest_keywords) or body_part in ("brain", "abdomen")

    if not is_chest_xray:
        decision = "reject"
        reason_code = "OTHER_BODY_OR_MODALITY" if is_other_modality_or_body else "NOT_CHEST_XRAY"
    elif body_part not in ("chest", "thorax", "toraks") and is_other_modality_or_body:
        decision = "reject"
        reason_code = "OTHER_BODY_OR_MODALITY"
    elif projection == "lateral":
        decision = "reject"
        reason_code = "LATERAL_PROJECTION"
    elif not is_grayscale:
        decision = "reject"
        reason_code = "COLORIZED_XRAY"
    elif image_quality == "poor":
        decision = "reject"
        reason_code = "POOR_QUALITY"
    elif scope_assessment == "possible_other_disease":
        decision = "reject"
        reason_code = "OUT_OF_SCOPE"
    elif decision == "uncertain" or projection == "unknown" or image_quality == "uncertain" or scope_assessment == "uncertain":
        decision = "uncertain"
        reason_code = "UNCERTAIN"
    elif projection not in ("PA", "AP"):
        decision = "reject"
        reason_code = "LATERAL_PROJECTION" if "lat" in projection else "NOT_CHEST_XRAY"
    elif decision == "pass":
        if image_quality != "acceptable" or scope_assessment != "in_scope" or projection not in ("PA", "AP"):
            decision = "uncertain"
            reason_code = "UNCERTAIN"
        else:
            reason_code = "SUPPORTED_CHEST_XRAY"
    elif decision == "reject" and not reason_code:
        reason_code = "NOT_CHEST_XRAY"

    accepted = (decision == "pass")
    message = VALIDATION_MESSAGES.get(reason_code, VALIDATION_MESSAGES["UNCERTAIN"])

    result = {
        "accepted": accepted,
        "stage": "gemini",
        "decision": decision,
        "reason_code": reason_code,
        "message": message,
        "is_chest_xray": is_chest_xray,
        "body_part": body_part,
        "projection": projection,
        "is_grayscale": is_grayscale,
        "image_quality": image_quality,
        "scope_assessment": scope_assessment,
        "reason": reason,
        "duration": duration
    }

    logger.info("Gemini Vision validation completed: accepted=%s decision=%s reason_code=%s duration=%.2fs",
                accepted, decision, reason_code, duration)

    return result