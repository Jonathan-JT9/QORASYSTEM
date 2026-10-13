"""Gemini 2.5 Flash clinical narrative from HQCNN probabilities."""

from __future__ import annotations

import logging
import os

from google import genai

logger = logging.getLogger(__name__)

SYSTEM_CONTEXT = (
    "You are a clinical decision-support assistant for chest radiograph screening. "
    "You do not diagnose. You explain model outputs for licensed clinicians. "
    "Write in clear professional Indonesian unless the user data is in English. "
    "Always include a short disclaimer that this is not a medical diagnosis."
)


def interpret_prediction(
    label: str,
    probabilities: dict[str, float],
    confidence: float,
) -> str:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip() or "gemini-2.5-flash"

    tb = probabilities.get("TB", 0.0)
    normal = probabilities.get("Normal", 0.0)
    prompt = (
        f"{SYSTEM_CONTEXT}\n\n"
        "Model: QORA HQCNN (CNN + 6-qubit VQC) for TB vs Normal CXR screening.\n"
        f"Predicted class: {label}\n"
        f"Confidence (argmax): {confidence:.4f}\n"
        f"P(Normal)={normal:.4f}, P(TB)={tb:.4f}\n"
        "A Grad-CAM overlay was generated on the last convolutional block of the CNN backbone "
        "to highlight regions that most influenced the score.\n\n"
        "Write 3 short sections:\n"
        "1) Ringkasan temuan model\n"
        "2) Implikasi klinis yang mungkin (hati-hati, tidak definitif)\n"
        "3) Saran langkah berikutnya untuk klinisi (konfirmasi radiologis/laboratorium)\n"
        "Keep the total under 220 words. Do not invent lesions that were not evidenced by the scores."
    )

    if not api_key:
        logger.warning("GEMINI_API_KEY is not set; returning fallback interpretation.")
        return _fallback_text(label, tb, normal, confidence)

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(model=model_name, contents=prompt)
        text = (response.text or "").strip()
        if not text:
            return _fallback_text(label, tb, normal, confidence)
        return text
    except Exception:
        logger.exception("Gemini interpretation failed")
        return _fallback_text(label, tb, normal, confidence)


def _fallback_text(label: str, tb: float, normal: float, confidence: float) -> str:
    return (
        f"Ringkasan: model HQCNN memprediksi kelas {label} dengan kepercayaan {confidence:.1%}. "
        f"Probabilitas TB {tb:.1%} dan Normal {normal:.1%}. "
        "Peta Grad-CAM menandai area pada CXR yang paling berkontribusi pada skor tersebut.\n\n"
        "Implikasi: hasil ini adalah skrining otomatis, bukan diagnosis. "
        "Temuan harus dikorelasikan dengan gejala, riwayat kontak, dan pemeriksaan penunjang.\n\n"
        "Saran: minta pembacaan radiologis formal dan ikuti pedoman nasional TB. "
        "Kunci Gemini belum dikonfigurasi atau pemanggilan API gagal — narasi ini adalah templat cadangan.\n\n"
        "Disclaimer: QORA bukan perangkat medis tersertifikasi."
    )
