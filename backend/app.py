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
from gemini_service import answer_chat_query, interpret_prediction, validate_image_with_gemini
from image_validator import validate_clip, validate_chest_xray
from gradcam import generate_gradcam_data_url, generate_gradcam_result
from model_loader import load_model,pil_from_bytes,predict_image
import time
from functools import wraps
import requests

ROOT=Path(__file__).resolve().parent
load_dotenv(ROOT.parent/".env")
load_dotenv(ROOT/".env",override=True)

logging.basicConfig(level=logging.INFO,format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger=logging.getLogger("qora")

SUPABASE_URL=os.getenv("SUPABASE_URL","https://cyekxuupfkgyuawforpd.supabase.co")
SUPABASE_ANON_KEY=os.getenv("SUPABASE_ANON_KEY","sb_publishable_ejvKK9J06eFvGzvLXabJ3A_fo4bswuQ")

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

_AUTH_CACHE:dict[str,tuple[dict,float]]={}

def get_authenticated_user(req)->tuple[dict|None,str|None,int]:
    auth_header=req.headers.get("Authorization","").strip()
    if not auth_header.startswith("Bearer "):
        return None,"Otentikasi diperlukan. Header Authorization tidak ditemukan.",401

    token=auth_header.split(" ",1)[1].strip()
    if not token:
        return None,"Token otentikasi kosong.",401

    now=time.time()
    if token in _AUTH_CACHE:
        cached_user,expire_at=_AUTH_CACHE[token]
        if now<expire_at:
            return cached_user,None,200

    try:
        user_res=requests.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={"Authorization":f"Bearer {token}","apikey":SUPABASE_ANON_KEY},
            timeout=5
        )
        if user_res.status_code!=200:
            return None,"Sesi otentikasi tidak valid atau telah kedaluwarsa. Silakan masuk kembali.",401

        user_data=user_res.json()
        user_id=user_data.get("id")

        prof_res=requests.get(
            f"{SUPABASE_URL}/rest/v1/profiles?id=eq.{user_id}&select=role,status,username,full_name",
            headers={"Authorization":f"Bearer {token}","apikey":SUPABASE_ANON_KEY},
            timeout=5
        )

        role="doctor"
        status="pending"
        if prof_res.status_code==200 and prof_res.json():
            prof=prof_res.json()[0]
            role=prof.get("role","doctor")
            status=prof.get("status","pending")
        else:
            meta=user_data.get("user_metadata",{})
            role=meta.get("role","doctor")
            status=meta.get("status","pending")

        user_info={
            "id":user_id,
            "email":user_data.get("email"),
            "role":role,
            "status":status
        }

        _AUTH_CACHE[token]=(user_info,now+60)
        return user_info,None,200

    except Exception as exc:
        logger.warning("Supabase token verification error: %s",exc)
        return None,"Layanan otentikasi sedang tidak dapat dihubungi. Silakan coba kembali.",503

def require_approved_access(f):
    @wraps(f)
    def decorated_function(*args,**kwargs):
        user,err_msg,status_code=get_authenticated_user(request)
        if not user:
            return jsonify({"error":"UNAUTHORIZED","message":err_msg}),status_code

        if user.get("role")=="admin":
            return f(*args,**kwargs)

        if user.get("status")!="approved":
            status_text={
                "pending":"sedang menunggu verifikasi kredensial medis oleh Administrator",
                "rejected":"telah ditolak oleh Administrator",
                "suspended":"telah ditangguhkan oleh Administrator"
            }.get(user.get("status"),user.get("status"))

            return jsonify({
                "error":"ACCOUNT_NOT_APPROVED",
                "message":f"Akses ditolak. Akun dokter Anda {status_text}. Akses workspace analisis citra hanya diberikan untuk dokter terverifikasi."
            }),403

        return f(*args,**kwargs)
    return decorated_function

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
@require_approved_access
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
    
    # Stage 1: Gemini Vision validation
    logger.info("Starting Validation Stage 1: Gemini Vision...")
    gemini_result = validate_image_with_gemini(image)

    if gemini_result["decision"] == "error":
        logger.warning("Gemini Vision validation service unavailable: %s", gemini_result.get("error"))
        return jsonify({
            "accepted": False,
            "stage": "gemini",
            "decision": "error",
            "reason_code": "SERVICE_ERROR",
            "error": "VALIDATION_SERVICE_UNAVAILABLE",
            "message": gemini_result.get("message", "Validasi gambar sedang tidak tersedia. Silakan coba kembali beberapa saat lagi."),
        }), 503

    if gemini_result["decision"] != "pass":
        logger.warning(
            "Validation Stage 1 (Gemini Vision) stopped: decision=%s reason_code=%s reason=%s",
            gemini_result["decision"],
            gemini_result["reason_code"],
            gemini_result.get("reason"),
        )
        return jsonify({
            "accepted": False,
            "stage": "gemini",
            "decision": gemini_result["decision"],
            "reason_code": gemini_result["reason_code"],
            "error": f"IMAGE_VALIDATION_{gemini_result['decision'].upper()}",
            "message": gemini_result["message"],
            "details": gemini_result,
        }), 422

    # Stage 2: CLIP validation (only executed if Gemini passed)
    logger.info("Validation Stage 1 passed. Starting Validation Stage 2: CLIP...")
    clip_result = validate_clip(image)

    if clip_result["decision"] == "error":
        logger.warning("CLIP validation service unavailable: %s", clip_result.get("error"))
        return jsonify({
            "accepted": False,
            "stage": "clip",
            "decision": "error",
            "reason_code": "SERVICE_ERROR",
            "error": "VALIDATION_SERVICE_UNAVAILABLE",
            "message": clip_result.get("message", "Validasi gambar sedang tidak tersedia. Silakan coba kembali beberapa saat lagi."),
        }), 503

    if clip_result["decision"] != "pass":
        logger.warning(
            "Validation Stage 2 (CLIP) stopped: decision=%s reason_code=%s detected=%s",
            clip_result["decision"],
            clip_result["reason_code"],
            clip_result.get("detected_category"),
        )
        return jsonify({
            "accepted": False,
            "stage": "clip",
            "decision": clip_result["decision"],
            "reason_code": clip_result["reason_code"],
            "error": f"IMAGE_VALIDATION_{clip_result['decision'].upper()}",
            "message": clip_result["message"],
            "details": clip_result,
        }), 422

    # Stage 3: Hybrid QCNN Classification (Only reaches here if both Gemini and CLIP passed)
    logger.info("Both validation stages passed (Gemini & CLIP). Proceeding to Stage 3: Hybrid QCNN classification.")

    try:
        bundle=get_bundle()
        result=predict_image(bundle,image)
        overlay,analysis=generate_gradcam_result(
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
        "gradcam_analysis":analysis,
        "interpretation":None,
        "validation":{
            "accepted":True,
            "status":"passed",
            "message":"Gambar berhasil divalidasi. Melanjutkan klasifikasi...",
            "gemini":{
                "decision":gemini_result["decision"],
                "projection":gemini_result["projection"],
                "is_grayscale":gemini_result["is_grayscale"],
                "image_quality":gemini_result["image_quality"],
                "scope_assessment":gemini_result["scope_assessment"],
                "reason":gemini_result.get("reason"),
                "duration":gemini_result.get("duration"),
            },
            "clip":{
                "decision":clip_result["decision"],
                "chest_score":clip_result["chest_score"],
                "margin":clip_result["margin"],
                "detected_category":clip_result["detected_category"],
                "detected_label":clip_result.get("detected_label"),
                "duration":clip_result.get("duration"),
            }
        },
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

@app.post("/api/validate-image")
@require_approved_access
def validate_image_endpoint():
    """Standalone image validation endpoint executing Stage 1 (Gemini) and Stage 2 (CLIP)."""
    if "image" not in request.files:
        return jsonify({"error":"Field 'image' is required."}),400

    file=request.files["image"]
    if not file or not file.filename:
        return jsonify({"error":"No file selected."}),400

    suffix=Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        return jsonify({
            "accepted":False,
            "stage":"precheck",
            "reason_code":"NOT_CHEST_XRAY",
            "error":"Unsupported file type.",
            "message":"Format gambar tidak didukung."
        }),400

    raw=file.read()
    if not raw:
        return jsonify({"accepted":False,"error":"Empty file."}),400

    try:
        image=pil_from_bytes(raw)
        image.load()
        if image.width<128 or image.height<128:
            return jsonify({
                "accepted":False,
                "stage":"precheck",
                "reason_code":"POOR_QUALITY",
                "error":"INVALID_IMAGE_SIZE",
                "message":"Resolusi gambar terlalu rendah. Minimal 128×128 piksel."
            }),400
    except Exception:
        return jsonify({
            "accepted":False,
            "stage":"precheck",
            "reason_code":"POOR_QUALITY",
            "error":"INVALID_IMAGE",
            "message":"Gambar tidak valid atau rusak."
        }),400

    # Stage 1: Gemini Vision
    gemini_res=validate_image_with_gemini(image)
    if gemini_res["decision"]=="error":
        return jsonify(gemini_res),503
    if gemini_res["decision"]!="pass":
        return jsonify(gemini_res),422

    # Stage 2: CLIP
    clip_res=validate_clip(image)
    if clip_res["decision"]=="error":
        return jsonify(clip_res),503
    if clip_res["decision"]!="pass":
        return jsonify(clip_res),422

    return jsonify({
        "accepted":True,
        "status":"passed",
        "message":"Gambar berhasil divalidasi. Melanjutkan klasifikasi...",
        "gemini":gemini_res,
        "clip":clip_res
    }),200

@app.post("/api/interpret")
@require_approved_access
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

@app.post("/api/chat")
@require_approved_access
def chat():
    body=request.get_json(silent=True)
    if not isinstance(body,dict):
        return jsonify({
            "error":"INVALID_REQUEST",
            "message":"Permintaan chat tidak valid."
        }),400

    message=(body.get("message") or "").strip()
    if not message:
        return jsonify({
            "error":"EMPTY_MESSAGE",
            "message":"Pesan pertanyaan tidak boleh kosong."
        }),400

    prediction_id=body.get("prediction_id")
    history=body.get("history") or []
    client_context=body.get("context") or {}

    context={}
    if prediction_id:
        item=next((entry for entry in SESSION_HISTORY if entry["id"]==prediction_id),None)
        if item:
            context=dict(item)

    for k,v in client_context.items():
        if v is not None and (k not in context or not context[k]):
            context[k]=v

    try:
        reply=answer_chat_query(message=message,history=history,context=context)
        return jsonify({"reply":reply}),200

    except Exception as exc:
        logger.exception("Gemini chat query failed")
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
            "message":"Gemini AI gagal memproses jawaban. Silakan coba kembali."
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