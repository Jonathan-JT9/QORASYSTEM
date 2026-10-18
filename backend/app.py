"""QORA Flask API: CXR classification, Grad-CAM, Gemini, and history."""

from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from PIL import Image, UnidentifiedImageError

from gemini_service import interpret_prediction
from gradcam import generate_gradcam_data_url
from model_loader import N_QUBITS, load_model, pil_from_bytes, predict_image

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT.parent / ".env")
load_dotenv(ROOT / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s"
)
logger = logging.getLogger("qora")

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp", ".webp", ".tif", ".tiff"}
MAX_CONTENT_LENGTH = 16 * 1024 * 1024
MAX_HISTORY = 50

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5175"
]

CORS(
    app,
    resources={
        r"/api/*": {
            "origins": allowed_origins,
            "methods": ["GET", "POST", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"]
        }
    }
)

# Temporary history for local development.
# Production history should use authenticated database storage.
SESSION_HISTORY: list[dict] = []


@lru_cache(maxsize=1)
def get_bundle():
    checkpoint = os.getenv("CHECKPOINT_PATH", "checkpoints/best.pt")
    path = Path(checkpoint)

    if not path.is_absolute():
        path = ROOT / path

    device_preference = os.getenv("MODEL_DEVICE", "auto")
    return load_model(path, device_preference=device_preference)


@app.get("/api/health")
def health():
    checkpoint = os.getenv("CHECKPOINT_PATH", "checkpoints/best.pt")
    path = Path(checkpoint)

    if not path.is_absolute():
        path = ROOT / path

    try:
        bundle = get_bundle()
        return jsonify({
            "ok": True,
            "service": "QORA",
            "model": "HQCNN",
            "backbone": "ResNet-50",
            "n_qubits": bundle.model.n_qubits,
            "device": str(bundle.device),
            "threshold": bundle.threshold,
            "checkpoint_exists": path.exists(),
            "model_loaded": True
        }), 200

    except Exception:
        logger.exception("Model health check failed")
        return jsonify({
            "ok": False,
            "service": "QORA",
            "model_loaded": False,
            "checkpoint_exists": path.exists(),
            "error": "Model initialization failed."
        }), 503


@app.post("/api/predict")
def predict():
    if "image" not in request.files:
        return jsonify({"error": "Field 'image' is required."}), 400

    file = request.files["image"]

    if not file or not file.filename:
        return jsonify({"error": "No file selected."}), 400

    suffix = Path(file.filename).suffix.lower()

    if suffix not in ALLOWED_EXTENSIONS:
        return jsonify({
            "error": f"Unsupported file type: {suffix}"
        }), 400

    raw = file.read()

    if not raw:
        return jsonify({"error": "Empty file."}), 400

    try:
        image = pil_from_bytes(raw)
        image.load()

        if image.width < 32 or image.height < 32:
            return jsonify({
                "error": "Image resolution is too small."
            }), 400

    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        return jsonify({
            "error": "Invalid or corrupted image."
        }), 400

    try:
        bundle = get_bundle()
        result = predict_image(bundle, image)

        overlay = generate_gradcam_data_url(
            bundle,
            image,
            target_index=result["class_index"]
        )

    except Exception:
        logger.exception("QORA classification failed")
        return jsonify({
            "error": "Classification failed. Please try again."
        }), 500

    try:
        narrative = interpret_prediction(
            label=result["label"],
            probabilities=result["probabilities"],
            confidence=result["confidence"]
        )

    except Exception:
        logger.exception("Gemini interpretation failed")
        narrative = (
            "AI interpretation is temporarily unavailable. "
            "The classification result is still available. "
            "This result is not a definitive medical diagnosis."
        )

    payload = {
        "id": str(uuid.uuid4()),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "filename": Path(file.filename).name,
        "label": result["label"],
        "confidence": result["confidence"],
        "probabilities": result["probabilities"],
        "gradcam_overlay_b64": overlay,
        "interpretation": narrative,
        "model": {
            "name": "HQCNN",
            "backbone": "ResNet-50",
            "n_qubits": bundle.model.n_qubits,
            "threshold": bundle.threshold
        }
    }

    history_item = {
        key: value
        for key, value in payload.items()
        if key != "gradcam_overlay_b64"
    }

    SESSION_HISTORY.insert(0, history_item)
    SESSION_HISTORY[:] = SESSION_HISTORY[:MAX_HISTORY]

    logger.info(
        "Classification completed: label=%s confidence=%.4f",
        result["label"],
        result["confidence"]
    )

    return jsonify(payload), 200


@app.get("/api/history")
def history_list():
    return jsonify({"items": SESSION_HISTORY}), 200


@app.post("/api/history")
def history_create():
    body = request.get_json(silent=True)

    if not isinstance(body, dict):
        return jsonify({
            "error": "A valid JSON object is required."
        }), 400

    item = {
        "id": str(uuid.uuid4()),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "filename": body.get("filename"),
        "label": body.get("label"),
        "confidence": body.get("confidence"),
        "probabilities": body.get("probabilities"),
        "interpretation": body.get("interpretation"),
        "patient_code": body.get("patient_code")
    }

    SESSION_HISTORY.insert(0, item)
    SESSION_HISTORY[:] = SESSION_HISTORY[:MAX_HISTORY]

    return jsonify(item), 201


@app.errorhandler(413)
def file_too_large(_error):
    return jsonify({
        "error": "File is too large. Maximum size is 16 MB."
    }), 413


if __name__ == "__main__":
    host = os.getenv("FLASK_HOST", "127.0.0.1")
    port = int(os.getenv("FLASK_PORT", "8000"))
    debug = os.getenv("FLASK_DEBUG", "0") == "1"

    logger.info("Starting QORA backend at %s:%s", host, port)
    app.run(host=host, port=port, debug=debug)