# QORA — Quantum-Optimized Radiograph Analysis

Sistem web klasifikasi Tuberkulosis vs Normal pada citra Chest X-Ray (CXR) menggunakan model HQCNN (backbone CNN + sirkuit kuantum VQC 6-qubit PennyLane), validasi citra menggunakan CLIP, visualisasi Grad-CAM, interpretasi klinis Google Gemini 3.5 Flash, dan penyimpanan riwayat lewat Supabase.

**Bukan alat diagnosis resmi.** Hasil prediksi hanya pendukung keputusan klinis.

## Prasyarat
- Python 3.10+
- Node.js 18+
- File bobot `best.pt` (letakkan di `backend/checkpoints/best.pt`)
- Akun Google AI (Gemini API key)
- Proyek Supabase (URL + anon key)

## Instalasi cepat

### 1. Environment

```bash
copy .env.example .env
copy frontend\.env.example frontend\.env
```

Isi `GEMINI_API_KEY`, `GEMINI_MODEL=gemini-3.5-flash`, `VITE_SUPABASE_URL`, dan `VITE_SUPABASE_ANON_KEY`.

### 2. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Pasang PyTorch sesuai perangkat Anda (CPU atau CUDA) dari pytorch.org jika wheel default tidak sesuai.

**Unduh bobot model CLIP (hanya satu kali pada perangkat baru):**

```bash
python -c "from transformers import CLIPModel, CLIPProcessor; CLIPProcessor.from_pretrained('openai/clip-vit-base-patch32', use_fast=False); CLIPModel.from_pretrained('openai/clip-vit-base-patch32', use_safetensors=True)"
```

Model `openai/clip-vit-base-patch32` akan tersimpan dalam cache lokal. Setelah diunduh, validasi Chest X-Ray menggunakan CLIP dapat berjalan secara offline tanpa perlu mengunduh ulang.

Jalankan API:

```bash
python app.py
```

Server default: `http://localhost:8000`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Aplikasi default: `http://localhost:5175`

### 4. Database

Di SQL Editor Supabase, jalankan `supabase/schema.sql`.

## Endpoint

| Method | Path | Deskripsi |
|---|---|---|
| GET | `/api/health` | Status server & model |
| POST | `/api/predict` | Validasi CXR, prediksi + Grad-CAM |
| POST | `/api/interpret` | Interpretasi klinis menggunakan Gemini AI |
| GET | `/api/history` | Riwayat sesi (in-memory) |
| POST | `/api/history` | Simpan entri riwayat ke memori server |

## Arsitektur

Lihat `ARCHITECTURE.md`.

## Evaluasi model pada dataset eksternal

Untuk mengukur performa checkpoint pada citra berlabel dari sumber eksternal, siapkan dataset yang tidak digunakan saat training atau pemilihan threshold:

```text
cxr-test/
├── Normal/
│   ├── normal-001.png
│   └── ...
└── TB/
    ├── tb-001.png
    └── ...
```

Label harus berasal dari sumber tepercaya. Jika memungkinkan, pastikan pemisahan data berdasarkan pasien dan sumber gambar agar tidak ada gambar yang sama atau hampir sama di data training dan test. Jalankan dari direktori `backend`:

```bash
python evaluate_model.py --dataset /path/to/cxr-test --device cpu --output /path/to/evaluation-report.json
```

Skrip melaporkan confusion matrix, accuracy, sensitivity TB, specificity Normal, precision, F1, ROC-AUC, Brier score, dan ECE menggunakan threshold dari checkpoint. Skrip ini mengevaluasi classifier secara langsung; pemeriksaan Gemini/CLIP tidak dijalankan. Jangan memilih threshold dari hasil test: tentukan threshold pada validation set terpisah, lalu gunakan test set yang terkunci untuk pelaporan akhir. Metrik hanya berlaku pada dataset yang dievaluasi dan bukan validasi klinis.

### Penjelasan untuk sidang

Sesuaikan jawaban dengan hasil pengukuran yang benar-benar diperoleh; jangan mengklaim angka yang belum diuji:

> “QORA adalah prototipe riset untuk mengklasifikasikan citra CXR menjadi Normal atau TB. Model menghasilkan skor dan memilih kelas dengan threshold yang ditetapkan pada validation set. Pada dataset eksternal yang label rujukannya dapat dipertanggungjawabkan, hasil pengujian kami adalah sensitivity **[isi hasil]**, specificity **[isi hasil]**, dan confusion matrix **[isi hasil]**. Sistem tetap menghasilkan salah satu dari dua label, sehingga kesalahan pada citra tertentu mungkin terjadi akibat keterbatasan model atau perbedaan distribusi data. Hasilnya bukan diagnosis klinis. Gambar Google tanpa label rujukan tepercaya tidak cukup untuk menyimpulkan akurasi. Pengujian pada sumber dan populasi yang lebih luas masih diperlukan.”

Jika evaluasi eksternal belum selesai, sampaikan dengan jelas bahwa angka tersebut belum tersedia dan laporkan sebagai keterbatasan—jangan mengisi placeholder dengan metrik validasi internal atau perkiraan.

## Lisensi

Prototype riset — sesuaikan lisensi sebelum distribusi produksi.