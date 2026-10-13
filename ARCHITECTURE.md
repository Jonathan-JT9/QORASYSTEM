# QORA Architecture Guide

Quantum-Optimized Radiograph Analysis (QORA) is a modular web system for **TB vs Normal** classification of Chest X-Ray (CXR) images using a Hybrid Quantum Convolutional Neural Network (HQCNN).

This document describes how the pieces fit together. It is the source of truth for folder layout and request flow.

## 1. System overview

```
┌─────────────┐     multipart/form-data      ┌──────────────────┐
│  React SPA  │ ───────────────────────────► │  Flask API       │
│  Vite + TW  │ ◄── JSON + Grad-CAM b64 ──── │  /api/predict    │
│             │                              │  /api/history    │
└──────┬──────┘                              └────────┬─────────┘
       │                                              │
       │  Auth + exam history                         │  HQCNN (PyTorch)
       ▼                                              │  PennyLane VQC
┌─────────────┐                                       │  Grad-CAM
│  Supabase   │                                       │  Gemini 2.5 Flash
│  Postgres   │                                       ▼
│  Auth / RLS │                              checkpoints/best.pt
└─────────────┘
```

**Clinical disclaimer:** QORA is a decision-support prototype. It is not a certified medical device and must not replace licensed radiologist interpretation.

## 2. Repository layout

```
QORASYS/
├── ARCHITECTURE.md          ← this file
├── README.md
├── .env.example
├── .gitignore
├── backend/
│   ├── app.py               ← Flask entry, CORS, routes
│   ├── model_loader.py      ← HQCNN definition, checkpoint, inference
│   ├── gradcam.py           ← heatmap + overlay
│   ├── gemini_service.py    ← Gemini 2.5 Flash narrative
│   ├── requirements.txt
│   └── checkpoints/         ← place best.pt here (gitignored)
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── index.css
│       ├── components/
│       └── services/
└── supabase/
    └── schema.sql           ← exam history table + RLS
```

## 3. Backend modules

| Module | Responsibility |
|--------|----------------|
| `app.py` | HTTP layer only: parse upload, call services, return JSON. |
| `model_loader.py` | EfficientNet-B0 backbone + 6-qubit PennyLane `TorchLayer` + classifier. Loads `best.pt`. |
| `gradcam.py` | Gradients on the last convolutional block of the CNN backbone; jet heatmap overlay. |
| `gemini_service.py` | Builds a clinical-style prompt from class probabilities and returns narrative text. |

### HQCNN forward pass

1. CXR → RGB 224×224, ImageNet normalization.
2. CNN backbone extracts spatial features.
3. Global average pooling + linear projection to **6** real values (one per qubit).
4. Variational Quantum Circuit: `AngleEmbedding` + `StronglyEntanglingLayers` on `default.qubit`.
5. Pauli-Z expectations (6) → linear head → **2 logits** (`Normal`, `TB`).
6. Softmax → class probabilities.

If your trained `best.pt` used a different backbone, qubit count, or layer depth, adjust constants in `model_loader.py` (`N_QUBITS`, `N_QLAYERS`, `BACKBONE`) so `state_dict` keys align. Loading uses `strict=False` as a safety net and logs missing/unexpected keys.

## 4. API contracts

### `POST /api/predict`

- **Body:** `multipart/form-data` field `image` (JPEG/PNG CXR).
- **Response:**

```json
{
  "label": "TB",
  "confidence": 0.91,
  "probabilities": { "Normal": 0.09, "TB": 0.91 },
  "gradcam_overlay_b64": "data:image/png;base64,...",
  "interpretation": "…Gemini narrative…",
  "model": { "name": "HQCNN", "n_qubits": 6 }
}
```

### `GET /api/history`

Returns in-memory session history held by the Flask process (demo). Production persistence is **Supabase** (`exam_history`), written from the SPA after a successful predict.

### `GET /api/health`

Liveness + whether the checkpoint loaded.

## 5. Frontend

| Component | Role |
|-----------|------|
| `Header` | Branding, health badge, nav. |
| `ImageUploadDropzone` | Drag-and-drop / file picker for CXR. |
| `PredictionResultCard` | Label, confidence, dual-class bars. |
| `GradCAMViewer` | Original vs overlay. |
| `InterpretationBox` | Gemini clinical narrative. |
| `HistoryTable` | Rows from Supabase (fallback: API memory). |

Services:

- `services/api.js` — Axios client to Flask.
- `services/supabase.js` — browser client + `exam_history` helpers.

## 6. Data & auth (Supabase)

Table `exam_history` stores classification results per authenticated user (`user_id`). Row Level Security restricts select/insert to `auth.uid()`. Optional storage bucket for original CXR objects can be added later; the MVP stores overlay as base64 only in the API response, not in Postgres.

## 7. Security & ops notes

- Keep `GEMINI_API_KEY` and service-role keys **server-side only**. The SPA uses the Supabase **anon** key.
- Do not log raw images or patient identifiers.
- Checkpoint files are large; they stay out of git.
- Quantum circuit uses a **simulator** (`default.qubit`), not real QPU hardware.
