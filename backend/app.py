"""QORA Flask API: CXR classification, Grad-CAM, Gemini AI, and history."""
from __future__ import annotations
import logging
import os
import uuid
from datetime import datetime,timezone
from functools import lru_cache
from pathlib import Path
from dotenv import load_dotenv
from flask import Flask,jsonify,request
from flask_cors import CORS
from PIL import Image,UnidentifiedImageError
from gemini_service import interpret_prediction
from image_validator import validate_chest_xray
from gradcam import generate_gradcam_data_url
from model_loader import load_model,pil_from_bytes,predict_image

ROOT=Path(__file__).resolve().parent
load_dotenv(ROOT.parent/".env")
load_dotenv(ROOT/".env",override=True)

logging.basicConfig(level=logging.INFO,format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger=logging.getLogger("qora")

ALLOWED_EXTENSIONS={".png",".jpg",".jpeg",".bmp",".webp",".tif",".tiff"}
MAX_HISTORY=50

app=Flask(__name__)
app.config["MAX_CONTENT_LENGTH"]=16*1024*1024

allowed_origins=[
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5175"
]

CORS(app,resources={
    r"/api/*":{
        "origins":allowed_origins,
        "methods":["GET","POST","OPTIONS"],
        "allow_headers":["Content-Type","Authorization"]
    }
})

SESSION_HISTORY:list[dict]=[]

@lru_cache(maxsize=1)
def get_bundle():
    checkpoint=os.getenv("CHECKPOINT_PATH","checkpoints/best.pt")
    path=Path(checkpoint)
    if not path.is_absolute():
        path=ROOT/path
    return load_model(path,device_preference=os.getenv("MODEL_DEVICE","auto"))

@app.get("/api/health")
def health():
    checkpoint=os.getenv("CHECKPOINT_PATH","checkpoints/best.pt")
    path=Path(checkpoint)
    if not path.is_absolute():
        path=ROOT/path
    try:
        bundle=get_bundle()
        return jsonify({
            "ok":True,
            "service":"QORA",
            "model":"HQCNN",
            "backbone":"ResNet-50",
            "n_qubits":bundle.model.n_qubits,
            "device":str(bundle.device),
            "threshold":bundle.threshold,
            "checkpoint_exists":path.exists(),
            "model_loaded":True
        }),200
    except Exception:
        logger.exception("Model health check failed")
        return jsonify({
            "ok":False,
            "service":"QORA",
            "model_loaded":False,
            "checkpoint_exists":path.exists(),
            "error":"Model initialization failed."
        }),503

@app.post("/api/predict")
def predict():
    if "image" not in request.files:
        return jsonify({"error":"Field 'image' is required."}),400

    file=request.files["image"]

    if not file or not file.filename:
        return jsonify({"error":"No file selected."}),400

    suffix=Path(file.filename).suffix.lower()

    if suffix not in ALLOWED_EXTENSIONS:
        return jsonify({
            "error":"Unsupported file type.",
            "message":"Format gambar tidak didukung."
        }),400

    raw=file.read()

    if not raw:
        return jsonify({"error":"Empty file."}),400

    try:
        image=pil_from_bytes(raw)
        image.load()

        if image.width<128 or image.height<128:
            return jsonify({
                "error":"INVALID_IMAGE_SIZE",
                "message":"Resolusi gambar terlalu rendah. Minimal 128×128 piksel."
            }),400

    except (UnidentifiedImageError,OSError,ValueError,Image.DecompressionBombError):
        return jsonify({
            "error":"INVALID_IMAGE",
            "message":"Gambar tidak valid atau rusak."
        }),400
    
    try:
        validation=validate_chest_xray(image)

    except Exception:
        logger.exception("Chest X-Ray validation failed")

        return jsonify({
            "error":"CXR_VALIDATION_FAILED",
            "message":"Sistem tidak dapat memvalidasi jenis gambar saat ini. Silakan coba kembali."
        }),503

    if not validation["accepted"]:
        logger.warning(
            "Non-CXR image rejected: category=%s chest_score=%.4f",
            validation["detected_category"],
            validation["chest_score"]
        )

        return jsonify({
            "error":"INVALID_CHEST_XRAY",
            "message":"Gambar yang diunggah tidak teridentifikasi sebagai Chest X-Ray. Silakan unggah citra rontgen dada yang memperlihatkan area paru-paru.",
            "detected_type":validation["detected_label"]
        }),422

    try:
        bundle=get_bundle()
        result=predict_image(bundle,image)
        overlay=generate_gradcam_data_url(
            bundle,
            image,
            target_index=result["class_index"]
        )
    except Exception:
        logger.exception("QORA classification failed")
        return jsonify({
            "error":"CLASSIFICATION_FAILED",
            "message":"Klasifikasi gagal. Silakan coba kembali."
        }),500

    payload={
        "id":str(uuid.uuid4()),
        "created_at":datetime.now(timezone.utc).isoformat(),
        "filename":Path(file.filename).name,
        "label":result["label"],
        "confidence":result["confidence"],
        "probabilities":result["probabilities"],
        "gradcam_overlay_b64":overlay,
        "interpretation":None,
        "model":{
            "name":"HQCNN",
            "backbone":"ResNet-50",
            "n_qubits":bundle.model.n_qubits,
            "threshold":bundle.threshold
        }
    }

    history_item={
        key:value
        for key,value in payload.items()
        if key!="gradcam_overlay_b64"
    }

    SESSION_HISTORY.insert(0,history_item)
    SESSION_HISTORY[:]=SESSION_HISTORY[:MAX_HISTORY]

    logger.info(
        "Classification completed: label=%s confidence=%.4f",
        result["label"],
        result["confidence"]
    )

    return jsonify(payload),200

@app.post("/api/interpret")
def interpret():
    body=request.get_json(silent=True)

    if not isinstance(body,dict):
        return jsonify({
            "error":"INVALID_REQUEST",
            "message":"Permintaan interpretasi tidak valid."
        }),400

    prediction_id=body.get("id")

    if not prediction_id:
        return jsonify({
            "error":"MISSING_ID",
            "message":"ID klasifikasi diperlukan."
        }),400

    item=next(
        (entry for entry in SESSION_HISTORY if entry["id"]==prediction_id),
        None
    )

    if item is None:
        return jsonify({
            "error":"PREDICTION_NOT_FOUND",
            "message":"Hasil klasifikasi tidak ditemukan."
        }),404

    if item.get("interpretation"):
        return jsonify({
            "id":prediction_id,
            "interpretation":item["interpretation"]
        }),200

    try:
        logger.info("Gemini interpretation started: id=%s",prediction_id)

        narrative=interpret_prediction(
            label=item["label"],
            probabilities=item["probabilities"],
            confidence=item["confidence"]
        )

        if not isinstance(narrative,str) or not narrative.strip():
            raise ValueError("Gemini returned an empty interpretation.")

        item["interpretation"]=narrative.strip()

        logger.info("Gemini interpretation completed: id=%s",prediction_id)

        return jsonify({
            "id":prediction_id,
            "interpretation":item["interpretation"]
        }),200

    except Exception as exc:
        logger.exception("Gemini interpretation failed")

        error_text=str(exc).lower()
        status_code=getattr(exc,"status_code",None)
        code=getattr(exc,"code",None)

        if status_code==429 or code==429 or "429" in error_text or "resource_exhausted" in error_text:
            return jsonify({
                "error":"GEMINI_QUOTA_EXCEEDED",
                "message":"Kuota Gemini AI telah habis. Silakan coba kembali setelah kuota diperbarui."
            }),429

        return jsonify({
            "error":"GEMINI_FAILED",
            "message":"Gemini AI gagal menghasilkan interpretasi. Silakan coba kembali."
        }),502

@app.get("/api/history")
def history_list():
    return jsonify({"items":SESSION_HISTORY}),200

@app.post("/api/history")
def history_create():
    body=request.get_json(silent=True)

    if not isinstance(body,dict):
        return jsonify({
            "error":"INVALID_REQUEST",
            "message":"Data riwayat tidak valid."
        }),400

    item={
        "id":str(uuid.uuid4()),
        "created_at":datetime.now(timezone.utc).isoformat(),
        "filename":body.get("filename"),
        "label":body.get("label"),
        "confidence":body.get("confidence"),
        "probabilities":body.get("probabilities"),
        "interpretation":body.get("interpretation"),
        "patient_code":body.get("patient_code")
    }

    SESSION_HISTORY.insert(0,item)
    SESSION_HISTORY[:]=SESSION_HISTORY[:MAX_HISTORY]

    return jsonify(item),201

@app.errorhandler(413)
def file_too_large(_error):
    return jsonify({
        "error":"FILE_TOO_LARGE",
        "message":"Ukuran file terlalu besar. Maksimal 16 MB."
    }),413

if __name__=="__main__":
    from image_validator import load_validator

    host=os.getenv("FLASK_HOST","127.0.0.1")
    port=int(os.getenv("FLASK_PORT","8000"))

    logger.info("Preparing QORA models...")

    try:
        logger.info("Loading HQCNN...")
        get_bundle()

        logger.info("Loading Chest X-Ray validator...")
        load_validator()

        logger.info("All QORA models are ready.")

    except Exception:
        logger.exception("QORA model initialization failed")
        raise SystemExit(1)

    logger.info("Starting QORA backend at %s:%s",host,port)

    app.run(
        host=host,
        port=port,
        debug=False,
        use_reloader=False
    )