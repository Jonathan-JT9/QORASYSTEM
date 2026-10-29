"""QORA Chest X-Ray validation using CLIP zero-shot classification (Stage 2)."""
from __future__ import annotations

from functools import lru_cache
import logging
import time

import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

logger = logging.getLogger("qora.image_validator")

MODEL_NAME = "openai/clip-vit-base-patch32"

CATEGORIES = {
    "frontal_chest_xray": [
        "A human frontal PA chest X-ray radiograph showing both lungs and ribs.",
        "A human frontal AP chest X-ray radiograph.",
        "A frontal projection medical chest radiograph.",
    ],
    "lateral_chest_xray": [
        "A lateral chest X-ray radiograph viewed from the side.",
        "A side-view chest radiograph of the thorax.",
    ],
    "other_body_xray": [
        "An X-ray of another body part such as hand, knee, foot, leg, or arm.",
        "An X-ray of the skull, head, spine, or pelvis.",
        "A dental X-ray radiograph.",
    ],
    "other_modality": [
        "A CT scan cross-sectional image of the body.",
        "An MRI scan medical image.",
        "An ultrasound sonography medical image.",
    ],
    "portrait_photo": [
        "An ordinary photograph of a person, human face, portrait, or selfie.",
        "A photograph of a person.",
    ],
    "non_medical": [
        "A nonmedical image, illustration, food, animal, plant, building, or drawing.",
        "A screenshot, computer icon, digital logo, or document.",
    ],
}

CATEGORY_LABELS = {
    "frontal_chest_xray": "Chest X-Ray Frontal (PA/AP)",
    "lateral_chest_xray": "Chest X-Ray Lateral",
    "other_body_xray": "X-Ray bagian tubuh lainnya",
    "other_modality": "CT Scan, MRI, atau USG",
    "portrait_photo": "Foto manusia / potret",
    "non_medical": "Gambar nonmedis",
}

VALIDATION_MESSAGES = {
    "SUPPORTED_CHEST_XRAY": "Gambar berhasil divalidasi. Melanjutkan klasifikasi...",
    "NOT_CHEST_XRAY": "Gambar tidak sesuai. Silakan unggah citra Chest X-Ray manusia.",
    "LATERAL_PROJECTION": "Proyeksi citra tidak didukung. Silakan unggah Chest X-Ray tampak depan (PA/AP).",
    "COLORIZED_XRAY": "Format tampilan citra tidak didukung. Silakan unggah citra Chest X-Ray grayscale.",
    "POOR_QUALITY": "Kualitas citra tidak memadai. Silakan unggah gambar yang lebih jelas dan tidak terpotong.",
    "OTHER_BODY_OR_MODALITY": "Jenis citra tidak didukung. Sistem hanya menerima Chest X-Ray.",
    "OUT_OF_SCOPE": "Citra mungkin berada di luar cakupan klasifikasi Normal dan Tuberkulosis. Silakan gunakan citra yang sesuai dengan cakupan penelitian.",
    "UNCERTAIN": "Sistem belum dapat memastikan kesesuaian citra. Silakan unggah citra lain yang lebih jelas.",
    "SERVICE_ERROR": "Validasi gambar sedang tidak tersedia. Silakan coba kembali beberapa saat lagi.",
}

MIN_CHEST_SCORE = 0.45
MIN_MARGIN = 0.08


@lru_cache(maxsize=1)
def load_validator():
    logger.info("Loading Chest X-Ray validator: %s", MODEL_NAME)

    processor = CLIPProcessor.from_pretrained(
        MODEL_NAME,
        local_files_only=True,
        use_fast=False,
    )

    model = CLIPModel.from_pretrained(
        MODEL_NAME,
        local_files_only=True,
        use_safetensors=True,
    )

    model.eval()

    logger.info("Chest X-Ray validator loaded successfully")

    return processor, model


def validate_clip(image: Image.Image) -> dict:
    """Stage 2: Evaluate an uploaded image using local CLIP model against medical and non-medical categories."""
    start_time = time.monotonic()

    try:
        processor, model = load_validator()

        prompts = []
        prompt_categories = []

        for category, descriptions in CATEGORIES.items():
            for description in descriptions:
                prompts.append(description)
                prompt_categories.append(category)

        inputs = processor(
            text=prompts,
            images=image.convert("RGB"),
            return_tensors="pt",
            padding=True,
            truncation=True,
        )

        with torch.inference_mode():
            outputs = model(**inputs)
            logits = outputs.logits_per_image[0]
            probabilities = torch.softmax(logits, dim=0)

        category_scores = {}
        for category in CATEGORIES:
            indexes = [
                index
                for index, name in enumerate(prompt_categories)
                if name == category
            ]
            category_scores[category] = float(probabilities[indexes].sum().item())

        chest_score = category_scores["frontal_chest_xray"]

        other_scores = {
            category: score
            for category, score in category_scores.items()
            if category != "frontal_chest_xray"
        }

        strongest_other = max(other_scores, key=other_scores.get)
        strongest_other_score = other_scores[strongest_other]
        margin = chest_score - strongest_other_score
        duration = round(time.monotonic() - start_time, 3)

        # Decision logic
        if strongest_other_score > chest_score:
            # Another category clearly scored higher
            if strongest_other == "lateral_chest_xray":
                decision = "reject"
                reason_code = "LATERAL_PROJECTION"
            elif strongest_other in ("other_body_xray", "other_modality"):
                decision = "reject"
                reason_code = "OTHER_BODY_OR_MODALITY"
            else:
                decision = "reject"
                reason_code = "NOT_CHEST_XRAY"
        elif chest_score >= MIN_CHEST_SCORE and margin >= MIN_MARGIN:
            decision = "pass"
            reason_code = "SUPPORTED_CHEST_XRAY"
        else:
            # Frontal is highest but low confidence or margin
            decision = "uncertain"
            reason_code = "UNCERTAIN"

        accepted = (decision == "pass")
        message = VALIDATION_MESSAGES.get(reason_code, VALIDATION_MESSAGES["UNCERTAIN"])

        detected_category = "frontal_chest_xray" if accepted else strongest_other

        result = {
            "accepted": accepted,
            "stage": "clip",
            "decision": decision,
            "reason_code": reason_code,
            "message": message,
            "chest_score": round(chest_score, 4),
            "margin": round(margin, 4),
            "detected_category": detected_category,
            "detected_label": CATEGORY_LABELS.get(detected_category, detected_category),
            "category_scores": {
                k: round(v, 4) for k, v in category_scores.items()
            },
            "duration": duration,
        }

        logger.info(
            "CLIP validation completed: accepted=%s decision=%s chest_score=%.4f margin=%.4f strongest_other=%s (%.2fs)",
            accepted,
            decision,
            chest_score,
            margin,
            strongest_other,
            duration,
        )

        return result

    except Exception as exc:
        duration = round(time.monotonic() - start_time, 3)
        logger.exception("CLIP validation failed due to model/runtime error: %s", exc)
        return {
            "accepted": False,
            "stage": "clip",
            "decision": "error",
            "reason_code": "SERVICE_ERROR",
            "message": VALIDATION_MESSAGES["SERVICE_ERROR"],
            "error": str(exc),
            "duration": duration,
        }


def validate_chest_xray(image: Image.Image) -> dict:
    """Legacy compatibility wrapper around validate_clip."""
    return validate_clip(image)