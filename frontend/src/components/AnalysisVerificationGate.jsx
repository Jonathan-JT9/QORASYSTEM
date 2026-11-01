import { ShieldAlert, ShieldCheck, Lock, ArrowRight, RefreshCw, CheckCircle2, AlertTriangle, FileText, ArrowLeft, Clock } from "lucide-react";
import { useState } from "react";
import { getDoctorVerificationStatus } from "../services/auth.js";

export default function AnalysisVerificationGate({
  currentUser,
  onOpenCredentials,
  onRefresh,
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState("");

  const statusInfo = getDoctorVerificationStatus(currentUser);
  const profile = currentUser?.profile || {};
  const status = statusInfo.status;

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshMsg("");
    try {
      if (onRefresh) {
        await onRefresh();
        setRefreshMsg("Status akun berhasil diperiksa.");
      }
    } catch {
      setRefreshMsg("Gagal memeriksa status. Coba beberapa saat lagi.");
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  }

  const { hasStr, hasSip, hasAllDocuments } = statusInfo;

  return (
    <div className="qora-container py-8 max-w-4xl mx-auto animate-fadeIn">
      <div className="rounded-2xl border border-neutral-300 bg-white p-6 sm:p-10 shadow-xl space-y-8 text-neutral-900">
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 border-b border-neutral-200 pb-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-black text-white shadow-md">
              <Lock size={24} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="rounded border border-black bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">
                  Verifikasi Dokter
                </span>
                {statusInfo.verificationState === "incomplete" ? (
                  <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    <AlertTriangle size={11} /> Dokumen Belum Lengkap
                  </span>
                ) : statusInfo.verificationState === "pending" ? (
                  <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    <Clock size={11} /> Menunggu Verifikasi
                  </span>
                ) : statusInfo.verificationState === "rejected" ? (
                  <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">
                    <AlertTriangle size={11} /> Dokumen Perlu Perbaikan
                  </span>
                ) : null}
              </div>

              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-black">
                Akses Analisis & Klasifikasi Terkunci
              </h1>
            </div>
          </div>
        </div>

        {/* Missing Documents Alert */}
        {statusInfo.verificationState === "incomplete" && (
          <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-4 text-xs sm:text-sm text-amber-950 space-y-2">
            <div className="font-bold flex items-center gap-2 text-amber-900">
              <ShieldAlert size={16} className="text-amber-700 flex-shrink-0" />
              <span>Dokumen Wajib yang Belum Lengkap:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 pl-2 text-xs text-amber-900">
              {!hasStr && (
                <li>
                  <strong>STR (Surat Tanda Registrasi):</strong> Belum diserahkan atau berkas belum diunggah.
                </li>
              )}
              {!hasSip && (
                <li>
                  <strong>SIP (Surat Izin Praktik):</strong> Belum diserahkan atau berkas belum diunggah.
                </li>
              )}
            </ul>
            <p className="text-xs text-amber-800 pt-1">
              Silakan klik tombol <strong>Lengkapi Dokumen</strong> di bawah untuk mengunggah dokumen yang masih kurang.
            </p>
          </div>
        )}

        {/* Pending Approval Notice */}
        {statusInfo.verificationState === "pending" && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-xs sm:text-sm text-amber-950 space-y-1.5">
            <div className="font-bold flex items-center gap-2 text-amber-900">
              <Clock size={16} className="text-amber-700 flex-shrink-0" />
              <span>Menunggu Verifikasi Dokumen</span>
            </div>
            <p className="text-xs text-amber-900 leading-relaxed">
              Dokumen kredensial Anda telah berhasil dikirim dan sedang menunggu pemeriksaan oleh Administrator. Akses ke modul <strong>Analisis &amp; Klasifikasi</strong> akan terbuka secara otomatis segera setelah Administrator menyetujui akun Anda.
            </p>
          </div>
        )}

        {/* Rejection Notice */}
        {statusInfo.verificationState === "rejected" && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs sm:text-sm text-red-950 space-y-1.5">
            <div className="font-bold flex items-center gap-2 text-red-900">
              <AlertTriangle size={16} className="text-red-700 flex-shrink-0" />
              <span>Pengajuan Dokumen Perlu Perbaikan</span>
            </div>
            <p className="text-xs text-red-900 leading-relaxed">
              Catatan Administrator: {statusInfo.rejectionReason || profile.rejection_reason || "Dokumen kredensial tidak memenuhi kriteria verifikasi."} Silakan perbarui dan ajukan ulang berkas Anda.
            </p>
          </div>
        )}

        {/* Document Status Checklist Cards */}
        <div className="space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 block">
            Status Persyaratan Dokumen & Kredensial
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Card STR */}
            <div className={`rounded-xl border p-4 space-y-2 transition ${hasStr ? "border-emerald-200 bg-emerald-50/40" : "border-neutral-300 bg-neutral-50"}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                  <FileText size={15} />
                  <span>1. Surat Tanda Registrasi (STR)</span>
                </span>
                {hasStr ? (
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    <CheckCircle2 size={11} /> Lengkap
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    <AlertTriangle size={11} /> Belum Ada
                  </span>
                )}
              </div>

              <div className="text-xs text-neutral-600 space-y-0.5 pt-1">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Nomor:</span>
                  <span className="font-mono font-medium text-neutral-900">{profile.str_number || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Masa Berlaku:</span>
                  <span>{profile.str_expiry || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Berkas Fisik/Digital:</span>
                  <span className={profile.str_document_path ? "text-emerald-700 font-medium" : "text-neutral-400"}>
                    {profile.str_document_path ? "Terunggah" : "Belum diunggah"}
                  </span>
                </div>
              </div>
            </div>

            {/* Card SIP */}
            <div className={`rounded-xl border p-4 space-y-2 transition ${hasSip ? "border-emerald-200 bg-emerald-50/40" : "border-neutral-300 bg-neutral-50"}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                  <FileText size={15} />
                  <span>2. Surat Izin Praktik (SIP)</span>
                </span>
                {hasSip ? (
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    <CheckCircle2 size={11} /> Lengkap
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    <AlertTriangle size={11} /> Belum Ada
                  </span>
                )}
              </div>

              <div className="text-xs text-neutral-600 space-y-0.5 pt-1">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Nomor:</span>
                  <span className="font-mono font-medium text-neutral-900">{profile.sip_number || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Masa Berlaku:</span>
                  <span>{profile.sip_expiry || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Berkas Fisik/Digital:</span>
                  <span className={profile.sip_document_path ? "text-emerald-700 font-medium" : "text-neutral-400"}>
                    {profile.sip_document_path ? "Terunggah" : "Belum diunggah"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {refreshMsg && (
          <div className="rounded-lg border border-neutral-300 bg-neutral-50 p-2.5 text-xs text-neutral-700">
            {refreshMsg}
          </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-neutral-200">
          <a
            href="#/home"
            className="flex items-center justify-center gap-1.5 rounded-xl border border-neutral-300 px-4 py-2.5 text-xs font-semibold text-neutral-700 hover:border-black hover:text-black transition"
          >
            <ArrowLeft size={14} />
            <span>Kembali ke Beranda</span>
          </a>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-neutral-100 px-4 py-2.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-200 transition disabled:opacity-50"
            >
              <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
              <span>{refreshing ? "Memeriksa…" : "Periksa Status"}</span>
            </button>

            <button
              type="button"
              onClick={onOpenCredentials}
              className="flex items-center gap-2 rounded-xl bg-black px-5 py-2.5 text-xs font-bold text-white hover:bg-neutral-800 transition shadow-sm"
            >
              <span>
                {statusInfo.verificationState === "pending"
                  ? "Lihat Status Pengajuan"
                  : statusInfo.verificationState === "rejected"
                  ? "Perbaiki Dokumen"
                  : "Lengkapi Dokumen (STR & SIP)"}
              </span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
