import { useState, useEffect, useRef } from "react";
import {
  FileText,
  Stethoscope,
  Building,
  Calendar,
  Upload,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  X,
  Shield,
  FileCheck,
  Clock,
  RefreshCw,
} from "lucide-react";
import {
  submitDoctorCredentials,
  saveDoctorProgress,
  getDoctorVerificationStatus,
} from "../services/auth.js";

const DEFAULT_SPECIALTIES = [
  "Radiologi (Sp.Rad)",
  "Pulmonologi dan Kedokteran Respirasi (Sp.P)",
  "Lainnya",
];

export default function DoctorCredentialModal({
  isOpen,
  onClose,
  currentUser,
  onSuccess,
  onRefresh,
  initialStep = 1,
}) {
  const profile = currentUser?.profile || {};
  const statusInfo = getDoctorVerificationStatus(currentUser);
  const { verificationState, rejectionReason } = statusInfo;

  const [step, setStep] = useState(initialStep); // 1: STR, 2: Tempat Praktik & SIP, 3: Ringkasan
  const [isEditing, setIsEditing] = useState(false);

  // Step 1: STR state
  const initialSpecialty = profile.specialty || "Radiologi (Sp.Rad)";
  const isCustomInitial =
    initialSpecialty &&
    initialSpecialty !== "Radiologi (Sp.Rad)" &&
    initialSpecialty !== "Pulmonologi dan Kedokteran Respirasi (Sp.P)";

  const [specialtyChoice, setSpecialtyChoice] = useState(
    isCustomInitial ? "Lainnya" : initialSpecialty
  );
  const [customSpecialty, setCustomSpecialty] = useState(
    isCustomInitial ? initialSpecialty : ""
  );

  const [strNumber, setStrNumber] = useState(profile.str_number || "");
  const [strExpiry, setStrExpiry] = useState(profile.str_expiry || "");
  const [strFile, setStrFile] = useState(null);
  const [existingStrPath, setExistingStrPath] = useState(
    profile.str_document_path || ""
  );

  // Step 2: Practice & SIP state
  const [institution, setInstitution] = useState(profile.institution || "");
  const [sipNumber, setSipNumber] = useState(profile.sip_number || "");
  const [sipExpiry, setSipExpiry] = useState(profile.sip_expiry || "");
  const [sipFile, setSipFile] = useState(null);
  const [existingSipPath, setExistingSipPath] = useState(
    profile.sip_document_path || ""
  );

  // Step 3: Confirmation
  const [confirmedTruth, setConfirmedTruth] = useState(false);

  const [loading, setLoading] = useState(false);
  const [savingProgress, setSavingProgress] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNotice, setRefreshNotice] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const modalRef = useRef(null);

  // Tentukan tampilan status
  const isPendingState = verificationState === "pending";
  const isApprovedState = verificationState === "approved";
  const isRejectedState = verificationState === "rejected";

  const showPendingView = isPendingState && !isEditing;
  const showApprovedView = isApprovedState && !isEditing;
  const showRejectedView = isRejectedState && !isEditing;
  const showStatusOverview =
    showPendingView || showApprovedView || showRejectedView;

  // Sync state when modal is opened or user changes
  useEffect(() => {
    if (isOpen) {
      const p = currentUser?.profile || {};
      const spec = p.specialty || "Radiologi (Sp.Rad)";
      const isCustom =
        spec &&
        spec !== "Radiologi (Sp.Rad)" &&
        spec !== "Pulmonologi dan Kedokteran Respirasi (Sp.P)";
      setSpecialtyChoice(isCustom ? "Lainnya" : spec);
      setCustomSpecialty(isCustom ? spec : "");
      setStrNumber(p.str_number || "");
      setStrExpiry(p.str_expiry || "");
      setExistingStrPath(p.str_document_path || "");
      setInstitution(p.institution || "");
      setSipNumber(p.sip_number || "");
      setSipExpiry(p.sip_expiry || "");
      setExistingSipPath(p.sip_document_path || "");
      setErrorMsg("");
      setSaveSuccessMsg("");
      setRefreshNotice("");
      setConfirmedTruth(false);

      const vInfo = getDoctorVerificationStatus(currentUser);
      if (vInfo.verificationState === "incomplete") {
        setIsEditing(true);
        if (initialStep) {
          setStep(initialStep);
        } else if (
          (p.str_number || p.str_document_path) &&
          !(p.sip_number || p.sip_document_path)
        ) {
          setStep(2);
        } else {
          setStep(1);
        }
      } else {
        setIsEditing(false);
        setStep(3);
      }
    }
  }, [isOpen, currentUser, initialStep]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && isOpen && !loading) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const resolvedSpecialty =
    specialtyChoice === "Lainnya"
      ? customSpecialty.trim()
      : specialtyChoice;

  const hasStrDocument = Boolean(
    strNumber.trim() || strFile || existingStrPath || profile.str_document_path
  );
  const hasSipDocument = Boolean(
    sipNumber.trim() || sipFile || existingSipPath || profile.sip_document_path
  );

  function handleFileChange(e, type) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg(
        `Ukuran berkas ${type.toUpperCase()} melebihi batas maksimal 10 MB.`
      );
      return;
    }

    setErrorMsg("");
    if (type === "str") {
      setStrFile(file);
    } else {
      setSipFile(file);
    }
  }

  function handleNextStep1(e) {
    e.preventDefault();
    setErrorMsg("");

    if (specialtyChoice === "Lainnya" && !customSpecialty.trim()) {
      setErrorMsg("Mohon sebutkan spesialisasi medis Anda.");
      return;
    }

    if (!strNumber.trim()) {
      setErrorMsg("Nomor STR (Surat Tanda Registrasi) wajib diisi.");
      return;
    }

    if (!strExpiry) {
      setErrorMsg("Masa berlaku STR wajib diisi.");
      return;
    }

    if (!strFile && !existingStrPath) {
      setErrorMsg("Berkas STR fisik/digital wajib diunggah.");
      return;
    }

    setStep(2);
  }

  function handleNextStep2(e) {
    e.preventDefault();
    setErrorMsg("");

    if (!institution.trim()) {
      setErrorMsg("Nama instansi/rumah sakit tempat praktik wajib diisi.");
      return;
    }

    setStep(3);
  }

  async function handleSaveProgress() {
    setErrorMsg("");
    setSaveSuccessMsg("");
    setSavingProgress(true);

    try {
      const updatedProfile = await saveDoctorProgress({
        specialty: resolvedSpecialty,
        strNumber,
        strExpiry,
        strFile,
        institution,
        sipNumber,
        sipExpiry,
        sipFile,
      });

      if (updatedProfile?.str_document_path) {
        setExistingStrPath(updatedProfile.str_document_path);
        setStrFile(null);
      }
      if (updatedProfile?.sip_document_path) {
        setExistingSipPath(updatedProfile.sip_document_path);
        setSipFile(null);
      }

      setSaveSuccessMsg("Progres kredensial berhasil disimpan ke database.");
      if (onSuccess) {
        await onSuccess();
      }
    } catch (err) {
      console.error("Gagal menyimpan progres:", err);
      setErrorMsg(err.message || "Gagal menyimpan progres kredensial.");
    } finally {
      setSavingProgress(false);
    }
  }

  async function handleSubmitFinal(e) {
    e.preventDefault();
    setErrorMsg("");

    if (!confirmedTruth) {
      setErrorMsg(
        "Mohon centang pernyataan keabsahan dokumen sebelum mengirim."
      );
      return;
    }

    if (!hasStrDocument && !hasSipDocument) {
      setErrorMsg(
        "Mohon lengkapi setidaknya dokumen STR atau SIP sebelum menyimpan."
      );
      return;
    }

    setLoading(true);

    try {
      await submitDoctorCredentials({
        specialty: resolvedSpecialty,
        strNumber,
        strExpiry,
        strFile,
        institution,
        sipNumber,
        sipExpiry,
        sipFile,
      });

      setIsEditing(false);
      if (onSuccess) {
        await onSuccess();
      }
    } catch (err) {
      setErrorMsg(err.message || "Gagal menyimpan berkas kredensial.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckStatus() {
    if (!onRefresh) return;
    setRefreshing(true);
    setRefreshNotice("");
    try {
      await onRefresh();
      setRefreshNotice("Status akun berhasil diperbarui.");
    } catch {
      setRefreshNotice("Gagal memeriksa status terkini.");
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="credential-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto"
    >
      <div
        ref={modalRef}
        className="w-full max-w-2xl rounded-2xl border border-neutral-300 bg-white p-6 shadow-2xl space-y-5 my-8 text-neutral-900"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-neutral-200 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded border border-black bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">
                Kredensial Dokter
              </span>
              {showPendingView ? (
                <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                  <Clock size={11} /> Menunggu Verifikasi
                </span>
              ) : showApprovedView ? (
                <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  <CheckCircle2 size={11} /> Terverifikasi
                </span>
              ) : showRejectedView ? (
                <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">
                  <AlertTriangle size={11} /> Perlu Perbaikan
                </span>
              ) : (
                <span className="text-xs text-neutral-500 font-medium">
                  Langkah {step} dari 3
                </span>
              )}
            </div>

            <h2
              id="credential-modal-title"
              className="text-lg font-bold text-black sm:text-xl"
            >
              {showPendingView && "Menunggu Verifikasi Dokumen"}
              {showApprovedView && "Dokumen Kredensial Terverifikasi"}
              {showRejectedView && "Pengajuan Kredensial Perlu Perbaikan"}
              {!showStatusOverview && (
                <>
                  {step === 1 && "Kredensial STR Dokter"}
                  {step === 2 && "Tempat Praktik & Kredensial SIP"}
                  {step === 3 && "Ringkasan & Konfirmasi Pengajuan"}
                </>
              )}
            </h2>

            <p className="text-xs text-neutral-600">
              {showPendingView &&
                "Dokumen kredensial Anda telah berhasil dikirim dan sedang menunggu pemeriksaan oleh Administrator."}
              {showApprovedView &&
                "Kredensial medis Anda telah disetujui oleh Administrator. Anda memiliki akses penuh ke fitur Analisis & Klasifikasi."}
              {showRejectedView &&
                "Pengajuan dokumen kredensial Anda belum dapat disetujui oleh Administrator. Silakan periksa catatan dan perbaiki dokumen."}
              {!showStatusOverview && (
                <>
                  {step === 1 &&
                    "Lengkapi spesialisasi medis dan data Surat Tanda Registrasi (STR) aktif."}
                  {step === 2 &&
                    "Lengkapi informasi instansi rumah sakit dan Surat Izin Praktik (jika ada)."}
                  {step === 3 &&
                    "Tinjau kembali berkas dan informasi sebelum dikirimkan ke Administrator."}
                </>
              )}
            </p>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            aria-label="Tutup formulir"
            className="text-neutral-400 hover:text-black transition p-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="grid grid-cols-3 gap-2">
          <div
            className={`h-1.5 rounded-full transition-all ${showStatusOverview || step >= 1 ? "bg-black" : "bg-neutral-200"
              }`}
          />
          <div
            className={`h-1.5 rounded-full transition-all ${showStatusOverview || step >= 2 ? "bg-black" : "bg-neutral-200"
              }`}
          />
          <div
            className={`h-1.5 rounded-full transition-all ${showStatusOverview || step >= 3 ? "bg-black" : "bg-neutral-200"
              }`}
          />
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-medium text-red-800"
          >
            <AlertTriangle size={15} className="flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Success Alert for Progress Saved */}
        {saveSuccessMsg && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-medium text-emerald-800"
          >
            <CheckCircle2 size={15} className="flex-shrink-0 text-emerald-600" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* VIEW 1: STATUS REVIEW OVERVIEW (PENDING / APPROVED / REJECTED) */}
        {showStatusOverview && (
          <div className="space-y-4">
            {/* Status Indicator Banner */}
            {showPendingView && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-amber-950 text-xs">
                  <Clock size={16} className="text-amber-700" />
                  <span>Status Pengajuan: Menunggu Verifikasi Administrator</span>
                </div>
                <p className="text-xs text-amber-900 leading-relaxed">
                  Dokumen kredensial Anda telah berhasil dikirim dan sedang dalam antrean pemeriksaan oleh Administrator. Akses ke modul <strong>Analisis &amp; Klasifikasi</strong> akan otomatis terbuka setelah dokumen Anda disetujui.
                </p>
              </div>
            )}

            {showApprovedView && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-emerald-950 text-xs">
                  <CheckCircle2 size={16} className="text-emerald-700" />
                  <span>Status Pengajuan: Terverifikasi (Disetujui)</span>
                </div>
                <p className="text-xs text-emerald-900 leading-relaxed">
                  Administrator telah menyetujui seluruh dokumen kredensial medis Anda. Akun Anda memiliki akses penuh ke fitur klasifikasi radiograf toraks, visualisasi Grad-CAM, dan interpretasi pendukung klinis.
                </p>
              </div>
            )}

            {showRejectedView && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-red-950 text-xs">
                  <AlertTriangle size={16} className="text-red-700 flex-shrink-0" />
                  <span>Catatan Penolakan dari Administrator:</span>
                </div>
                <p className="text-xs text-red-900 leading-relaxed font-medium pl-6">
                  {rejectionReason ||
                    "Dokumen STR/SIP tidak terbaca atau masa berlaku telah kedaluwarsa. Silakan periksa kembali berkas dan lakukan perbaikan."}
                </p>
              </div>
            )}

            {/* Ringkasan Data Dokumen Kredensial */}
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-700 border-b border-neutral-200 pb-2">
                <FileCheck size={15} />
                <span>Ringkasan Pengajuan Dokumen Kredensial</span>
              </div>

              <div className="grid gap-2.5 text-xs sm:grid-cols-2">
                <div>
                  <span className="text-neutral-500">Nama Dokter:</span>
                  <p className="font-semibold text-neutral-900 mt-0.5">
                    {profile.full_name || currentUser?.name || currentUser?.username}
                  </p>
                </div>

                <div>
                  <span className="text-neutral-500">Spesialisasi Medis:</span>
                  <p className="font-semibold text-neutral-900 mt-0.5">
                    {profile.specialty || resolvedSpecialty || "-"}
                  </p>
                </div>

                <div>
                  <span className="text-neutral-500">Instansi Tempat Praktik:</span>
                  <p className="font-semibold text-neutral-900 mt-0.5">
                    {profile.institution || institution || "-"}
                  </p>
                </div>

                <div className="sm:col-span-2 border-t border-neutral-200 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Status STR */}
                  <div className="rounded-lg border border-neutral-200 bg-white p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-neutral-900">1. Dokumen STR</span>
                      {hasStrDocument ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          <CheckCircle2 size={11} /> Lengkap
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                          <AlertTriangle size={11} /> Belum Ada
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-neutral-700">
                      Nomor: {strNumber || profile.str_number || "-"}
                    </p>
                    <p className="text-[11px] text-neutral-600">
                      Masa Berlaku: {strExpiry || profile.str_expiry || "-"}
                    </p>
                    <p className="text-[11px] text-neutral-600 truncate">
                      Berkas:{" "}
                      {strFile
                        ? strFile.name
                        : existingStrPath || profile.str_document_path
                          ? "Dokumen terlampir"
                          : "Belum diunggah"}
                    </p>
                  </div>

                  {/* Status SIP */}
                  <div className="rounded-lg border border-neutral-200 bg-white p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-neutral-900">2. Dokumen SIP</span>
                      {hasSipDocument ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          <CheckCircle2 size={11} /> Lengkap
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                          <AlertTriangle size={11} /> Belum Ada
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-neutral-700">
                      Nomor: {sipNumber || profile.sip_number || "-"}
                    </p>
                    <p className="text-[11px] text-neutral-600">
                      Masa Berlaku: {sipExpiry || profile.sip_expiry || "-"}
                    </p>
                    <p className="text-[11px] text-neutral-600 truncate">
                      Berkas:{" "}
                      {sipFile
                        ? sipFile.name
                        : existingSipPath || profile.sip_document_path
                          ? "Dokumen terlampir"
                          : "Belum diunggah"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {refreshNotice && (
              <div className="rounded-lg border border-neutral-300 bg-neutral-50 p-2 text-xs text-neutral-700">
                {refreshNotice}
              </div>
            )}

            {/* Action Controls for Status Overview */}
            <div className="flex items-center justify-between pt-3 border-t border-neutral-200">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition"
              >
                Tutup
              </button>

              <div className="flex items-center gap-2">
                {showPendingView && (
                  <button
                    type="button"
                    onClick={handleCheckStatus}
                    disabled={refreshing}
                    className="flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-neutral-100 px-4 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-200 transition disabled:opacity-50"
                  >
                    <RefreshCw
                      size={13}
                      className={refreshing ? "animate-spin" : ""}
                    />
                    <span>{refreshing ? "Memeriksa…" : "Periksa Status"}</span>
                  </button>
                )}

                {showApprovedView && (
                  <a
                    href="#/analysis"
                    onClick={onClose}
                    className="flex items-center gap-1.5 rounded-xl bg-black px-5 py-2 text-xs font-bold text-white hover:bg-neutral-800 transition"
                  >
                    <span>Buka Analisis</span>
                    <ArrowRight size={14} />
                  </a>
                )}

                {showRejectedView && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(true);
                      setStep(1);
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-black px-5 py-2 text-xs font-bold text-white hover:bg-neutral-800 transition"
                  >
                    <span>Perbaiki Dokumen</span>
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 1: KREDENSIAL STR */}
        {!showStatusOverview && step === 1 && (
          <form onSubmit={handleNextStep1} className="space-y-4">
            {/* Spesialisasi */}
            <div className="qora-field">
              <label htmlFor="modal-specialty-select">
                Spesialisasi Medis
              </label>
              <div className="qora-input-wrap">
                <Stethoscope size={16} />
                <select
                  id="modal-specialty-select"
                  value={specialtyChoice}
                  onChange={(e) => setSpecialtyChoice(e.target.value)}
                  className="w-full bg-transparent text-xs text-neutral-900 outline-none cursor-pointer"
                >
                  {DEFAULT_SPECIALTIES.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Input Spesialisasi Tambahan jika memilih 'Lainnya' */}
            {specialtyChoice === "Lainnya" && (
              <div className="qora-field pl-2 border-l-2 border-neutral-300">
                <label htmlFor="modal-custom-specialty">
                  Sebutkan Spesialisasi Medis Anda
                </label>
                <div className="qora-input-wrap">
                  <Stethoscope size={16} />
                  <input
                    id="modal-custom-specialty"
                    type="text"
                    required
                    value={customSpecialty}
                    onChange={(e) => setCustomSpecialty(e.target.value)}
                    placeholder="Contoh: Penyakit Dalam (Sp.PD) / Kedokteran Umum"
                  />
                </div>
                <small className="text-[11px] text-neutral-500 mt-1 block">
                  Semua dokter dapat mengajukan akun; spesialisasi digunakan untuk
                  peninjauan administrator, bukan penolakan otomatis.
                </small>
              </div>
            )}

            {/* Nomor STR & Masa Berlaku */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="qora-field">
                <label htmlFor="modal-str-num">
                  Nomor STR (Wajib)
                </label>
                <div className="qora-input-wrap">
                  <FileText size={16} />
                  <input
                    id="modal-str-num"
                    type="text"
                    required
                    value={strNumber}
                    onChange={(e) => setStrNumber(e.target.value)}
                    placeholder="Contoh: 31.1.1.100.1.20.123456"
                  />
                </div>
              </div>

              <div className="qora-field">
                <label htmlFor="modal-str-exp">
                  Masa Berlaku STR (Wajib)
                </label>
                <div className="qora-input-wrap">
                  <Calendar size={16} />
                  <input
                    id="modal-str-exp"
                    type="date"
                    required
                    value={strExpiry}
                    onChange={(e) => setStrExpiry(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Unggah Berkas STR */}
            <div className="qora-field">
              <label>
                Unggah Berkas STR (Wajib PDF / Foto STR Asli)
              </label>
              <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50/80 p-4 hover:bg-neutral-100/70 transition">
                <label
                  htmlFor="modal-str-file"
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600">
                      <Upload size={16} />
                    </div>
                    <div>
                      <strong className="text-xs text-neutral-900 block">
                        {strFile
                          ? strFile.name
                          : existingStrPath
                            ? "Dokumen STR sudah terlampir (Klik untuk mengganti)"
                            : "Pilih file STR dokter (PDF / Gambar)"}
                      </strong>
                      <span className="text-[11px] text-neutral-500">
                        {strFile
                          ? `${(strFile.size / 1024).toFixed(0)} KB · Siap diunggah`
                          : "Format: PDF, PNG, JPG, JPEG (Maks. 10 MB)"}
                      </span>
                    </div>
                  </div>

                  <span className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 text-center">
                    {strFile || existingStrPath ? "Ganti Berkas" : "Pilih Berkas"}
                  </span>
                </label>
                <input
                  id="modal-str-file"
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/jpg"
                  hidden
                  onChange={(e) => handleFileChange(e, "str")}
                />
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-3 border-t border-neutral-200">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition"
              >
                Nanti Saja
              </button>

              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-xl bg-black px-4 py-2 text-xs font-bold text-white hover:bg-neutral-800 transition"
              >
                <span>Lanjut ke Tempat Praktik &amp; SIP</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: TEMPAT PRAKTIK & SIP */}
        {!showStatusOverview && step === 2 && (
          <form onSubmit={handleNextStep2} className="space-y-4">
            {/* Instansi / Rumah Sakit */}
            <div className="qora-field">
              <label htmlFor="modal-inst">
                Instansi / Rumah Sakit Tempat Praktik (Wajib)
              </label>
              <div className="qora-input-wrap">
                <Building size={16} />
                <input
                  id="modal-inst"
                  type="text"
                  required
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="Contoh: RSUP Prof. Dr. R. D. Kandou Manado"
                />
              </div>
            </div>

            {/* Nomor SIP & Masa Berlaku SIP */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="qora-field">
                <label htmlFor="modal-sip-num">
                  Nomor SIP (Wajib untuk Akses Analisis)
                </label>
                <div className="qora-input-wrap">
                  <FileText size={16} />
                  <input
                    id="modal-sip-num"
                    type="text"
                    value={sipNumber}
                    onChange={(e) => setSipNumber(e.target.value)}
                    placeholder="Nomor Surat Izin Praktik"
                  />
                </div>
              </div>

              <div className="qora-field">
                <label htmlFor="modal-sip-exp">
                  Masa Berlaku SIP (Wajib untuk Akses Analisis)
                </label>
                <div className="qora-input-wrap">
                  <Calendar size={16} />
                  <input
                    id="modal-sip-exp"
                    type="date"
                    value={sipExpiry}
                    onChange={(e) => setSipExpiry(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Unggah Berkas SIP */}
            <div className="qora-field">
              <label>
                Unggah Berkas SIP (Wajib untuk Akses Analisis)
              </label>
              <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50/80 p-4 hover:bg-neutral-100/70 transition">
                <label
                  htmlFor="modal-sip-file"
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600">
                      <Upload size={16} />
                    </div>
                    <div>
                      <strong className="text-xs text-neutral-900 block">
                        {sipFile
                          ? sipFile.name
                          : existingSipPath
                            ? "Dokumen SIP sudah terlampir (Klik untuk mengganti)"
                            : "Pilih file SIP dokter (PDF / Gambar)"}
                      </strong>
                      <span className="text-[11px] text-neutral-500">
                        {sipFile
                          ? `${(sipFile.size / 1024).toFixed(0)} KB · Siap diunggah`
                          : "Format: PDF, PNG, JPG, JPEG (Maks. 10 MB)"}
                      </span>
                    </div>
                  </div>

                  <span className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 text-center">
                    {sipFile || existingSipPath ? "Ganti Berkas" : "Pilih Berkas"}
                  </span>
                </label>
                <input
                  id="modal-sip-file"
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/jpg"
                  hidden
                  onChange={(e) => handleFileChange(e, "sip")}
                />
              </div>
            </div>

            {/* Navigation */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-neutral-200">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 rounded-xl border border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition"
              >
                <ArrowLeft size={14} />
                <span>Kembali ke STR</span>
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: RINGKASAN & KONFIRMASI (SUBMISSION FORM) */}
        {!showStatusOverview && step === 3 && (
          <form onSubmit={handleSubmitFinal} className="space-y-4">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-700 border-b border-neutral-200 pb-2">
                <FileCheck size={15} />
                <span>Ringkasan Pengajuan Dokumen Kredensial</span>
              </div>

              <div className="grid gap-2.5 text-xs sm:grid-cols-2">
                <div>
                  <span className="text-neutral-500">Nama Dokter:</span>
                  <p className="font-semibold text-neutral-900 mt-0.5">
                    {currentUser?.name || currentUser?.username}
                  </p>
                </div>

                <div>
                  <span className="text-neutral-500">Spesialisasi Medis:</span>
                  <p className="font-semibold text-neutral-900 mt-0.5">
                    {resolvedSpecialty || "-"}
                  </p>
                </div>

                <div>
                  <span className="text-neutral-500">Instansi Tempat Praktik:</span>
                  <p className="font-semibold text-neutral-900 mt-0.5">
                    {institution || "-"}
                  </p>
                </div>

                <div className="sm:col-span-2 border-t border-neutral-200 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Status STR */}
                  <div className="rounded-lg border border-neutral-200 bg-white p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-neutral-900">1. Dokumen STR</span>
                      {hasStrDocument ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          <CheckCircle2 size={11} /> Lengkap
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                          <AlertTriangle size={11} /> Belum Ada
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-neutral-700">
                      Nomor: {strNumber || "-"}
                    </p>
                    <p className="text-[11px] text-neutral-600">
                      Masa Berlaku: {strExpiry || "-"}
                    </p>
                    <p className="text-[11px] text-neutral-600 truncate">
                      Berkas:{" "}
                      {strFile
                        ? strFile.name
                        : existingStrPath
                          ? "Dokumen terlampir"
                          : "Belum diunggah"}
                    </p>
                  </div>

                  {/* Status SIP */}
                  <div className="rounded-lg border border-neutral-200 bg-white p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-neutral-900">2. Dokumen SIP</span>
                      {hasSipDocument ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          <CheckCircle2 size={11} /> Lengkap
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                          <AlertTriangle size={11} /> Belum Ada
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-neutral-700">
                      Nomor: {sipNumber || "-"}
                    </p>
                    <p className="text-[11px] text-neutral-600">
                      Masa Berlaku: {sipExpiry || "-"}
                    </p>
                    <p className="text-[11px] text-neutral-600 truncate">
                      Berkas:{" "}
                      {sipFile
                        ? sipFile.name
                        : existingSipPath
                          ? "Dokumen terlampir"
                          : "Belum diunggah"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Warning if either document is missing */}
            {(!hasStrDocument || !hasSipDocument) && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-amber-950">
                  <AlertTriangle size={14} className="text-amber-700" />
                  <span>Perhatian: Dokumen Kredensial Belum Lengkap</span>
                </div>
                <p>
                  Anda tetap dapat menyimpan berkas yang ada sekarang. Namun, modul{" "}
                  <strong>Analisis &amp; Klasifikasi</strong> akan tetap{" "}
                  <strong>terkunci</strong> hingga kedua dokumen (STR dan SIP)
                  dilengkapi dan disetujui Administrator.
                </p>
              </div>
            )}

            {/* Checkbox Keabsahan Data */}
            <label className="flex items-start gap-2.5 rounded-xl border border-neutral-300 p-3 text-xs text-neutral-700 cursor-pointer hover:bg-neutral-50 transition">
              <input
                type="checkbox"
                required
                checked={confirmedTruth}
                onChange={(e) => setConfirmedTruth(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-neutral-300 accent-black cursor-pointer"
              />
              <span>
                Saya menyatakan dengan sungguh-sungguh bahwa data kredensial medis
                dan berkas dokumen yang saya serahkan adalah sah, aktif, dan sesuai
                dengan ketentuan hukum dan profesi kedokteran yang berlaku.
              </span>
            </label>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-3 border-t border-neutral-200">
              <button
                type="button"
                disabled={loading}
                onClick={() => setStep(2)}
                className="flex items-center gap-1.5 rounded-xl border border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition disabled:opacity-50"
              >
                <ArrowLeft size={14} />
                <span>Kembali</span>
              </button>

              <button
                type="submit"
                disabled={loading || !confirmedTruth}
                className="flex items-center gap-2 rounded-xl bg-black px-5 py-2 text-xs font-bold text-white hover:bg-neutral-800 transition disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="qora-processing-spinner" />
                    <span>Menyimpan Dokumen…</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} />
                    <span>Kirim Dokumen Kredensial</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
