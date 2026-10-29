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
} from "lucide-react";
import { submitDoctorCredentials } from "../services/auth.js";

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
}) {
  const profile = currentUser?.profile || {};

  const [step, setStep] = useState(1); // 1: STR, 2: Tempat Praktik & SIP, 3: Ringkasan

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
  const [errorMsg, setErrorMsg] = useState("");

  const modalRef = useRef(null);

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

  function handleFileChange(e, type) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: 10MB
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg(`Ukuran berkas ${type.toUpperCase()} melebihi batas maksimal 10 MB.`);
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

  async function handleSubmitFinal(e) {
    e.preventDefault();
    setErrorMsg("");

    if (!confirmedTruth) {
      setErrorMsg("Mohon centang pernyataan keabsahan dokumen sebelum mengirim.");
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

      if (onSuccess) {
        await onSuccess();
      }
    } catch (err) {
      setErrorMsg(err.message || "Gagal menyimpan berkas kredensial.");
    } finally {
      setLoading(false);
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
              <span className="text-xs text-neutral-500 font-medium">
                Langkah {step} dari 3
              </span>
            </div>
            <h2
              id="credential-modal-title"
              className="text-lg font-bold text-black sm:text-xl"
            >
              {step === 1 && "Kredensial STR Dokter"}
              {step === 2 && "Tempat Praktik & Kredensial SIP"}
              {step === 3 && "Ringkasan & Konfirmasi Pengajuan"}
            </h2>
            <p className="text-xs text-neutral-600">
              {step === 1 &&
                "Lengkapi spesialisasi medis dan data Surat Tanda Registrasi (STR) aktif."}
              {step === 2 &&
                "Lengkapi informasi instansi rumah sakit dan Surat Izin Praktik (jika ada)."}
              {step === 3 &&
                "Tinjau kembali berkas dan informasi sebelum dikirimkan ke Administrator."}
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
            className={`h-1.5 rounded-full transition-all ${
              step >= 1 ? "bg-black" : "bg-neutral-200"
            }`}
          />
          <div
            className={`h-1.5 rounded-full transition-all ${
              step >= 2 ? "bg-black" : "bg-neutral-200"
            }`}
          />
          <div
            className={`h-1.5 rounded-full transition-all ${
              step >= 3 ? "bg-black" : "bg-neutral-200"
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

        {/* STEP 1: KREDENSIAL STR */}
        {step === 1 && (
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
                Unggah Berkas STR (Wajib)
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
                          ? "Dokumen STR sudah ada (Klik untuk mengganti)"
                          : "Pilih file STR dokter"}
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
                Batal
              </button>

              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-xl bg-black px-4 py-2 text-xs font-bold text-white hover:bg-neutral-800 transition"
              >
                <span>Lanjut ke Tempat Praktik</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: TEMPAT PRAKTIK & SIP */}
        {step === 2 && (
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
                  placeholder="Contoh: RS Paru Dr. M. Goenawan / RSUP Persahabatan"
                />
              </div>
            </div>

            {/* Nomor SIP & Masa Berlaku (Opsional) */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="qora-field">
                <label htmlFor="modal-sip-num">
                  Nomor SIP (Opsional)
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
                  Masa Berlaku SIP (Opsional)
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

            {/* Unggah Berkas SIP (Opsional) */}
            <div className="qora-field">
              <label>
                Unggah Berkas SIP (Opsional)
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
                          ? "Dokumen SIP sudah ada"
                          : "Pilih file SIP jika tersedia (Opsional)"}
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
            <div className="flex items-center justify-between pt-3 border-t border-neutral-200">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 rounded-xl border border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition"
              >
                <ArrowLeft size={14} />
                <span>Kembali</span>
              </button>

              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-xl bg-black px-4 py-2 text-xs font-bold text-white hover:bg-neutral-800 transition"
              >
                <span>Tinjau Ringkasan</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: RINGKASAN & KONFIRMASI */}
        {step === 3 && (
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
                    {resolvedSpecialty}
                  </p>
                </div>

                <div>
                  <span className="text-neutral-500">Nomor STR:</span>
                  <p className="font-mono font-semibold text-neutral-900 mt-0.5">
                    {strNumber}
                  </p>
                </div>

                <div>
                  <span className="text-neutral-500">Masa Berlaku STR:</span>
                  <p className="font-semibold text-neutral-900 mt-0.5">
                    {strExpiry}
                  </p>
                </div>

                <div>
                  <span className="text-neutral-500">Berkas STR:</span>
                  <p className="font-medium text-emerald-800 mt-0.5 flex items-center gap-1">
                    <CheckCircle2 size={13} />
                    {strFile ? strFile.name : "Dokumen STR terlampir"}
                  </p>
                </div>

                <div>
                  <span className="text-neutral-500">Instansi / Rumah Sakit:</span>
                  <p className="font-semibold text-neutral-900 mt-0.5">
                    {institution}
                  </p>
                </div>

                <div>
                  <span className="text-neutral-500">Nomor SIP:</span>
                  <p className="font-mono text-neutral-900 mt-0.5">
                    {sipNumber || "Belum disertakan"}
                  </p>
                </div>

                <div>
                  <span className="text-neutral-500">Berkas SIP:</span>
                  <p className="text-neutral-700 mt-0.5">
                    {sipFile ? sipFile.name : existingSipPath ? "Dokumen SIP terlampir" : "Tidak ada"}
                  </p>
                </div>
              </div>
            </div>

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
                dan berkas STR yang saya unggah adalah sah, aktif, dan sesuai dengan
                ketentuan Konsil Kedokteran Indonesia (KKI).
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
