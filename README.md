# QORA — Quantum-Optimized Radiograph Analysis

Sistem web klasifikasi **Tuberkulosis vs Normal** pada citra Chest X-Ray (CXR) menggunakan model **HQCNN** (backbone CNN + sirkuit kuantum VQC 6-qubit PennyLane), visualisasi **Grad-CAM**, interpretasi klinis **Google Gemini 3.8 Flash**, dan penyimpanan riwayat lewat **Supabase**.

> Bukan alat diagnosis resmi. Hasil prediksi hanya pendukung keputusan klinis.

## Prasyarat

- Python 3.10+
- Node.js 18+
- File bobot `best.pt` (letakkan di `backend/checkpoints/best.pt`)
- Akun [Google AI](https://aistudio.google.com/) (Gemini API key)
- Proyek [Supabase](https://supabase.com/) (URL + anon key)

## Instalasi cepat

### 1. Environment

```bash
copy .env.example .env
copy frontend\.env.example frontend\.env
```

Isi `GEMINI_API_KEY`, `VITE_SUPABASE_URL`, dan `VITE_SUPABASE_ANON_KEY`.

### 2. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Pasang PyTorch sesuai perangkat Anda (CPU atau CUDA) dari [pytorch.org](https://pytorch.org/get-started/locally/) jika wheel default tidak sesuai.

Jalankan API:

```bash
python app.py
```

Server default: `http://localhost:5000`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Aplikasi default: `http://localhost:5173`

### 4. Database

Di SQL Editor Supabase, jalankan `supabase/schema.sql`.

## Endpoint

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/health` | Status server & model |
| POST | `/api/predict` | Unggah CXR, prediksi + Grad-CAM + narasi |
| GET | `/api/history` | Riwayat sesi (in-memory) |
| POST | `/api/history` | Simpan entri riwayat ke memori server |

## Arsitektur

Lihat [ARCHITECTURE.md](./ARCHITECTURE.md).

## Lisensi

Prototype riset — sesuaikan lisensi sebelum distribusi produksi.
