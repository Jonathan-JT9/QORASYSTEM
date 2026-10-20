"""QORA Chest X-Ray validation using CLIP zero-shot classification."""

from functools import lru_cache
import logging

import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

logger = logging.getLogger("qora.image_validator")

MODEL_NAME = "openai/clip-vit-base-patch32"

CATEGORIES = {
    "chest_xray": [
        "A frontal chest X-ray radiograph showing both lungs, ribs and heart.",
        "A medical chest radiograph showing the lungs and rib cage.",
        "A posterior anterior chest X-ray image.",
        "An anterior posterior chest X-ray image.",
    ],
    "skull_xray": [
        "A skull X-ray radiograph showing the bones of the head.",
        "A lateral X-ray image of a human skull.",
        "A medical radiograph showing the human head and skull.",
    ],
    "brain_scan": [
        "A CT scan image of the human brain.",
        "An MRI scan image showing the human brain.",
        "A cross-sectional medical image of the head.",
    ],
    "other_xray": [
        "An X-ray image of a human hand.",
        "An X-ray image of a human leg.",
        "An X-ray image of the human spine.",
        "An X-ray image of the human pelvis.",
    ],
    "non_medical": [
        "A photograph of a person's face.",
        "A photograph of a cat or dog.",
        "A natural landscape photograph.",
        "A screenshot of text or a computer screen.",
    ],
}

CATEGORY_LABELS = {
    "chest_xray": "Chest X-Ray",
    "skull_xray": "Skull X-Ray",
    "brain_scan": "CT Scan atau MRI kepala",
    "other_xray": "X-Ray bagian tubuh lainnya",
    "non_medical": "Gambar nonmedis",
}

MIN_CHEST_SCORE = 0.45
MIN_MARGIN = 0.08


@lru_cache(maxsize=1)
def load_validator():
    logger.info("Loading Chest X-Ray validator: %s", MODEL_NAME)

    processor = CLIPProcessor.from_pretrained(
        MODEL_NAME,
        local_files_only=True,
        use_fast=False
    )

    model = CLIPModel.from_pretrained(
        MODEL_NAME,
        local_files_only=True,
        use_safetensors=True
    )

    model.eval()

    logger.info("Chest X-Ray validator loaded successfully")

    return processor, model


def validate_chest_xray(image: Image.Image) -> dict:
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

        category_scores[category] = float(
            probabilities[indexes].sum().item()
        )

    chest_score = category_scores["chest_xray"]

    other_scores = {
        category: score
        for category, score in category_scores.items()
        if category != "chest_xray"
    }

    strongest_other = max(
        other_scores,
        key=other_scores.get
    )

    strongest_other_score = other_scores[strongest_other]

    margin = chest_score - strongest_other_score

    accepted = (
        chest_score >= MIN_CHEST_SCORE
        and margin >= MIN_MARGIN
    )

    logger.info(
        "CXR validation: accepted=%s chest_score=%.4f margin=%.4f strongest_other=%s",
        accepted,
        chest_score,
        margin,
        strongest_other
    )

    return {
        "accepted": accepted,
        "chest_score": round(chest_score, 4),
        "margin": round(margin, 4),
        "detected_category": (
            "chest_xray" if accepted else strongest_other
        ),
        "detected_label": (
            "Chest X-Ray"
            if accepted
            else CATEGORY_LABELS[strongest_other]
        ),
        "category_scores": {
            category: round(score, 4)
            for category, score in category_scores.items()
        }
    }