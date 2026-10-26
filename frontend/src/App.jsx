import { useCallback, useEffect, useRef, useState } from "react";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import LandingPage from "./components/LandingPage.jsx";
import ImageUploadDropzone from "./components/ImageUploadDropzone.jsx";
import PredictionResultCard from "./components/PredictionResultCard.jsx";
import GradCAMViewer from "./components/GradCAMViewer.jsx";
import InterpretationBox from "./components/InterpretationBox.jsx";
import ClinicalChatbot from "./components/ClinicalChatbot.jsx";
import HistoryTable from "./components/HistoryTable.jsx";
import CxrEducationSection from "./components/CxrEducationSection.jsx";
import { fetchApiHistory, getHealth, predictCxr, interpretCxr } from "./services/api.js";
import { fetchExamHistory, insertExamHistory, supabaseConfigured } from "./services/supabase.js";
import { getStoredUser, signOut } from "./services/auth.js";
import { Cpu, Sparkles, Activity, ShieldCheck, ArrowRight, Layers, BookOpen } from "lucide-react";

function getPage() {
  switch (window.location.hash) {
    case "#/classification":
    case "#analisis":
    case "#hasil":
      return "classification";
    case "#/history":
    case "#riwayat":
      return "history";
    default:
      return "home";
  }
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(getStoredUser);
  const [page, setPage] = useState(getPage);
  const [health, setHealth] = useState(null);
  const [busy, setBusy] = useState(false);
  const [interpreting, setInterpreting] = useState(false);
  const [error, setError] = useState("");
  const [interpretError, setInterpretError] = useState("");
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState("");
  const [history, setHistory] = useState([]);
  const requestId = useRef(0);

  const handleLogout = useCallback(async () => {
    await signOut();
    setCurrentUser(null);
  }, []);

  useEffect(() => {
    function navigate() {
      setPage(getPage());
    }
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [page]);

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
    getHealth().then(setHealth).catch(() => setHealth({ ok: false }));
    refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function handleFile(file) {
    const currentRequest = ++requestId.current;

    setError("");
    setInterpretError("");
    setResult(null);
    setInterpreting(false);
    setBusy(true);
    setPreview(URL.createObjectURL(file));

    let data;

    try {
      data = await predictCxr(file);

      if (currentRequest !== requestId.current) return;

      setResult(data);
      setBusy(false);

      if (supabaseConfigured) {
        try {
          await insertExamHistory(data);
        } catch (persistErr) {
          console.warn("Supabase insert skipped:", persistErr.message);
        }
      }

      await refreshHistory();

    } catch (err) {
      if (currentRequest !== requestId.current) return;

      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Prediksi gagal dieksekusi"
      );

      setBusy(false);
      return;
    }

    if (currentRequest !== requestId.current) return;

    setInterpreting(true);

    try {
      const response = await interpretCxr(data.id);

      if (currentRequest !== requestId.current) return;

      if (!response.interpretation) {
        throw new Error("Gemini tidak mengembalikan interpretasi.");
      }

      setResult(prev => {
        if (!prev || prev.id !== data.id) return prev;
        return { ...prev, interpretation: response.interpretation };
      });

      await refreshHistory();

    } catch (err) {
      if (currentRequest !== requestId.current) return;

      setInterpretError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Interpretasi Gemini AI gagal."
      );

      console.error("Gemini interpretation error:", err);

    } finally {
      if (currentRequest === requestId.current) {
        setInterpreting(false);
      }
    }
  }

  if (!currentUser) {
    return (
      <LandingPage
        health={health}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
        }}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-neutral-900 selection:bg-black selection:text-white">
      <Header
        health={health}
        page={page}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      <main className="flex-1">
        <div hidden={page !== "home"}>
          <section id="beranda" aria-label="Home" className="relative border-b border-neutral-200 bg-neutral-50/70 bg-monochrome-grid py-16 sm:py-24">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <div className="grid items-center gap-12 lg:grid-cols-12">
                <div className="lg:col-span-7">
                  <div className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-black shadow-sm">
                    <span className="flex h-2 w-2 rounded-full bg-black" />
                    <span>Quantum Diagnostic Pipeline</span>
                    <span className="text-neutral-300">|</span>
                    <span className="text-neutral-600">HQCNN v1.0</span>
                  </div>

                  <h1 className="mt-5 text-4xl font-black tracking-tight text-black sm:text-5xl lg:text-6xl">
                    Quantum-Optimized <br />
                    <span className="text-neutral-900">Radiograph Analysis</span>
                  </h1>

                  <p className="mt-5 max-w-2xl text-base leading-relaxed text-neutral-600 sm:text-lg">
                    Klasifikasi citra Chest X-Ray ke dalam kategori Tuberkulosis (TB) dan Normal
                    menggunakan arsitektur hibrida CNN + Sirkuit Kuantum
                    Variasional 6-qubit PennyLane, peta atensi Grad-CAM, dan
                    sintesis klinis Google Gemini 3.5 Flash.
                  </p>

                  <div className="mt-8 flex flex-wrap items-center gap-4">
                    <a href="#/classification" className="inline-flex items-center gap-2 rounded-xl bg-black px-6 py-3.5 text-sm font-bold text-white shadow-md transition-all duration-200 hover:bg-neutral-800 active:scale-98">
                      <Sparkles className="h-4 w-4" />
                      <span>Mulai Analisis CXR</span>
                      <ArrowRight className="h-4 w-4" />
                    </a>

                    <a href="#edukasi" className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-5 py-3.5 text-sm font-bold text-neutral-700 shadow-sm transition-all duration-200 hover:border-black hover:text-black hover:bg-neutral-50">
                      <BookOpen className="h-4 w-4 text-black" />
                      <span>Edukasi CXR</span>
                    </a>

                    <a href="#/history" className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-6 py-3.5 text-sm font-bold text-black shadow-sm transition-all duration-200 hover:border-black hover:bg-neutral-50">
                      <Activity className="h-4 w-4 text-black" />
                      <span>Riwayat Sesi</span>
                    </a>
                  </div>
                </div>

                <div className="lg:col-span-5">
                  <div className="relative mx-auto max-w-md rounded-2xl border-2 border-black bg-black p-6 text-white shadow-2xl">
                    <div className="relative overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 p-6 text-center">
                      <img src="/logo-transparent.png" alt="QORA Master Logo" className="mx-auto h-20 w-auto object-contain transition-transform duration-500 hover:scale-105" />

                      <div className="mt-5 border-t border-neutral-800 pt-3">
                        <p className="text-xs font-bold tracking-wider text-neutral-300 uppercase">
                          Arsitektur Jaringan Saraf Kuantum Hibrida
                        </p>
                        <p className="mt-1 text-[11px] text-neutral-500">
                          ResNet-50 + 6-Qubit VQC + Grad-CAM + Gemini 3.5
                        </p>
                      </div>
                    </div>

                    <div className="mt-3.5 grid grid-cols-2 gap-2 text-center text-xs">
                      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-2.5">
                        <span className="block font-bold text-white">6 Qubits</span>
                        <span className="text-[10px] text-neutral-400">
                          Entangled VQC Layer
                        </span>
                      </div>

                      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-2.5">
                        <span className="block font-bold text-white">ResNet-50</span>
                        <span className="text-[10px] text-neutral-400">
                          Deep CNN Backbone
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

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
                      <p className="text-[11px] text-neutral-500">Visualisasi kontribusi fitur model</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-all hover:border-black">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 text-black border border-neutral-200">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-black">Google Gemini 3.5 Flash</h4>
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

          <CxrEducationSection />
        </div>

        {/* Keep page contents mounted so navigation preserves uploads and view settings. */}
        <div hidden={page !== "classification"} aria-label="Classification" className="mx-auto w-full max-w-7xl space-y-16 px-4 py-12 sm:px-6">
          <section id="analisis" className="scroll-mt-24 space-y-4">
            <div className="flex flex-col gap-2 border-b border-neutral-200 pb-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Langkah 1</span>
                <h2 className="text-2xl font-bold tracking-tight text-black">
                  Unggah & Analisis Citra Rontgen CXR
                </h2>
                <p className="mt-1 text-xs text-neutral-600">
                  Pilih foto rontgen dada (CXR) dalam format citra, sistem akan
                  mengekstrak fitur dan mengevaluasi sirkuit kuantum.
                </p>
              </div>
            </div>

            <ImageUploadDropzone onFile={handleFile} disabled={busy} />

            {busy && (
              <div className="flex items-center justify-center gap-3 rounded-xl border border-black bg-neutral-100 p-4 text-sm font-semibold text-black">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-black border-t-transparent" />
                <span>Memproses inferensi HQCNN dan mengekstrak Grad-CAM...</span>
              </div>
            )}

            {error && (
              <div className="rounded-xl border-2 border-black bg-neutral-100 p-4 text-sm font-semibold text-black">
                <strong>Gagal:</strong> {error}
              </div>
            )}
          </section>

          <section id="hasil" className="scroll-mt-24 space-y-6">
            <div className="border-b border-neutral-200 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Langkah 2</span>
              <h2 className="text-2xl font-bold tracking-tight text-black">
                Hasil Prediksi & Visualisasi Explainable AI
              </h2>
              <p className="mt-1 text-xs text-neutral-600">
                Hasil inferensi jaringan hibrida kuantum, probabilitas per kelas,
                visualisasi Grad-CAM, dan interpretasi pendukung keputusan klinis.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <PredictionResultCard result={result} />

              <div className="flex flex-col gap-6">
                <InterpretationBox
                  text={result?.interpretation}
                  loading={interpreting}
                />

                {interpretError && (
                  <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
                    <strong>Gemini AI:</strong> {interpretError}
                  </div>
                )}

                {result?.interpretation && !interpreting && (
                  <ClinicalChatbot result={result} />
                )}
              </div>
            </div>

            <GradCAMViewer
              originalUrl={preview}
              overlayUrl={result?.gradcam_overlay_b64}
            />
          </section>

        </div>

        <div hidden={page !== "history"} aria-label="History" className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
          <section id="riwayat" className="scroll-mt-24 space-y-4">
            <div className="flex flex-col gap-2 border-b border-neutral-200 pb-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Langkah 3</span>
                <h2 className="text-2xl font-bold tracking-tight text-black">
                  Riwayat Rekam Pemeriksaan
                </h2>
                <p className="mt-1 text-xs text-neutral-600">
                  {supabaseConfigured
                    ? "Tersinkronisasi secara persisten dengan database Cloud Supabase."
                    : "Tersimpan pada memori sesi server lokal (Dapat dihubungkan ke Supabase kapan saja)."}
                </p>
              </div>
            </div>

            <HistoryTable rows={history} />
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
