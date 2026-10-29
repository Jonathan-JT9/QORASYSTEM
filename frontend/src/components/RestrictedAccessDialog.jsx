import { useEffect, useRef, useState } from "react";
import {
  Clock,
  AlertTriangle,
  Lock,
  LogOut,
  RefreshCw,
  FileText,
  FileCheck2,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Building,
  Stethoscope,
} from "lucide-react";

export default function RestrictedAccessDialog({
  currentUser,
  onOpenCredentials,
  onRefresh,
  onLogout,
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState("");
  const dialogRef = useRef(null);

  const status = currentUser?.status || "pending";
  const profile = currentUser?.profile || {};

  // Check if documents have been submitted:
  // If status is pending and no STR document or STR number is recorded, doctor hasn't submitted yet.
  const hasSubmittedDocuments = Boolean(
    profile.str_document_path || profile.str_number
  );

  let stateType = "incomplete";
  if (status === "rejected") {
    stateType = "rejected";
  } else if (status === "suspended") {
    stateType = "suspended";
  } else if (status === "pending" && hasSubmittedDocuments) {
    stateType = "pending_review";
  } else {
    stateType = "incomplete";
  }

  // Prevent background scrolling and trap focus
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus first button in dialog
    const focusable = dialogRef.current?.querySelectorAll(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable && focusable.length > 0) {
      focusable[0].focus();
    }

    function handleKeyDown(e) {
      if (e.key === "Tab" && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshMessage("");
    try {
      if (onRefresh) {
        await onRefresh();
        setRefreshMessage("Status akun berhasil diperbarui.");
      }
    } catch {
      setRefreshMessage("Gagal memperbarui status. Silakan coba lagi.");
    } finally {
      setTimeout(() => {
        setRefreshing(false);
      }, 500);
    }
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      });
    } catch {
      return dateStr;
    }
  }

  const submissionDate = profile.updated_at || profile.created_at;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="restricted-dialog-title"
      aria-describedby="restricted-dialog-desc"
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-xl rounded-2xl border border-neutral-300 bg-white p-6 sm:p-8 shadow-2xl space-y-6 text-neutral-900"
      >
        {/* Top Header Badge & Close Note */}
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-5">
          <div className="flex items-start gap-3.5">
            {stateType === "incomplete" && (
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-neutral-300 bg-neutral-100 text-neutral-800">
                <FileText size={22} strokeWidth={2} />
              </div>
            )}
            {stateType === "pending_review" && (
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-amber-300 bg-amber-50 text-amber-700">
                <Clock size={22} strokeWidth={2} />
              </div>
            )}
            {stateType === "rejected" && (
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-red-300 bg-red-50 text-red-700">
                <AlertTriangle size={22} strokeWidth={2} />
              </div>
            )}
            {stateType === "suspended" && (
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-neutral-300 bg-neutral-100 text-neutral-700">
                <Lock size={22} strokeWidth={2} />
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 mb-1">
                {stateType === "incomplete" && (
                  <span className="inline-flex items-center gap-1 rounded border border-neutral-300 bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-700">
                    <ShieldAlert size={11} /> Dokumen Belum Lengkap
                  </span>
                )}
                {stateType === "pending_review" && (
                  <span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                    <Clock size={11} /> Menunggu Verifikasi Administrator
                  </span>
                )}
                {stateType === "rejected" && (
                  <span className="inline-flex items-center gap-1 rounded border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-800">
                    <AlertTriangle size={11} /> Perlu Perbaikan / Ditolak
                  </span>
                )}
                {stateType === "suspended" && (
                  <span className="inline-flex items-center gap-1 rounded border border-neutral-300 bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-800">
                    <Lock size={11} /> Akun Ditangguhkan
                  </span>
                )}
              </div>

              <h2
                id="restricted-dialog-title"
                className="text-lg sm:text-xl font-bold tracking-tight text-black"
              >
                {stateType === "incomplete" && "Lengkapi Dokumen Kredensial Medis"}
                {stateType === "pending_review" && "Kredensial Sedang Ditinjau"}
                {stateType === "rejected" && "Dokumen Kredensial Perlu Diperbaiki"}
                {stateType === "suspended" && "Akses Akun Dinonaktifkan Sementara"}
              </h2>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[11px] font-mono text-neutral-500 block">
              {currentUser?.username}
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-600 block">
              Peran: Dokter
            </span>
          </div>
        </div>

        {/* Informative Description */}
        <div id="restricted-dialog-desc" className="text-xs sm:text-sm text-neutral-600 leading-relaxed space-y-3">
          {stateType === "incomplete" && (
            <p>
              Akun Anda telah berhasil dibuat. Sesuai regulasi standar keselamatan
              klinis di <strong>QORA</strong>, Anda wajib melengkapi data Surat
              Tanda Registrasi (STR) aktif dan informasi tempat praktik sebelum
              dapat mengakses modul klasifikasi radiograf toraks HQCNN dan fitur klinis lainnya.
            </p>
          )}

          {stateType === "pending_review" && (
            <p>
              Dokumen kredensial Anda telah diterima dan sedang dalam tahap
              pemeriksaan keabsahan oleh Administrator rumah sakit / sistem. Selama
              proses peninjauan berlangsung, akses ruang kerja klinis dibatasi
              sementara demi keamanan data medis.
            </p>
          )}

          {stateType === "rejected" && (
            <p>
              Pengajuan dokumen kredensial Anda belum dapat disetujui oleh
              Administrator. Silakan periksa catatan revisi di bawah ini dan
              perbarui data atau unggah ulang berkas STR/SIP yang sesuai.
            </p>
          )}

          {stateType === "suspended" && (
            <p>
              Akses akun dokter Anda sedang ditangguhkan oleh Administrator.
              Fitur analisis citra, interpretasi, dan riwayat klinis dinonaktifkan.
              Silakan hubungi administrator faskes Anda untuk memulihkan akses.
            </p>
          )}
        </div>

        {/* Context / Details Box */}
        {stateType === "pending_review" && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-2.5 text-xs text-neutral-800">
            <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
              <span className="font-semibold text-amber-950 flex items-center gap-1.5">
                <FileCheck2 size={14} className="text-amber-700" />
                Data Pengajuan
              </span>
              <span className="text-[11px] font-mono text-amber-900">
                Diajukan: {formatDateTime(submissionDate)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-neutral-700">
              <div>
                <span className="text-neutral-500 block text-[11px]">Spesialisasi:</span>
                <span className="font-semibold text-neutral-900">
                  {profile.specialty || "Belum ditentukan"}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[11px]">Nomor STR:</span>
                <span className="font-mono font-semibold text-neutral-900">
                  {profile.str_number || "-"}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[11px]">Instansi Praktik:</span>
                <span className="font-semibold text-neutral-900">
                  {profile.institution || "-"}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[11px]">Status Berkas STR:</span>
                <span className="text-emerald-700 font-semibold inline-flex items-center gap-1">
                  <CheckCircle2 size={12} /> Berkas Terunggah
                </span>
              </div>
            </div>
          </div>
        )}

        {stateType === "rejected" && (
          <div className="rounded-xl border border-red-200 bg-red-50/70 p-4 space-y-2 text-xs">
            <span className="font-bold uppercase tracking-wider text-red-800 block text-[11px]">
              Alasan Administrator:
            </span>
            <p className="text-sm font-medium text-red-950 bg-white/70 rounded-lg p-2.5 border border-red-200">
              {profile.rejection_reason ||
                "Dokumen atau informasi kredensial yang diajukan tidak memenuhi persyaratan verifikasi."}
            </p>
          </div>
        )}

        {refreshMessage && (
          <div className="rounded-lg border border-neutral-300 bg-neutral-50 p-2.5 text-xs text-neutral-700">
            {refreshMessage}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-neutral-200">
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-neutral-300 px-4 py-2.5 text-xs font-semibold text-neutral-700 hover:border-black hover:text-black transition"
          >
            <LogOut size={14} />
            <span>Keluar dari Sesi</span>
          </button>

          <div className="flex flex-wrap items-center justify-end gap-2.5">
            {/* If pending or rejected or suspended: option to refresh status */}
            {(stateType === "pending_review" ||
              stateType === "rejected" ||
              stateType === "suspended") && (
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-neutral-100 px-4 py-2.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-200 transition disabled:opacity-50"
              >
                <RefreshCw
                  size={13}
                  className={refreshing ? "animate-spin" : ""}
                />
                <span>
                  {refreshing ? "Memeriksa…" : "Periksa Status"}
                </span>
              </button>
            )}

            {/* Primary Action Button */}
            {stateType === "incomplete" && (
              <button
                type="button"
                onClick={onOpenCredentials}
                className="flex items-center gap-2 rounded-xl bg-black px-5 py-2.5 text-xs font-bold text-white hover:bg-neutral-800 transition shadow-sm"
              >
                <span>Lengkapi Dokumen</span>
                <ArrowRight size={14} />
              </button>
            )}

            {(stateType === "pending_review" || stateType === "rejected") && (
              <button
                type="button"
                onClick={onOpenCredentials}
                className="flex items-center gap-2 rounded-xl bg-black px-5 py-2.5 text-xs font-bold text-white hover:bg-neutral-800 transition shadow-sm"
              >
                <span>Perbarui Dokumen</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
