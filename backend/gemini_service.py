"""Gemini AI interpretation for QORA Hybrid QCNN classification."""

from __future__ import annotations

import logging
import os

from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

SYSTEM_CONTEXT = """
Anda adalah asisten pendukung keputusan klinis pada sistem QORA.

QORA menggunakan Hybrid Quantum Convolutional Neural Network (HQCNN)
untuk mengklasifikasikan citra Chest X-Ray menjadi Normal atau Tuberkulosis (TB).

Tugas Anda adalah membantu dokter memahami hasil klasifikasi model.

ATURAN:
1. Gunakan bahasa Indonesia yang profesional, jelas, dan mudah dipahami.
2. Jangan menyatakan bahwa pasien pasti menderita atau bebas dari TB.
3. Jangan menganggap confidence model sebagai kepastian diagnosis.
4. Jangan mengarang kelainan radiologis atau lokasi lesi.
5. Jangan mengklaim telah memeriksa gambar Chest X-Ray secara langsung.
6. Jelaskan bahwa Grad-CAM merupakan visualisasi kontribusi fitur model,
   bukan bukti lokasi penyakit.
7. Sarankan evaluasi klinis dan pemeriksaan konfirmasi sesuai pedoman.
8. Selalu sertakan disclaimer bahwa QORA bukan alat diagnosis definitif.
"""

def interpret_prediction(
    label: str,
    probabilities: dict[str, float],
    confidence: float,
) -> str:

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    model_name = os.getenv(
        "GEMINI_MODEL",
        "gemini-3.8-flash"
    ).strip() or "gemini-3.8-flash"

    tb = float(probabilities.get("TB", 0.0))
    normal = float(probabilities.get("Normal", 0.0))

    prompt = f"""
{SYSTEM_CONTEXT}

HASIL KLASIFIKASI QORA:

Model: Hybrid QCNN
Backbone: ResNet-50
Quantum Circuit: 6 qubits
Prediksi Model: {label}
Confidence Kelas Prediksi: {confidence:.2%}
Probabilitas Normal: {normal:.2%}
Probabilitas TB: {tb:.2%}

Grad-CAM:
Sistem menghasilkan visualisasi Grad-CAM untuk menunjukkan
area citra yang berkontribusi terhadap keputusan model.

Catatan:
Anda hanya menerima hasil numerik klasifikasi.
Anda tidak menerima gambar Chest X-Ray maupun peta Grad-CAM.

INSTRUKSI:

Buat interpretasi klinis pendukung keputusan dengan struktur:

1. Ringkasan Hasil Klasifikasi
Jelaskan prediksi model dan probabilitasnya.

2. Interpretasi Hasil
Jelaskan makna hasil klasifikasi secara hati-hati.
Jangan membuat diagnosis definitif.

3. Rekomendasi Tindak Lanjut
Berikan rekomendasi evaluasi klinis dan pemeriksaan konfirmasi
yang relevan untuk dokter.

4. Disclaimer
Tegaskan bahwa hasil QORA merupakan alat bantu skrining
dan tidak menggantikan penilaian tenaga medis profesional.

Gunakan maksimal 200 kata.
"""

    if not api_key:
        logger.warning("GEMINI_API_KEY not configured.")
        return _fallback_text(label, tb, normal, confidence)

    try:
        client = genai.Client(api_key=api_key)

        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.2,
                max_output_tokens=4096,
                thinking_config=types.ThinkingConfig(
                    thinking_budget=0
                )
            )
        )

        text = (response.text or "").strip()

        finish_reason = None

        if response.candidates:
            finish_reason = response.candidates[0].finish_reason

        logger.info("Gemini finish reason: %s", finish_reason)

        if not text:
            logger.warning("Gemini returned an empty response.")
            return _fallback_text(label, tb, normal, confidence)

        if finish_reason != types.FinishReason.STOP:
            logger.warning(
                "Gemini response may be incomplete. Finish reason: %s",
                finish_reason
            )
            return _fallback_text(label, tb, normal, confidence)

        logger.info("Gemini interpretation generated successfully.")
        return text

    except Exception:
        logger.exception("Gemini API request failed.")
        return _fallback_text(label, tb, normal, confidence)


def _fallback_text(
    label: str,
    tb: float,
    normal: float,
    confidence: float
) -> str:

    return (
        "1. Ringkasan Hasil Klasifikasi\n"
        f"Model QORA memprediksi kelas {label} dengan confidence "
        f"{confidence:.2%}. Probabilitas TB sebesar {tb:.2%} "
        f"dan Normal sebesar {normal:.2%}.\n\n"

        "2. Interpretasi Hasil\n"
        "Hasil klasifikasi menunjukkan kecenderungan prediksi model "
        "berdasarkan citra Chest X-Ray yang diberikan. "
        "Hasil ini tidak dapat digunakan sebagai diagnosis definitif.\n\n"

        "3. Rekomendasi Tindak Lanjut\n"
        "Dokter disarankan melakukan evaluasi klinis, "
        "pembacaan radiologis, serta pemeriksaan konfirmasi "
        "sesuai indikasi dan pedoman penanganan tuberkulosis.\n\n"

        "4. Disclaimer\n"
        "QORA merupakan sistem pendukung skrining berbasis AI "
        "dan tidak menggantikan keputusan klinis dokter.\n\n"

        "Catatan: Interpretasi ini menggunakan templat cadangan "
        "karena layanan Gemini AI tidak tersedia."
    )