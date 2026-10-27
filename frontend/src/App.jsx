
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
import {
  fetchApiHistory,
  getHealth,
  predictCxr,
  interpretCxr,
} from "./services/api.js";
import {
  fetchExamHistory,
  insertExamHistory,
  supabaseConfigured,
} from "./services/supabase.js";
import { getStoredUser, signOut } from "./services/auth.js";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  Layers,
  ScanLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

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

function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="qora-page-heading">
      <div>
        <div className="qora-eyebrow qora-eyebrow-muted">
          <span className="qora-eyebrow-mark" />
          {eyebrow}
        </div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action ? (
        <div className="qora-page-heading-action">{action}</div>
      ) : null}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, detail }) {
  return (
    <div className="qora-stat-card">
      <div className="qora-stat-icon">
        <Icon size={17} strokeWidth={1.8} />
      </div>
      <div className="qora-stat-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </div>
  );
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
  const [previewName, setPreviewName] = useState("");
  const [preview, setPreview] = useState("");
  const [history, setHistory] = useState([]);
  const replacementFileInput = useRef(null);
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
    setPreviewName(file.name);

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
        "Prediksi gagal dieksekusi",
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

      setResult((prev) => {
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
        "Interpretasi Gemini AI gagal.",
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
        onLoginSuccess={(user) => setCurrentUser(user)}
      />
    );
  }

  const tbCount = history.filter(
    (row) => (row.label || row.predicted_label) === "TB",
  ).length;

  const normalCount = history.filter(
    (row) => (row.label || row.predicted_label) === "Normal",
  ).length;

  const online = Boolean(health?.ok);

  return (
    <div className="qora-app min-h-screen text-neutral-900 selection:bg-black selection:text-white">
      <Header
        health={health}
        page={page}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      <main className="qora-main">
        {/* HOME */}
        <div hidden={page !== "home"} className="qora-home-view">
          <section className="qora-hero-section">
            <div className="qora-container qora-hero-grid">
              <div className="qora-hero-copy">
                <div className="qora-eyebrow">
                  <span className="qora-live-dot" />
                  Clinical imaging intelligence
                  <span className="qora-eyebrow-divider">/</span>
                  <span className="qora-eyebrow-sub">QORA · HQCNN</span>
                </div>

                <h1>
                  Quantum Optimized Radiograph Analysis
                </h1>

                <p className="qora-hero-description">
                  Satu ruang kerja untuk klasifikasi CXR, visualisasi Grad-CAM,
                  dan interpretasi pendukung klinis—dirancang agar setiap tahap
                  analisis terasa jelas, terstruktur, dan mudah ditinjau.
                </p>

                <div className="qora-hero-actions">
                  <a
                    href="#/classification"
                    className="qora-button qora-button-dark"
                  >
                    <ScanLine size={16} />
                    Mulai analisis
                    <ArrowRight size={16} />
                  </a>

                  <a
                    href="#edukasi"
                    className="qora-button qora-button-light"
                  >
                    <BookOpen size={16} />
                    Jelajahi edukasi CXR
                  </a>
                </div>
              </div>

              <div className="qora-hero-visual-wrap">
                <div className="qora-hero-visual">
                  <div className="qora-visual-topline">
                    <span>QORA / IMAGING WORKSPACE</span>
                    <span>01 — 03</span>
                  </div>

                  <div className="qora-xray-frame">
                    <img
                      src="/education-normal.png"
                      alt="Contoh radiograf toraks untuk tampilan referensi"
                    />
                    <div className="qora-xray-vignette" />
                    <div className="qora-xray-crosshair qora-crosshair-one" />
                    <div className="qora-xray-crosshair qora-crosshair-two" />

                    <div className="qora-xray-label qora-xray-label-top">
                      <span className="qora-label-dot" />
                      REFERENCE IMAGE
                    </div>

                    <div className="qora-xray-label qora-xray-label-bottom">
                      <span>CHEST</span>
                      <strong>PA / AP VIEW</strong>
                    </div>
                  </div>

                  <div className="qora-visual-footer">
                    <div>
                      <span className="qora-visual-overline">
                        IMAGING INTELLIGENCE
                      </span>
                      <strong>One image. A clearer workflow.</strong>
                    </div>
                    <div className="qora-visual-arrow">
                      <ArrowUpRight size={18} />
                    </div>
                  </div>
                </div>

                <div className="qora-floating-note qora-floating-note-top">
                  <span className="qora-floating-icon">
                    <Layers size={15} />
                  </span>
                  <span>
                    <strong>Explainable AI</strong>
                    <small>Grad-CAM visualization</small>
                  </span>
                </div>

                <div className="qora-floating-note qora-floating-note-bottom">
                  <span className="qora-floating-icon qora-floating-icon-dark">
                    <Sparkles size={15} />
                  </span>
                  <span>
                    <strong>Clinical summary</strong>
                    <small>AI-assisted interpretation</small>
                  </span>
                </div>
              </div>
            </div>
          </section>

          <CxrEducationSection />
        </div>

        {/* CLASSIFICATION */}
        <div
          hidden={page !== "classification"}
          aria-label="Classification"
          className="qora-container qora-page-content"
        >
          <PageHeading
            title="Chest X-Ray analysis"
            description="Unggah citra, tinjau hasil klasifikasi, lalu evaluasi penjelasan visual dan interpretasi pendukung klinis."
          />

          <div className="qora-workflow-steps" aria-label="Alur analisis">
            <div className="qora-workflow-step is-current">
              <span>01</span>
              <div>
                <strong>Upload image</strong>
                <small>Input radiograf</small>
              </div>
            </div>

            <div className="qora-workflow-connector" />

            <div className={`qora-workflow-step ${result ? "is-complete" : ""}`}>
              <span>
                {result ? <CheckCircle2 size={16} /> : "02"}
              </span>
              <div>
                <strong>Classification</strong>
                <small>Hybrid QCNN</small>
              </div>
            </div>

            <div className="qora-workflow-connector" />

            <div
              className={`qora-workflow-step ${result?.interpretation ? "is-complete" : ""
                }`}
            >
              <span>
                {result?.interpretation ? <CheckCircle2 size={16} /> : "03"}
              </span>
              <div>
                <strong>Clinical review</strong>
                <small>Grad-CAM & AI</small>
              </div>
            </div>
          </div>

          {/* CLASSIFICATION WORKSPACE SECTIONS */}
          <div className="qora-classification-sections">
            {/* 01 INPUT + 02 CLASSIFICATION RESULT */}
            <div className="qora-analysis-grid">
              <section className="qora-panel qora-upload-panel">
                <div className="qora-panel-heading">
                  <div>
                    <span className="qora-panel-number">01 / INPUT</span>
                    <h2>Upload radiograph</h2>
                    <p>Pilih citra Chest X-Ray untuk memulai inferensi.</p>
                  </div>
                  <span className="qora-panel-heading-icon">
                    <ScanLine size={18} />
                  </span>
                </div>


                {!preview ? (
                  <ImageUploadDropzone onFile={handleFile} disabled={busy} />
                ) : (
                  <div className={`qora-source-scan ${busy ? "is-scanning" : "is-complete"}`}>
                    <div className="qora-source-scan-toolbar">
                      <span>
                        <CheckCircle2 size={14} />
                        Source image
                      </span>
                      <span className="qora-source-scan-status">
                        <span className="qora-source-status-dot" />
                        {busy ? "SCANNING IMAGE" : "IMAGE LOADED"}
                      </span>
                    </div>

                    <div className="qora-source-scan-image">
                      <img
                        src={preview}
                        alt={`Source image: ${previewName}`}
                      />

                      <div className="qora-source-image-overlay" />

                      <div className="qora-source-scan-corner corner-tl" />
                      <div className="qora-source-scan-corner corner-tr" />
                      <div className="qora-source-scan-corner corner-bl" />
                      <div className="qora-source-scan-corner corner-br" />

                      {busy && (
                        <>
                          <div className="qora-source-scan-line" />
                          <div className="qora-source-scan-beam" />
                          <div className="qora-source-scan-label">
                            <span className="qora-source-status-dot" />
                            ANALYZING RADIOGRAPH
                          </div>
                        </>
                      )}

                      {!busy && (
                        <div className="qora-source-scan-ready">
                          <CheckCircle2 size={14} />
                          Source image ready
                        </div>
                      )}
                    </div>

                    <div className="qora-source-scan-footer">
                      <div className="qora-source-file-info">
                        <strong title={previewName}>{previewName}</strong>
                        <span>Chest X-Ray · Source image</span>
                      </div>

                      <button
                        type="button"
                        className="qora-source-replace-button"
                        disabled={busy}
                        onClick={() => replacementFileInput.current?.click()}
                      >
                        Ganti citra
                      </button>

                      <input
                        ref={replacementFileInput}
                        type="file"
                        accept="image/*,.dcm,.dicom"
                        hidden
                        disabled={busy}
                        onChange={(event) => {
                          const file = event.target.files?.[0];

                          if (file) {
                            handleFile(file);
                          }

                          event.target.value = "";
                        }}
                      />
                    </div>
                  </div>
                )}


                {busy && (
                  <div className="qora-processing-state" role="status">
                    <span className="qora-processing-spinner" />
                    <div>
                      <strong>Analyzing radiograph</strong>
                      <span>
                        Menjalankan inferensi HQCNN dan mengekstrak Grad-CAM…
                      </span>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="qora-inline-error" role="alert">
                    <strong>Analisis gagal</strong>
                    <span>{error}</span>
                  </div>
                )}
              </section>

              <section
                className="qora-results-column"
                aria-label="Hasil klasifikasi"
              >
                <div className="qora-panel qora-result-panel">
                  <div className="qora-panel-heading">
                    <div>
                      <span className="qora-panel-number">02 / OUTPUT</span>
                      <h2>Classification result</h2>
                      <p>Probabilitas prediksi dari model.</p>
                    </div>
                    <span className="qora-panel-heading-icon">
                      <Activity size={18} />
                    </span>
                  </div>

                  <PredictionResultCard result={result} />
                </div>
              </section>
            </div>

            {/* 03 CLINICAL INTERPRETATION + CHATBOT */}
            <section
              className={`qora-review-grid ${result?.interpretation && !interpreting
                ? "has-chatbot"
                : "is-single"
                }`}
              aria-label="Clinical review"
            >
              <section className="qora-panel qora-interpretation-panel qora-interpretation-section">
                <div className="qora-panel-heading">
                  <div>
                    <span className="qora-panel-number">
                      03 / INTERPRETATION
                    </span>
                    <h2>Clinical interpretation</h2>
                    <p>Ringkasan pendukung keputusan klinis.</p>
                  </div>
                  <span className="qora-panel-heading-icon">
                    <Sparkles size={18} />
                  </span>
                </div>

                <InterpretationBox
                  text={result?.interpretation}
                  loading={interpreting}
                />

                {interpretError && (
                  <div className="qora-inline-error" role="alert">
                    <strong>Interpretasi AI belum tersedia</strong>
                    <span>{interpretError}</span>
                  </div>
                )}
              </section>

              {result?.interpretation && !interpreting && (
                <section
                  className="qora-chatbot-section"
                  aria-label="Chatbot QORA"
                >
                  <ClinicalChatbot result={result} />
                </section>
              )}
            </section>

            {/* 04 GRAD-CAM */}
            <section className="qora-panel qora-gradcam-section">
              <div className="qora-panel-heading">
                <div>
                  <span className="qora-panel-number">
                    EXPLAINABLE AI / XAI
                  </span>
                  <h2>Attention map & image review</h2>
                  <p>
                    Bandingkan radiograf asli dengan visualisasi Grad-CAM dan
                    sesuaikan overlay interaktif.
                  </p>
                </div>
                <span className="qora-panel-heading-icon">
                  <Layers size={18} />
                </span>
              </div>

              <GradCAMViewer
                originalUrl={error ? null : preview}
                overlayUrl={error ? null : result?.gradcam_overlay_b64}
                error={error}
              />
            </section>
          </div>
          {/* End classification workspace sections */}
        </div>

        {/* HISTORY */}
        <div
          hidden={page !== "history"}
          aria-label="History"
          className="qora-container qora-page-content qora-history-page"
        >
          <PageHeading
            title="Examination history"
            description={
              supabaseConfigured
                ? "Riwayat pemeriksaan tersinkronisasi dengan database Supabase."
                : "Riwayat pemeriksaan dari sesi server yang tersedia."
            }
            action={
              <a
                href="#/classification"
                className="qora-button qora-button-dark"
              >
                <ScanLine size={15} />
                Analisis baru
                <ArrowRight size={15} />
              </a>
            }
          />

          <div className="qora-history-stats">
            <StatCard
              icon={Clock3}
              label="Total examinations"
              value={history.length}
              detail="Recorded sessions"
            />
            <StatCard
              icon={Activity}
              label="TB classification"
              value={tbCount}
              detail="Predicted label: TB"
            />
            <StatCard
              icon={ShieldCheck}
              label="Normal classification"
              value={normalCount}
              detail="Predicted label: Normal"
            />
            <StatCard
              icon={CheckCircle2}
              label="Storage status"
              value={supabaseConfigured ? "Synced" : "Local API"}
              detail={
                supabaseConfigured
                  ? "Supabase configured"
                  : "Fallback history source"
              }
            />
          </div>

          <section className="qora-panel qora-history-panel">
            <div className="qora-panel-heading">
              <div>
                <span className="qora-panel-number">SESSION ARCHIVE</span>
                <h2>Examination records</h2>
                <p>
                  Gunakan pencarian dan filter untuk meninjau hasil pemeriksaan
                  sebelumnya.
                </p>
              </div>
              <span className="qora-record-count">
                {history.length} records
              </span>
            </div>

            <HistoryTable rows={history} />
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
