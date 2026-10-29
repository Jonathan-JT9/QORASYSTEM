import { useState } from "react";
import {
  Clock,
  AlertTriangle,
  Lock,
  LogOut,
  RefreshCw,
  FileText,
  Upload,
  CheckCircle2,
  ExternalLink,
  Shield,
  Stethoscope,
  Building,
} from "lucide-react";
import { getDocumentSignedUrl, uploadDoctorDocument } from "../services/auth.js";
import { supabase } from "../services/supabase.js";

export default function DoctorStatusScreen({
  currentUser,
  onLogout,
  onRefresh,
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingStr, setUploadingStr] = useState(false);
  const [uploadingSip, setUploadingSip] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploadErr, setUploadErr] = useState("");

  const status = currentUser?.status || "pending";
  const profile = currentUser?.profile || {};

  async function handleRefreshClick() {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setRefreshing(false), 600);
    }
  }

  async function handleOpenDoc(path) {
    if (!path) return;
    try {
      const url = await getDocumentSignedUrl(path);
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      alert(err.message || "Gagal membuka dokumen.");
    }
  }

  async function handleUploadDoc(e, type) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadMsg("");
    setUploadErr("");

    const isStr = type === "str";
    if (isStr) setUploadingStr(true);
    else setUploadingSip(true);

    try {
      const path = await uploadDoctorDocument({
        file,
        type,
        userId: currentUser.id,
      });

      const updateField =
        type === "str" ? "str_document_path" : "sip_document_path";

      const { error } = await supabase
        .from("profiles")
        .update({ [updateField]: path })
        .eq("id", currentUser.id);

      if (error) throw error;

      setUploadMsg(
        `Dokumen ${type.toUpperCase()} berhasil diunggah. Menunggu verifikasi admin.`
      );
      await onRefresh();
    } catch (err) {
      setUploadErr(err.message || `Gagal mengunggah dokumen ${type.toUpperCase()}.`);
    } finally {
      if (isStr) setUploadingStr(false);
      else setUploadingSip(false);
      e.target.value = "";
    }
  }

  return (
    <div className="qora-auth min-h-screen bg-[#fbfbf9] text-neutral-900 flex flex-col justify-between">
      {/* Header Bar */}
      <header className="border-b border-neutral-200 bg-white/80 backdrop-blur px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/tiny-logo.png" alt="QORA" className="h-7 w-7" />
            <span className="font-bold tracking-tight text-black text-lg">
              QORA
            </span>
            <span className="rounded border border-neutral-300 bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold tracking-wider text-neutral-700 uppercase">
              Verifikasi Dokter
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-neutral-600 hidden sm:inline">
              Masuk sebagai:{" "}
              <strong className="text-black">
                {currentUser?.name || currentUser?.username}
              </strong>
            </span>
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:border-black hover:text-black transition"
            >
              <LogOut size={14} />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto my-auto w-full max-w-3xl p-6 py-12">
        {status === "pending" && (
          <div className="space-y-6 rounded-2xl border border-neutral-300 bg-white p-8 shadow-sm">
            <div className="flex items-start gap-4 border-b border-neutral-200 pb-6">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-amber-300 bg-amber-50 text-amber-700">
                <Clock size={26} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                    Menunggu Verifikasi Kredensial
                  </span>
                </div>
                <h1 className="text-xl font-bold tracking-tight text-black sm:text-2xl">
                  Pendaftaran Dokter Sedang Ditinjau
                </h1>
                <p className="text-sm text-neutral-600 leading-relaxed">
                  Terima kasih telah mendaftar di sistem <strong>QORA</strong>.
                  Akun Anda dan berkas kredensial medis sedang menunggu
                  peninjauan serta persetujuan oleh Administrator sebelum akses
                  ke workspace analisis radiograf toraks HQCNN dapat diberikan.
                </p>
              </div>
            </div>

            {uploadMsg && (
              <div className="flex items-center gap-2 rounded-xl border border-green-300 bg-green-50 p-4 text-xs font-medium text-green-800">
                <CheckCircle2 size={16} />
                <span>{uploadMsg}</span>
              </div>
            )}

            {uploadErr && (
              <div className="flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 p-4 text-xs font-medium text-red-800">
                <AlertTriangle size={16} />
                <span>{uploadErr}</span>
              </div>
            )}

            {/* Credential Details Card */}
            <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                <div className="flex items-center gap-2 text-xs font-bold text-neutral-800 uppercase tracking-wider">
                  <Shield size={14} />
                  <span>Rincian Kredensial Medis Terdaftar</span>
                </div>
                <span className="text-[11px] font-mono text-neutral-500">
                  ID: {currentUser.id.substring(0, 8)}…
                </span>
              </div>

              <div className="grid gap-3 text-xs sm:grid-cols-2">
                <div>
                  <span className="text-neutral-500">Nama Lengkap:</span>
                  <p className="font-semibold text-neutral-900 mt-0.5">
                    {profile.full_name || currentUser.name}
                  </p>
                </div>

                <div>
                  <span className="text-neutral-500">Spesialisasi Medis:</span>
                  <p className="font-semibold text-neutral-900 mt-0.5 flex items-center gap-1.5">
                    <Stethoscope size={13} className="text-neutral-600" />
                    {profile.specialty || "Belum ditentukan"}
                  </p>
                </div>

                <div>
                  <span className="text-neutral-500">Nomor STR:</span>
                  <p className="font-semibold font-mono text-neutral-900 mt-0.5">
                    {profile.str_number || "-"}
                  </p>
                </div>

                <div>
                  <span className="text-neutral-500">Masa Berlaku STR:</span>
                  <p className="font-semibold text-neutral-900 mt-0.5">
                    {profile.str_expiry || "-"}
                  </p>
                </div>

                <div>
                  <span className="text-neutral-500">Instansi / Faskes Praktik:</span>
                  <p className="font-semibold text-neutral-900 mt-0.5 flex items-center gap-1.5">
                    <Building size={13} className="text-neutral-600" />
                    {profile.institution || "-"}
                  </p>
                </div>

                <div>
                  <span className="text-neutral-500">Nomor SIP:</span>
                  <p className="font-semibold font-mono text-neutral-900 mt-0.5">
                    {profile.sip_number || "Belum disertakan"}
                  </p>
                </div>
              </div>

              {/* Document upload / check state */}
              <div className="border-t border-neutral-200 pt-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <FileText size={15} className="text-neutral-600" />
                    <span className="font-semibold text-neutral-900">
                      Dokumen STR:
                    </span>
                    {profile.str_document_path ? (
                      <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                        <CheckCircle2 size={13} /> Terunggah
                      </span>
                    ) : (
                      <span className="text-amber-700 font-medium">
                        Belum diunggah
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {profile.str_document_path && (
                      <button
                        type="button"
                        onClick={() => handleOpenDoc(profile.str_document_path)}
                        className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-800 hover:border-black transition"
                      >
                        <ExternalLink size={12} />
                        Lihat Berkas
                      </button>
                    )}

                    <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-800 hover:border-black transition">
                      <Upload size={12} />
                      <span>
                        {uploadingStr
                          ? "Mengunggah…"
                          : profile.str_document_path
                          ? "Ganti STR"
                          : "Unggah STR"}
                      </span>
                      <input
                        type="file"
                        accept=".pdf,image/png,image/jpeg,image/jpg"
                        hidden
                        disabled={uploadingStr}
                        onChange={(e) => handleUploadDoc(e, "str")}
                      />
                    </label>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <FileText size={15} className="text-neutral-600" />
                    <span className="font-semibold text-neutral-900">
                      Dokumen SIP:
                    </span>
                    {profile.sip_document_path ? (
                      <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                        <CheckCircle2 size={13} /> Terunggah
                      </span>
                    ) : (
                      <span className="text-neutral-500">Opsional / Belum ada</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {profile.sip_document_path && (
                      <button
                        type="button"
                        onClick={() => handleOpenDoc(profile.sip_document_path)}
                        className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-800 hover:border-black transition"
                      >
                        <ExternalLink size={12} />
                        Lihat Berkas
                      </button>
                    )}

                    <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-800 hover:border-black transition">
                      <Upload size={12} />
                      <span>
                        {uploadingSip
                          ? "Mengunggah…"
                          : profile.sip_document_path
                          ? "Ganti SIP"
                          : "Unggah SIP"}
                      </span>
                      <input
                        type="file"
                        accept=".pdf,image/png,image/jpeg,image/jpg"
                        hidden
                        disabled={uploadingSip}
                        onChange={(e) => handleUploadDoc(e, "sip")}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <button
                type="button"
                onClick={handleRefreshClick}
                disabled={refreshing}
                className="qora-button qora-button-dark"
              >
                <RefreshCw
                  size={15}
                  className={refreshing ? "animate-spin" : ""}
                />
                <span>
                  {refreshing ? "Memeriksa Status…" : "Periksa Status Persetujuan"}
                </span>
              </button>

              <button
                type="button"
                onClick={onLogout}
                className="text-xs font-semibold text-neutral-600 hover:text-black transition"
              >
                Keluar dari sesi
              </button>
            </div>
          </div>
        )}

        {status === "rejected" && (
          <div className="space-y-6 rounded-2xl border border-red-300 bg-white p-8 shadow-sm">
            <div className="flex items-start gap-4 border-b border-red-200 pb-6">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-red-300 bg-red-50 text-red-700">
                <AlertTriangle size={26} />
              </div>
              <div className="space-y-1">
                <span className="rounded border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-800">
                  Pendaftaran Ditolak
                </span>
                <h1 className="text-xl font-bold tracking-tight text-black sm:text-2xl">
                  Pendaftaran Belum Dapat Disetujui
                </h1>
                <p className="text-sm text-neutral-600 leading-relaxed">
                  Mohon maaf, pendaftaran akun dokter Anda tidak dapat disetujui
                  oleh Administrator setelah pemeriksaan berkas kredensial.
                </p>
              </div>
            </div>

            {profile.rejection_reason && (
              <div className="rounded-xl border border-red-200 bg-red-50/70 p-5 space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-red-800">
                  Alasan Penolakan:
                </span>
                <p className="text-sm text-red-950 font-medium">
                  {profile.rejection_reason}
                </p>
              </div>
            )}

            <p className="text-xs text-neutral-500 leading-relaxed">
              Jika Anda merasa terdapat kekeliruan atau ingin memperbarui berkas
              STR / SIP yang valid, silakan hubungi tim administrasi rumah sakit
              atau administrator QORA.
            </p>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleRefreshClick}
                disabled={refreshing}
                className="flex items-center gap-2 rounded-xl border border-neutral-300 bg-neutral-100 px-4 py-2.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-200 transition"
              >
                <RefreshCw
                  size={14}
                  className={refreshing ? "animate-spin" : ""}
                />
                <span>Cek Ulang Status</span>
              </button>

              <button
                type="button"
                onClick={onLogout}
                className="qora-button qora-button-dark"
              >
                <LogOut size={15} />
                <span>Keluar</span>
              </button>
            </div>
          </div>
        )}

        {status === "suspended" && (
          <div className="space-y-6 rounded-2xl border border-neutral-300 bg-white p-8 shadow-sm">
            <div className="flex items-start gap-4 border-b border-neutral-200 pb-6">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-neutral-300 bg-neutral-100 text-neutral-700">
                <Lock size={26} />
              </div>
              <div className="space-y-1">
                <span className="rounded border border-neutral-300 bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-800">
                  Akun Ditangguhkan
                </span>
                <h1 className="text-xl font-bold tracking-tight text-black sm:text-2xl">
                  Akses Akun Dinonaktifkan Sementara
                </h1>
                <p className="text-sm text-neutral-600 leading-relaxed">
                  Akses akun Anda ke workspace klinis QORA telah ditangguhkan
                  oleh Administrator. Anda tidak dapat melakukan analisis citra
                  atau melihat riwayat pemeriksaan selama penangguhan aktif.
                </p>
              </div>
            </div>

            <p className="text-xs text-neutral-500 leading-relaxed">
              Silakan hubungi administrator institusi Anda untuk memulihkan status akun.
            </p>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleRefreshClick}
                disabled={refreshing}
                className="flex items-center gap-2 rounded-xl border border-neutral-300 bg-neutral-100 px-4 py-2.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-200 transition"
              >
                <RefreshCw
                  size={14}
                  className={refreshing ? "animate-spin" : ""}
                />
                <span>Cek Status</span>
              </button>

              <button
                type="button"
                onClick={onLogout}
                className="qora-button qora-button-dark"
              >
                <LogOut size={15} />
                <span>Keluar</span>
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="py-6 text-center text-xs text-neutral-500">
        © {new Date().getFullYear()} QORA Radiograph Analysis · Secure Role-Based Access Control
      </footer>
    </div>
  );
}
