"""QORA Flask API: CXR prediction, Grad-CAM, Gemini interpretation, session history."""

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

from gemini_service import interpret_prediction
from gradcam import generate_gradcam_data_url
from model_loader import N_QUBITS, load_model, pil_from_bytes, predict_image

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT.parent / ".env")
load_dotenv(ROOT / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("qora")

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp", ".webp", ".tif", ".tiff"}
MAX_CONTENT_LENGTH = 16 * 1024 * 1024

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH
CORS(
    app,
    resources={r"/api/*": {"origins": os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")}},
)

# In-memory history for local demos. Production persistence is Supabase.
SESSION_HISTORY: list[dict] = []


@lru_cache(maxsize=1)
def get_bundle():
    checkpoint = os.getenv("CHECKPOINT_PATH", "checkpoints/best.pt")
    path = Path(checkpoint)
    if not path.is_absolute():
        path = ROOT / path
    device_pref = os.getenv("MODEL_DEVICE", "auto")
    return load_model(path, device_preference=device_pref)


@app.get("/api/health")
def health():
    checkpoint = os.getenv("CHECKPOINT_PATH", "checkpoints/best.pt")
    path = Path(checkpoint)
    if not path.is_absolute():
        path = ROOT / path
    try:
        bundle = get_bundle()
        loaded = True
        device = str(bundle.device)
    except Exception as exc:
        logger.exception("Model load failed")
        loaded = False
        device = None
        return jsonify({"ok": False, "error": str(exc), "checkpoint_exists": path.exists()}), 500
    return jsonify(
        {
            "ok": True,
            "service": "QORA",
            "model": "HQCNN",
            "n_qubits": N_QUBITS,
            "device": device,
            "checkpoint_exists": path.exists(),
            "model_loaded": loaded,
        }
    )


@app.post("/api/predict")
def predict():
    if "image" not in request.files:
        return jsonify({"error": "Field 'image' is required."}), 400
    file = request.files["image"]
    if not file or not file.filename:
        return jsonify({"error": "No file selected."}), 400
    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        return jsonify({"error": f"Unsupported file type: {suffix}"}), 400

    raw = file.read()
    if not raw:
        return jsonify({"error": "Empty file."}), 400

    try:
        bundle = get_bundle()
        image = pil_from_bytes(raw)
        result = predict_image(bundle, image)
        overlay = generate_gradcam_data_url(bundle, image, target_index=result["class_index"])
        narrative = interpret_prediction(
            label=result["label"],
            probabilities=result["probabilities"],
            confidence=result["confidence"],
        )
    except Exception as exc:
        logger.exception("Prediction pipeline failed")
        return jsonify({"error": "Inference failed", "detail": str(exc)}), 500

    payload = {
        "id": str(uuid.uuid4()),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "filename": file.filename,
        "label": result["label"],
        "confidence": result["confidence"],
        "probabilities": result["probabilities"],
        "gradcam_overlay_b64": overlay,
        "interpretation": narrative,
        "model": {"name": "HQCNN", "n_qubits": N_QUBITS},
    }
    SESSION_HISTORY.insert(0, {k: v for k, v in payload.items() if k != "gradcam_overlay_b64"})
    SESSION_HISTORY[:] = SESSION_HISTORY[:50]
    return jsonify(payload)


@app.get("/api/history")
def history_list():
    return jsonify({"items": SESSION_HISTORY})


@app.post("/api/history")
def history_create():
    body = request.get_json(silent=True) or {}
    item = {
        "id": body.get("id") or str(uuid.uuid4()),
        "created_at": body.get("created_at") or datetime.now(timezone.utc).isoformat(),
        "filename": body.get("filename"),
        "label": body.get("label"),
        "confidence": body.get("confidence"),
        "probabilities": body.get("probabilities"),
        "interpretation": body.get("interpretation"),
        "patient_code": body.get("patient_code"),
    }
    SESSION_HISTORY.insert(0, item)
    SESSION_HISTORY[:] = SESSION_HISTORY[:50]
    return jsonify(item), 201


if __name__ == "__main__":
    host = os.getenv("FLASK_HOST", "0.0.0.0")
    port = int(os.getenv("FLASK_PORT", "5000"))
    debug = os.getenv("FLASK_ENV", "development") == "development"
    app.run(host=host, port=port, debug=debug)
