
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
import AdminDashboard from "./components/AdminDashboard.jsx";
import RestrictedAccessDialog from "./components/RestrictedAccessDialog.jsx";
import DoctorCredentialModal from "./components/DoctorCredentialModal.jsx";
import AnalysisVerificationGate from "./components/AnalysisVerificationGate.jsx";
import {
  fetchApiHistory,
  getHealth,
  predictCxr,
  interpretCxr,
} from "./services/api.js";
import {
  fetchExamHistory,
  insertExamHistory,
  supabase,
  supabaseConfigured,
} from "./services/supabase.js";
import { getCurrentUser, signOut, getDoctorVerificationStatus } from "./services/auth.js";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Clock3,
  Layers,
  LogOut,
  ScanLine,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  AlertTriangle,
} from "lucide-react";

function getPage() {
  switch (window.location.hash) {
    case "#/analysis":
    case "#/classification":
    case "#analisis":
    case "#hasil":
      return "analysis";
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

function LogoutConfirmationDialog({ onCancel, onConfirm, loggingOut }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    dialogRef.current?.focus();
    function handleKeyDown(event) {
      if (event.key === "Escape" && !loggingOut) onCancel();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loggingOut, onCancel]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-fadeIn"
      onClick={(event) => {
        if (event.target === event.currentTarget && !loggingOut) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-dialog-title"
        aria-describedby="logout-dialog-description"
        tabIndex={-1}
        className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-6 shadow-2xl sm:p-8"
      >
        <div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl border border-neutral-200 bg-neutral-50 text-neutral-800">
          <LogOut size={20} />
        </div>
        <h2
          id="logout-dialog-title"
          className="text-xl font-bold tracking-tight text-neutral-900"
        >
          Konfirmasi Logout
        </h2>
        <p
          id="logout-dialog-description"
          className="mt-2 text-sm leading-relaxed text-neutral-600"
        >
          Apakah Anda yakin ingin keluar dari akun?
        </p>
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loggingOut}
            className="qora-button qora-button-light disabled:cursor-not-allowed disabled:opacity-60"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loggingOut}
            className="qora-button qora-button-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut size={15} />
            {loggingOut ? "Sedang logout..." : "Ya, Logout"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
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
  const [credentialModalOpen, setCredentialModalOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const replacementFileInput = useRef(null);
  const requestId = useRef(0);

  const refreshUser = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      setCurrentUser(user);
    } catch {
      setCurrentUser(null);
    } finally {
      setAuthChecking(false);
    }
  }, []);

  const handleLogout = useCallback(() => {
    setLogoutConfirmOpen(true);
  }, []);

  const confirmLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await signOut();
      setCurrentUser(null);
      setLogoutConfirmOpen(false);
    } finally {
      setLoggingOut(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();

    if (supabase) {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event) => {
        if (
          event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED" ||
          event === "USER_UPDATED"
        ) {
          const user = await getCurrentUser();
          setCurrentUser(user);
        } else if (event === "SIGNED_OUT") {
          setCurrentUser(null);
        }
      });

      return () => subscription?.unsubscribe();
    }
  }, [refreshUser]);

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
    if (currentUser?.role === "doctor" && currentUser?.status !== "approved") {
      setHistory([]);
      return;
    }
    try {
      if (supabaseConfigured) {
        setHistory(await fetchExamHistory());
      } else {
        setHistory(await fetchApiHistory());
      }
    } catch {
      setHistory(await fetchApiHistory().catch(() => []));
    }
  }, [currentUser]);

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
    if (currentUser?.role === "doctor" && !isDoctorVerified) {
      setError(
        "Akses analisis dibatasi. Dokter wajib melengkapi dokumen STR dan SIP serta diverifikasi sebelum menggunakan fitur klasifikasi."
      );
      setCredentialModalOpen(true);
      return;
    }

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

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#fbfbf9] flex flex-col items-center justify-center text-center p-6">
        <img
          src="/tiny-logo.png"
          alt="QORA"
          className="h-10 w-10 mb-4 animate-pulse"
        />
        <span className="qora-processing-spinner" />
        <span className="text-xs font-semibold text-neutral-600 mt-3">
          Memverifikasi sesi kredensial QORA…
        </span>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LandingPage
        health={health}
        onLoginSuccess={(user) => setCurrentUser(user)}
      />
    );
  }

  // 1. Role Administrator: akses langsung ke Admin Dashboard
  if (currentUser.role === "admin") {
    return (
      <>
        <AdminDashboard currentUser={currentUser} onLogout={handleLogout} />
        {logoutConfirmOpen && (
          <LogoutConfirmationDialog
            onCancel={() => setLogoutConfirmOpen(false)}
            onConfirm={confirmLogout}
            loggingOut={loggingOut}
          />
        )}
      </>
    );
  }

  // 2. Role Dokter: periksa verifikasi dokumen kredensial (STR & SIP)
  const doctorVerification = getDoctorVerificationStatus(currentUser);
  const isDoctor = doctorVerification.isDoctor;
  const isDoctorVerified = doctorVerification.isVerified;
  const isDoctorSuspended = isDoctor && doctorVerification.verificationState === "suspended";

  const tbCount = history.filter(
    (row) => (row.label || row.predicted_label) === "TB",
  ).length;

  const normalCount = history.filter(
    (row) => (row.label || row.predicted_label) === "Normal",
  ).length;

  const online = Boolean(health?.ok);

  return (
    <div
      className={`qora-app min-h-screen text-neutral-900 selection:bg-black selection:text-white ${isDoctorSuspended ? "overflow-hidden h-screen" : ""
        }`}
    >
      {/* Background Clinical Workspace (Blurred & Disabled only when suspended) */}
      <div
        className={isDoctorSuspended ? "qora-workspace-restricted" : undefined}
        aria-hidden={isDoctorSuspended ? true : undefined}
        inert={isDoctorSuspended ? "" : undefined}
      >
        <Header
          health={health}
          page={page}
          currentUser={currentUser}
          onLogout={handleLogout}
          onOpenCredentials={() => setCredentialModalOpen(true)}
        />

        <main className="qora-main">
          {/* HOME */}
          <div hidden={page !== "home"} className="qora-home-view">
            {/* Banner Status Verifikasi Dokter */}
            {isDoctor && !isDoctorVerified && (
              <div className="qora-container pt-4">
                <div className="rounded-2xl border border-neutral-300 bg-white p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-black text-white">
                      {doctorVerification.verificationState === "pending" ? (
                        <Clock size={20} />
                      ) : doctorVerification.verificationState === "rejected" ? (
                        <AlertTriangle size={20} />
                      ) : (
                        <ShieldAlert size={20} />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-bold text-neutral-900">
                          {doctorVerification.verificationState === "pending"
                            ? "Status Kredensial: Menunggu Verifikasi Dokumen"
                            : doctorVerification.verificationState === "rejected"
                            ? "Status Kredensial: Pengajuan Perlu Perbaikan"
                            : "Verifikasi Kredensial Medis Diperlukan"}
                        </span>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            doctorVerification.verificationState === "pending"
                              ? "bg-amber-100 text-amber-800"
                              : doctorVerification.verificationState === "rejected"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {doctorVerification.verificationState === "pending"
                            ? "Menunggu Verifikasi Admin"
                            : doctorVerification.verificationState === "rejected"
                            ? "Ditolak Admin"
                            : "Dokumen Belum Lengkap"}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-600">
                        {doctorVerification.verificationState === "pending"
                          ? "Dokumen kredensial Anda telah berhasil dikirim dan sedang menunggu pemeriksaan oleh Administrator."
                          : doctorVerification.verificationState === "rejected"
                          ? `Catatan Administrator: ${doctorVerification.rejectionReason || "Dokumen belum memenuhi kriteria."} Silakan perbarui dan ajukan ulang.`
                          : "Lengkapi dan unggah dokumen STR serta SIP Anda agar Administrator dapat memverifikasi akun Anda untuk akses Analisis."}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setCredentialModalOpen(true)}
                      className="flex items-center gap-1.5 rounded-xl bg-black px-4 py-2 text-xs font-bold text-white hover:bg-neutral-800 transition"
                    >
                      <span>
                        {doctorVerification.verificationState === "pending"
                          ? "Lihat Status Pengajuan"
                          : doctorVerification.verificationState === "rejected"
                          ? "Perbaiki Dokumen"
                          : "Lengkapi Dokumen"}
                      </span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )}

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
                      href="#/analysis"
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

          {/* ANALYSIS / CLASSIFICATION */}
          <div
            hidden={page !== "analysis"}
            aria-label="Analysis"
            className="qora-container qora-page-content"
          >
            {isDoctor && !isDoctorVerified ? (
              <AnalysisVerificationGate
                currentUser={currentUser}
                onOpenCredentials={() => setCredentialModalOpen(true)}
                onRefresh={refreshUser}
              />
            ) : (
              <>
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
                        <strong>Memproses analisis radiograf</strong>
                        <span>
                          Validasi Gemini Vision & CLIP, inferensi HQCNN, dan Grad-CAM…
                        </span>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="qora-inline-error" role="alert">
                      <strong>Validasi atau analisis tidak dapat dilanjutkan</strong>
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
              </>
            )}
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
                  href="#/analysis"
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

      {/* Foreground Suspended Access Dialog (Only when account is suspended) */}
      {isDoctorSuspended && !credentialModalOpen && (
        <RestrictedAccessDialog
          currentUser={currentUser}
          onOpenCredentials={() => setCredentialModalOpen(true)}
          onRefresh={refreshUser}
          onLogout={handleLogout}
        />
      )}

      {/* Multi-Step Doctor Credential Submission Modal */}
      <DoctorCredentialModal
        isOpen={credentialModalOpen}
        onClose={() => setCredentialModalOpen(false)}
        currentUser={currentUser}
        onRefresh={refreshUser}
        onSuccess={async () => {
          await refreshUser();
        }}
      />

      {logoutConfirmOpen && (
        <LogoutConfirmationDialog
          onCancel={() => setLogoutConfirmOpen(false)}
          onConfirm={confirmLogout}
          loggingOut={loggingOut}
        />
      )}
    </div>
  );
}
