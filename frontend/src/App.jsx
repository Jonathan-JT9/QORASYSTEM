import { useCallback, useEffect, useState } from "react";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import ImageUploadDropzone from "./components/ImageUploadDropzone.jsx";
import PredictionResultCard from "./components/PredictionResultCard.jsx";
import GradCAMViewer from "./components/GradCAMViewer.jsx";
import InterpretationBox from "./components/InterpretationBox.jsx";
import HistoryTable from "./components/HistoryTable.jsx";
import { fetchApiHistory, getHealth, predictCxr } from "./services/api.js";
import { fetchExamHistory, insertExamHistory, supabaseConfigured } from "./services/supabase.js";
import { Cpu, Sparkles, Activity, ShieldCheck, ArrowRight, Layers, FileText, CheckCircle2 } from "lucide-react";

export default function App() {
  const [health, setHealth] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState("");
  const [history, setHistory] = useState([]);

  const refreshHistory = useCallback(async () => {
    try {
      if (supabaseConfigured) {
        setHistory(await fetchExamHistory());
      } else {
        setHistory(await fetchApiHistory());
      }
    } catch {
      setHistory(await fetchApiHistory().catch(() => []));
    }
  }, []);

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch(() => setHealth({ ok: false }));
    refreshHistory();
  }, [refreshHistory]);

  async function handleFile(file) {
    setError("");
    setBusy(true);
    setPreview(URL.createObjectURL(file));
    try {
      const data = await predictCxr(file);
      setResult(data);
      if (supabaseConfigured) {
        try {
          await insertExamHistory(data);
        } catch (persistErr) {
          console.warn("Supabase insert skipped:", persistErr.message);
        }
      }
      await refreshHistory();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Prediksi gagal dieksekusi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-neutral-900 selection:bg-black selection:text-white">
      <Header health={health} />

      {/* Hero Section */}
      <section id="beranda" className="relative border-b border-neutral-200 bg-neutral-50/70 bg-monochrome-grid py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-12">
            
            {/* Left Column: Hero Text */}
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-black shadow-sm">
                <span className="flex h-2 w-2 rounded-full bg-black" />
                <span>Quantum Diagnostic Pipeline</span>
                <span className="text-neutral-300">|</span>
                <span className="text-neutral-600">HQCNN v1.0</span>
              </div>

              <h1 className="mt-5 text-4xl font-black tracking-tight text-black sm:text-5xl lg:text-6xl">
                Quantum-Optimized <br />
                <span className="text-neutral-900">
                  Radiograph Analysis
                </span>
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-relaxed text-neutral-600 sm:text-lg">
                Skrining presisi Tuberkulosis (TB) vs Normal pada citra Chest X-Ray menggunakan arsitektur hibrida CNN + Sirkuit Kuantum Variasional 6-qubit PennyLane, peta atensi Grad-CAM, dan sintesis klinis Google Gemini 2.5 Flash.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <a
                  href="#analisis"
                  className="inline-flex items-center gap-2 rounded-xl bg-black px-6 py-3.5 text-sm font-bold text-white shadow-md transition-all duration-200 hover:bg-neutral-800 active:scale-98"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Mulai Analisis CXR</span>
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="#riwayat"
                  className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-6 py-3.5 text-sm font-bold text-black shadow-sm transition-all duration-200 hover:border-black hover:bg-neutral-50"
                >
                  <Activity className="h-4 w-4 text-black" />
                  <span>Riwayat Sesi</span>
                </a>
              </div>
            </div>

            {/* Right Column: Hero Visual Showcase */}
            <div className="lg:col-span-5">
              <div className="relative mx-auto max-w-md rounded-2xl border-2 border-black bg-black p-6 text-white shadow-2xl">
                <div className="relative overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 p-6 text-center">
                  <img
                    src="/logo-transparent.png"
                    alt="QORA Master Logo"
                    className="mx-auto h-20 w-auto object-contain transition-transform duration-500 hover:scale-105"
                  />
                  <div className="mt-5 border-t border-neutral-800 pt-3">
                    <p className="text-xs font-bold tracking-wider text-neutral-300 uppercase">
                      Arsitektur Jaringan Saraf Kuantum Hibrida
                    </p>
                    <p className="mt-1 text-[11px] text-neutral-500">
                      EfficientNet-B0 + 6-Qubit VQC + Grad-CAM + Gemini 2.5
                    </p>
                  </div>
                </div>

                {/* Micro metric pills */}
                <div className="mt-3.5 grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-2.5">
                    <span className="block font-bold text-white">6 Qubits</span>
                    <span className="text-[10px] text-neutral-400">Entangled VQC Layer</span>
                  </div>
                  <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-2.5">
                    <span className="block font-bold text-white">EfficientNet</span>
                    <span className="text-[10px] text-neutral-400">Deep CNN Backbone</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Feature Highlights Grid */}
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-all hover:border-black">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 text-black border border-neutral-200">
                  <Cpu className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-black">Quantum VQC 6-Qubit</h4>
                  <p className="text-[11px] text-neutral-500">PennyLane Strong Entanglement</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-all hover:border-black">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 text-black border border-neutral-200">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-black">Explainable Grad-CAM</h4>
                  <p className="text-[11px] text-neutral-500">Peta atensi lesi radiografis</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-all hover:border-black">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 text-black border border-neutral-200">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-black">Google Gemini 2.5 Flash</h4>
                  <p className="text-[11px] text-neutral-500">Sintesis narasi klinis terstruktur</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-all hover:border-black">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 text-black border border-neutral-200">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-black">Verifikasi Terintegrasi</h4>
                  <p className="text-[11px] text-neutral-500">Log riwayat sesi otomatis</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Main Workspace */}
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-16 px-4 py-12 sm:px-6">
        
        {/* Step 1: Upload & Inference */}
        <section id="analisis" className="scroll-mt-24 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 border-b border-neutral-200 pb-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Langkah 1</span>
              <h2 className="text-2xl font-bold tracking-tight text-black">Unggah & Analisis Citra Rontgen CXR</h2>
              <p className="mt-1 text-xs text-neutral-600">
                Pilih foto rontgen dada (CXR) dalam format citra, sistem akan mengekstrak fitur dan mengevaluasi sirkuit kuantum.
              </p>
            </div>
          </div>

          <ImageUploadDropzone onFile={handleFile} disabled={busy} />

          {busy && (
            <div className="flex items-center justify-center gap-3 rounded-xl border border-black bg-neutral-100 p-4 text-sm font-semibold text-black">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-black border-t-transparent" />
              <span>Memproses inferensi HQCNN, mengekstrak Grad-CAM & menyusun narasi Gemini…</span>
            </div>
          )}

          {error && (
            <div className="rounded-xl border-2 border-black bg-neutral-100 p-4 text-sm font-semibold text-black">
              <strong>Gagal:</strong> {error}
            </div>
          )}
        </section>

        {/* Step 2: Prediction Results & Explainability */}
        <section id="hasil" className="scroll-mt-24 space-y-6">
          <div className="border-b border-neutral-200 pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Langkah 2</span>
            <h2 className="text-2xl font-bold tracking-tight text-black">Hasil Prediksi & Visualisasi Explainable AI</h2>
            <p className="mt-1 text-xs text-neutral-600">
              Hasil inferensi jaringan hibrida kuantum, probabilitas per kelas, atensi anatomi paru, dan sintesis klinis.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <PredictionResultCard result={result} />
            <InterpretationBox text={result?.interpretation} loading={busy} />
          </div>

          <GradCAMViewer originalUrl={preview} overlayUrl={result?.gradcam_overlay_b64} />
        </section>

        {/* Step 3: Session History */}
        <section id="riwayat" className="scroll-mt-24 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 border-b border-neutral-200 pb-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Langkah 3</span>
              <h2 className="text-2xl font-bold tracking-tight text-black">Riwayat Rekam Pemeriksaan</h2>
              <p className="mt-1 text-xs text-neutral-600">
                {supabaseConfigured
                  ? "Tersinkronisasi secara persisten dengan database Cloud Supabase."
                  : "Tersimpan pada memori sesi server lokal (Dapat dihubungkan ke Supabase kapan saja)."}
              </p>
            </div>
          </div>

          <HistoryTable rows={history} />
        </section>

      </main>

      <Footer />
    </div>
  );
}
