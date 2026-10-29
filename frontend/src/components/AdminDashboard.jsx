import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Search,
  ExternalLink,
  LogOut,
  RefreshCw,
  FileText,
  UserCheck,
  UserX,
  History,
  Building,
  Stethoscope,
  Filter,
  X,
  Shield,
} from "lucide-react";
import { supabase } from "../services/supabase.js";
import { getDocumentSignedUrl } from "../services/auth.js";

export default function AdminDashboard({ currentUser, onLogout }) {
  const [profiles, setProfiles] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [activeTab, setActiveTab] = useState("pending"); // pending | approved | rejected | suspended | all | audit
  const [search, setSearch] = useState("");

  // Approval modal state
  const [approvingDoctor, setApprovingDoctor] = useState(null);

  // Rejection modal state
  const [rejectingDoctor, setRejectingDoctor] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Suspend modal state
  const [suspendingDoctor, setSuspendingDoctor] = useState(null);

  const [actionLoading, setActionLoading] = useState(false);

  // Close modals on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && !actionLoading) {
        setApprovingDoctor(null);
        setRejectingDoctor(null);
        setSuspendingDoctor(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [actionLoading]);

  const fetchAdminData = useCallback(async () => {
    if (!supabase) return;
    setError("");

    try {
      // 1. Fetch all doctor profiles
      const { data: profData, error: profErr } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profErr) throw profErr;
      setProfiles(profData || []);

      // 2. Fetch audit logs
      const { data: logData, error: logErr } = await supabase
        .from("admin_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (!logErr && logData) {
        setAuditLogs(logData);
      }
    } catch (err) {
      console.error("Gagal memuat data admin:", err);
      setError(err.message || "Gagal memuat data dokter dari database.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchAdminData();
  }

  async function handleOpenDocument(docPath) {
    if (!docPath) {
      alert("Dokumen belum diunggah oleh dokter.");
      return;
    }
    try {
      const signedUrl = await getDocumentSignedUrl(docPath);
      if (signedUrl) {
        window.open(signedUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      alert(err.message || "Gagal membuka dokumen.");
    }
  }

  function openApproveModal(doctor) {
    setApprovingDoctor(doctor);
  }

  async function handleConfirmApprove() {
    if (!approvingDoctor) return;
    const doctor = approvingDoctor;

    setActionLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const now = new Date().toISOString();

      // 1. Update profile status
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({
          status: "approved",
          rejection_reason: null,
          reviewed_by: currentUser.id,
          reviewed_at: now,
        })
        .eq("id", doctor.id);

      if (updateErr) throw updateErr;

      // 2. Insert into audit logs
      await supabase.from("admin_audit_logs").insert({
        admin_id: currentUser.id,
        target_user_id: doctor.id,
        action:
          doctor.status === "rejected" || doctor.status === "suspended"
            ? "reinstate"
            : "approve",
        rejection_reason: null,
      });

      setSuccessMsg(
        `Dokter ${doctor.full_name || doctor.username} berhasil disetujui.`
      );
      setApprovingDoctor(null);
      await fetchAdminData();
    } catch (err) {
      setError(err.message || "Gagal menyetujui akun dokter.");
    } finally {
      setActionLoading(false);
    }
  }

  function openRejectModal(doctor) {
    setRejectingDoctor(doctor);
    setRejectionReason(
      "Dokumen STR / SIP tidak terbaca atau masa berlaku telah berakhir."
    );
  }

  async function handleConfirmReject(e) {
    e.preventDefault();
    if (!rejectingDoctor) return;

    setActionLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const now = new Date().toISOString();

      // 1. Update status to rejected
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({
          status: "rejected",
          rejection_reason: rejectionReason.trim() || null,
          reviewed_by: currentUser.id,
          reviewed_at: now,
        })
        .eq("id", rejectingDoctor.id);

      if (updateErr) throw updateErr;

      // 2. Insert into audit logs
      await supabase.from("admin_audit_logs").insert({
        admin_id: currentUser.id,
        target_user_id: rejectingDoctor.id,
        action: "reject",
        rejection_reason: rejectionReason.trim() || null,
      });

      setSuccessMsg(
        `Pendaftaran ${rejectingDoctor.full_name || rejectingDoctor.username} ditolak.`
      );
      setRejectingDoctor(null);
      await fetchAdminData();
    } catch (err) {
      setError(err.message || "Gagal menolak pendaftaran dokter.");
    } finally {
      setActionLoading(false);
    }
  }

  function openSuspendModal(doctor) {
    setSuspendingDoctor(doctor);
  }

  async function handleConfirmSuspend() {
    if (!suspendingDoctor) return;
    const doctor = suspendingDoctor;

    setActionLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const now = new Date().toISOString();

      const { error: updateErr } = await supabase
        .from("profiles")
        .update({
          status: "suspended",
          reviewed_by: currentUser.id,
          reviewed_at: now,
        })
        .eq("id", doctor.id);

      if (updateErr) throw updateErr;

      await supabase.from("admin_audit_logs").insert({
        admin_id: currentUser.id,
        target_user_id: doctor.id,
        action: "suspend",
      });

      setSuccessMsg(
        `Akun ${doctor.full_name || doctor.username} berhasil ditangguhkan.`
      );
      setSuspendingDoctor(null);
      await fetchAdminData();
    } catch (err) {
      setError(err.message || "Gagal menangguhkan akun.");
    } finally {
      setActionLoading(false);
    }
  }

  // Filter only doctor profiles (exclude other admins from review list)
  const doctorProfiles = useMemo(
    () => profiles.filter((p) => p.role === "doctor"),
    [profiles]
  );

  const pendingCount = doctorProfiles.filter((p) => p.status === "pending").length;
  const approvedCount = doctorProfiles.filter((p) => p.status === "approved").length;
  const rejectedCount = doctorProfiles.filter((p) => p.status === "rejected").length;
  const suspendedCount = doctorProfiles.filter((p) => p.status === "suspended").length;

  const filteredDoctors = useMemo(() => {
    return doctorProfiles.filter((doc) => {
      if (activeTab !== "all" && activeTab !== "audit") {
        if (doc.status !== activeTab) return false;
      }

      if (search.trim()) {
        const query = search.toLowerCase();
        const name = (doc.full_name || "").toLowerCase();
        const username = (doc.username || "").toLowerCase();
        const email = (doc.email || "").toLowerCase();
        const specialty = (doc.specialty || "").toLowerCase();
        const str = (doc.str_number || "").toLowerCase();
        const inst = (doc.institution || "").toLowerCase();

        return (
          name.includes(query) ||
          username.includes(query) ||
          email.includes(query) ||
          specialty.includes(query) ||
          str.includes(query) ||
          inst.includes(query)
        );
      }

      return true;
    });
  }, [doctorProfiles, activeTab, search]);

  return (
    <div className="min-h-screen bg-[#fbfbf9] text-neutral-900 flex flex-col justify-between selection:bg-black selection:text-white">
      {/* Top Header */}
      <header className="border-b border-neutral-200 bg-white sticky top-0 z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img src="/tiny-logo.png" alt="QORA" className="h-7 w-7" />
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-black text-lg">
                QORA
              </span>
              <span className="rounded bg-black px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                Admin Console
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-xs text-neutral-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>
                Admin:{" "}
                <strong className="text-black">
                  {currentUser?.name || currentUser?.username}
                </strong>
              </span>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              title="Perbarui data"
              className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:border-black hover:text-black transition"
            >
              <RefreshCw
                size={13}
                className={refreshing ? "animate-spin" : ""}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-200 transition"
            >
              <LogOut size={13} />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <div className="space-y-6">
          {/* Page Heading */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-neutral-200 pb-5">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                <span>Manajemen Hak Akses & Kredensial Dokter</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-black sm:text-3xl">
                Persetujuan Registrasi Dokter
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-neutral-600">
                Tinjau berkas STR & SIP pendaftar untuk memberikan izin akses ke
                sistem diagnosis radiograf toraks QORA.
              </p>
            </div>

            {pendingCount > 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-900">
                <Clock size={16} className="text-amber-700" />
                <span>{pendingCount} pendaftaran dokter menunggu tindakan</span>
              </div>
            )}
          </div>

          {/* Feedback Banners */}
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 p-4 text-xs font-medium text-red-800">
              <XCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-xs font-medium text-emerald-800">
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div
              onClick={() => setActiveTab("pending")}
              className={`cursor-pointer rounded-2xl border p-4 transition-all ${activeTab === "pending"
                ? "border-amber-400 bg-amber-50/50 shadow-sm"
                : "border-neutral-200 bg-white hover:border-neutral-300"
                }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-amber-800">
                <span>Menunggu (Pending)</span>
                <Clock size={15} />
              </div>
              <div className="mt-2 text-2xl font-bold text-neutral-900">
                {pendingCount}
              </div>
              <small className="text-[11px] text-neutral-500">
                Perlu verifikasi STR & SIP
              </small>
            </div>

            <div
              onClick={() => setActiveTab("approved")}
              className={`cursor-pointer rounded-2xl border p-4 transition-all ${activeTab === "approved"
                ? "border-emerald-400 bg-emerald-50/50 shadow-sm"
                : "border-neutral-200 bg-white hover:border-neutral-300"
                }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-800">
                <span>Disetujui (Approved)</span>
                <CheckCircle2 size={15} />
              </div>
              <div className="mt-2 text-2xl font-bold text-neutral-900">
                {approvedCount}
              </div>
              <small className="text-[11px] text-neutral-500">
                Akses aktif ke workspace
              </small>
            </div>

            <div
              onClick={() => setActiveTab("rejected")}
              className={`cursor-pointer rounded-2xl border p-4 transition-all ${activeTab === "rejected"
                ? "border-rose-400 bg-rose-50/50 shadow-sm"
                : "border-neutral-200 bg-white hover:border-neutral-300"
                }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-rose-800">
                <span>Ditolak (Rejected)</span>
                <XCircle size={15} />
              </div>
              <div className="mt-2 text-2xl font-bold text-neutral-900">
                {rejectedCount}
              </div>
              <small className="text-[11px] text-neutral-500">
                Kredensial tidak valid
              </small>
            </div>

            <div
              onClick={() => setActiveTab("suspended")}
              className={`cursor-pointer rounded-2xl border p-4 transition-all ${activeTab === "suspended"
                ? "border-neutral-400 bg-neutral-100 shadow-sm"
                : "border-neutral-200 bg-white hover:border-neutral-300"
                }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-neutral-700">
                <span>Ditangguhkan</span>
                <Lock size={15} />
              </div>
              <div className="mt-2 text-2xl font-bold text-neutral-900">
                {suspendedCount}
              </div>
              <small className="text-[11px] text-neutral-500">
                Akses dinonaktifkan
              </small>
            </div>
          </div>

          {/* Navigation Tabs & Search Controls */}
          <div className="flex flex-col gap-3 rounded-2xl border border-neutral-300 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            {/* Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab("pending")}
                className={`rounded-lg px-3.5 py-2 transition-all ${activeTab === "pending"
                  ? "bg-black text-white shadow-sm"
                  : "bg-neutral-100 text-neutral-600 hover:text-black"
                  }`}
              >
                Menunggu ({pendingCount})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("approved")}
                className={`rounded-lg px-3.5 py-2 transition-all ${activeTab === "approved"
                  ? "bg-black text-white shadow-sm"
                  : "bg-neutral-100 text-neutral-600 hover:text-black"
                  }`}
              >
                Disetujui ({approvedCount})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("rejected")}
                className={`rounded-lg px-3.5 py-2 transition-all ${activeTab === "rejected"
                  ? "bg-black text-white shadow-sm"
                  : "bg-neutral-100 text-neutral-600 hover:text-black"
                  }`}
              >
                Ditolak ({rejectedCount})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("suspended")}
                className={`rounded-lg px-3.5 py-2 transition-all ${activeTab === "suspended"
                  ? "bg-black text-white shadow-sm"
                  : "bg-neutral-100 text-neutral-600 hover:text-black"
                  }`}
              >
                Ditangguhkan ({suspendedCount})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`rounded-lg px-3.5 py-2 transition-all ${activeTab === "all"
                  ? "bg-black text-white shadow-sm"
                  : "bg-neutral-100 text-neutral-600 hover:text-black"
                  }`}
              >
                Semua Dokter ({doctorProfiles.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("audit")}
                className={`flex items-center gap-1 rounded-lg px-3.5 py-2 transition-all ${activeTab === "audit"
                  ? "bg-black text-white shadow-sm"
                  : "bg-neutral-100 text-neutral-600 hover:text-black"
                  }`}
              >
                <History size={13} />
                <span>Log Audit ({auditLogs.length})</span>
              </button>
            </div>

            {/* Search Input */}
            {activeTab !== "audit" && (
              <div className="relative min-w-[240px]">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                />
                <input
                  type="text"
                  placeholder="Cari nama, username, STR…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 bg-neutral-50/70 py-1.5 pl-9 pr-3 text-xs outline-none focus:border-black focus:bg-white transition"
                />
              </div>
            )}
          </div>

          {/* Tab Content: Doctors List */}
          {activeTab !== "audit" && (
            <div className="space-y-4">
              {loading ? (
                <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-white p-8 text-center text-xs text-neutral-500">
                  <RefreshCw size={24} className="animate-spin mb-2 text-neutral-400" />
                  <span>Memuat data dokter…</span>
                </div>
              ) : filteredDoctors.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-white p-8 text-center text-xs text-neutral-500">
                  <ShieldCheck size={32} className="mb-2 text-neutral-300" />
                  <strong className="text-sm font-semibold text-neutral-800">
                    Tidak ada data dokter ditemukan
                  </strong>
                  <p className="mt-1 text-neutral-400">
                    {search
                      ? "Tidak ada hasil yang sesuai dengan kata kunci pencarian Anda."
                      : "Tidak ada data dokter pada kategori ini saat ini."}
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {filteredDoctors.map((doc) => {
                    const isPending = doc.status === "pending";
                    const isApproved = doc.status === "approved";
                    const isRejected = doc.status === "rejected";
                    const isSuspended = doc.status === "suspended";

                    return (
                      <div
                        key={doc.id}
                        className={`overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition-all ${isPending
                          ? "border-amber-300"
                          : isApproved
                            ? "border-neutral-200"
                            : isRejected
                              ? "border-red-200"
                              : "border-neutral-300"
                          }`}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          {/* Doctor Info */}
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-base text-black">
                                {doc.full_name || doc.username}
                              </span>

                              <span className="font-mono text-xs text-neutral-500">
                                (@{doc.username})
                              </span>

                              {/* Status Badge */}
                              {isPending && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-900 uppercase tracking-wider">
                                  <Clock size={11} /> Menunggu
                                </span>
                              )}
                              {isApproved && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-900 uppercase tracking-wider">
                                  <CheckCircle2 size={11} /> Disetujui
                                </span>
                              )}
                              {isRejected && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2.5 py-0.5 text-[10px] font-bold text-red-900 uppercase tracking-wider">
                                  <XCircle size={11} /> Ditolak
                                </span>
                              )}
                              {isSuspended && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-neutral-400 bg-neutral-100 px-2.5 py-0.5 text-[10px] font-bold text-neutral-800 uppercase tracking-wider">
                                  <Lock size={11} /> Ditangguhkan
                                </span>
                              )}
                            </div>

                            {/* Medical Specialty & Institution */}
                            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-neutral-600">
                              <span className="flex items-center gap-1 font-medium text-neutral-900">
                                <Stethoscope size={13} className="text-neutral-500" />
                                {doc.specialty || "Spesialisasi belum ada"}
                              </span>

                              <span className="flex items-center gap-1">
                                <Building size={13} className="text-neutral-500" />
                                {doc.institution || "Instansi belum ada"}
                              </span>

                              <span>
                                Email:{" "}
                                <strong className="text-neutral-800">
                                  {doc.email}
                                </strong>
                              </span>

                              <span className="text-[11px] text-neutral-400">
                                Terdaftar:{" "}
                                {doc.created_at
                                  ? new Date(doc.created_at).toLocaleDateString(
                                    "id-ID",
                                    {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                    }
                                  )
                                  : "-"}
                              </span>
                            </div>

                            {/* Credentials Strip */}
                            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                              <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1 font-mono">
                                <span className="text-neutral-500">No. STR: </span>
                                <strong className="text-neutral-900">
                                  {doc.str_number || "-"}
                                </strong>
                                <span className="text-neutral-400 ml-1.5">
                                  (Exp: {doc.str_expiry || "-"})
                                </span>
                              </div>

                              {doc.sip_number && (
                                <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1 font-mono">
                                  <span className="text-neutral-500">No. SIP: </span>
                                  <strong className="text-neutral-900">
                                    {doc.sip_number}
                                  </strong>
                                  {doc.sip_expiry && (
                                    <span className="text-neutral-400 ml-1.5">
                                      (Exp: {doc.sip_expiry})
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Rejection Note if exists */}
                            {doc.rejection_reason && (
                              <div className="rounded-lg border border-red-200 bg-red-50/60 p-2 text-xs text-red-900">
                                <strong>Catatan Penolakan:</strong>{" "}
                                {doc.rejection_reason}
                              </div>
                            )}
                          </div>

                          {/* Documents and Action Buttons */}
                          <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-2.5 flex-shrink-0 pt-2 lg:pt-0">
                            {/* Document Links */}
                            <div className="flex flex-wrap items-center gap-2">
                              {doc.str_document_path ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenDocument(doc.str_document_path)
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:border-black hover:bg-neutral-50 transition"
                                >
                                  <FileText size={13} className="text-blue-600" />
                                  <span>Dokumen STR</span>
                                  <ExternalLink size={11} className="text-neutral-400" />
                                </button>
                              ) : (
                                <span className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] text-neutral-400">
                                  STR belum diunggah
                                </span>
                              )}

                              {doc.sip_document_path ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenDocument(doc.sip_document_path)
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:border-black hover:bg-neutral-50 transition"
                                >
                                  <FileText size={13} className="text-indigo-600" />
                                  <span>Dokumen SIP</span>
                                  <ExternalLink size={11} className="text-neutral-400" />
                                </button>
                              ) : null}
                            </div>

                            {/* State Mutation Buttons */}
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              {isPending && (
                                <>
                                  <button
                                    type="button"
                                    disabled={actionLoading}
                                    onClick={() => openApproveModal(doc)}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-black px-3.5 py-1.5 text-xs font-bold text-white hover:bg-neutral-800 transition disabled:opacity-50"
                                  >
                                    <UserCheck size={14} />
                                    <span>Setujui</span>
                                  </button>

                                  <button
                                    type="button"
                                    disabled={actionLoading}
                                    onClick={() => openRejectModal(doc)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 transition disabled:opacity-50"
                                  >
                                    <UserX size={14} />
                                    <span>Tolak</span>
                                  </button>
                                </>
                              )}

                              {isApproved && (
                                <button
                                  type="button"
                                  disabled={actionLoading}
                                  onClick={() => openSuspendModal(doc)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:border-neutral-500 hover:text-black transition disabled:opacity-50"
                                >
                                  <Lock size={13} />
                                  <span>Tangguhkan</span>
                                </button>
                              )}

                              {(isRejected || isSuspended) && (
                                <button
                                  type="button"
                                  disabled={actionLoading}
                                  onClick={() => openApproveModal(doc)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100 transition disabled:opacity-50"
                                >
                                  <CheckCircle2 size={14} />
                                  <span>Pulihkan & Setujui</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab Content: Audit Logs */}
          {activeTab === "audit" && (
            <div className="overflow-hidden rounded-2xl border border-neutral-300 bg-white shadow-sm">
              <div className="border-b border-neutral-200 bg-neutral-50/70 p-4">
                <h3 className="text-sm font-bold text-black flex items-center gap-2">
                  <History size={16} />
                  <span>Jejak Riwayat Aksi Administrator</span>
                </h3>
                <p className="mt-0.5 text-xs text-neutral-500">
                  Setiap persetujuan, penolakan, atau penangguhan akun dicatat
                  secara permanen dalam log audit sistem.
                </p>
              </div>

              {auditLogs.length === 0 ? (
                <div className="p-10 text-center text-xs text-neutral-400">
                  Belum ada catatan aktivitas admin.
                </div>
              ) : (
                <div className="divide-y divide-neutral-200 text-xs">
                  {auditLogs.map((log) => {
                    return (
                      <div
                        key={log.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-2 hover:bg-neutral-50/60"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${log.action === "approve"
                                ? "bg-emerald-100 text-emerald-900"
                                : log.action === "reject"
                                  ? "bg-red-100 text-red-900"
                                  : log.action === "reinstate"
                                    ? "bg-blue-100 text-blue-900"
                                    : "bg-neutral-200 text-neutral-800"
                                }`}
                            >
                              {log.action}
                            </span>
                            <span className="font-mono text-neutral-500">
                              Target Dokter ID: {log.target_user_id?.substring(0, 8)}…
                            </span>
                          </div>

                          {log.rejection_reason && (
                            <p className="text-neutral-700">
                              <strong>Alasan:</strong> {log.rejection_reason}
                            </p>
                          )}
                        </div>

                        <div className="text-[11px] text-neutral-400 font-mono flex-shrink-0">
                          {new Date(log.created_at).toLocaleString("id-ID")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Approval Confirmation Modal */}
      {approvingDoctor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-md animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="approve-modal-title"
        >
          <div className="relative w-full max-w-lg rounded-2xl border border-neutral-300 bg-white p-6 sm:p-7 shadow-2xl space-y-5 text-neutral-900">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-neutral-200 pb-4">
              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-700">
                  <UserCheck size={22} strokeWidth={2.2} />
                </div>
                <div>
                  <span className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                    <CheckCircle2 size={11} /> Konfirmasi Otorisasi Akses
                  </span>
                  <h3
                    id="approve-modal-title"
                    className="text-lg font-bold tracking-tight text-black sm:text-xl mt-0.5"
                  >
                    {approvingDoctor.status === "rejected" ||
                    approvingDoctor.status === "suspended"
                      ? "Pulihkan & Setujui Akun Dokter"
                      : "Setujui Registrasi Dokter"}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setApprovingDoctor(null)}
                disabled={actionLoading}
                className="text-neutral-400 hover:text-black transition p-1"
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            {/* Doctor Card Preview */}
            <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-black text-white text-sm font-bold">
                  {(
                    approvingDoctor.full_name ||
                    approvingDoctor.username ||
                    "D"
                  )
                    .charAt(0)
                    .toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm text-neutral-900 truncate">
                    {approvingDoctor.full_name || approvingDoctor.username}
                  </div>
                  <div className="text-xs text-neutral-500 font-mono truncate">
                    @{approvingDoctor.username} · {approvingDoctor.email}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-neutral-200/80 text-xs text-neutral-700">
                <div className="flex items-center gap-1.5">
                  <Stethoscope size={13} className="text-neutral-500 flex-shrink-0" />
                  <span className="truncate">
                    {approvingDoctor.specialty || "Spesialisasi belum ada"}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Building size={13} className="text-neutral-500 flex-shrink-0" />
                  <span className="truncate">
                    {approvingDoctor.institution || "Instansi belum ada"}
                  </span>
                </div>

                <div className="sm:col-span-2 flex items-center justify-between gap-2 pt-1 font-mono text-[11px] text-neutral-600 border-t border-dashed border-neutral-200">
                  <div className="flex items-center gap-1.5 truncate">
                    <FileText size={13} className="text-neutral-500 flex-shrink-0" />
                    <span>
                      STR: <strong>{approvingDoctor.str_number || "-"}</strong>
                    </span>
                    {approvingDoctor.str_expiry && (
                      <span className="text-neutral-400">
                        (Exp: {approvingDoctor.str_expiry})
                      </span>
                    )}
                  </div>

                  {approvingDoctor.str_document_path && (
                    <button
                      type="button"
                      onClick={() => handleOpenDocument(approvingDoctor.str_document_path)}
                      className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[11px] font-semibold text-neutral-800 border border-neutral-300 hover:border-black transition flex-shrink-0"
                    >
                      <ExternalLink size={10} />
                      <span>Berkas STR</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Impact Explanation */}
            <p className="text-xs text-neutral-600 leading-relaxed">
              Dengan menyetujui, akun dokter akan berstatus{" "}
              <strong className="text-black">Disetujui (Approved)</strong> dan seluruh
              pembatasan di workspace klinis <strong>QORA</strong> akan langsung dicabut.
              Dokter ini dapat melakukan analisis radiograf toraks HQCNN, visualisasi
              Grad-CAM, serta konsultasi AI klinis.
            </p>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-200">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setApprovingDoctor(null)}
                className="rounded-xl border border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition disabled:opacity-50"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmApprove}
                className="flex items-center gap-2 rounded-xl bg-black px-5 py-2 text-xs font-bold text-white hover:bg-neutral-800 transition disabled:opacity-50 shadow-sm"
              >
                {actionLoading ? (
                  <>
                    <span className="qora-processing-spinner" />
                    <span>Memproses Persetujuan…</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} />
                    <span>Konfirmasi & Berikan Akses</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectingDoctor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-md animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-modal-title"
        >
          <div className="relative w-full max-w-lg rounded-2xl border border-neutral-300 bg-white p-6 sm:p-7 shadow-2xl space-y-4 text-neutral-900">
            <div className="flex items-start justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2.5 text-red-700">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-red-300 bg-red-50 text-red-700">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 id="reject-modal-title" className="font-bold text-base text-black">
                    Tolak Pendaftaran Dokter
                  </h3>
                  <span className="text-[11px] text-neutral-500 font-mono">
                    @{rejectingDoctor.username}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRejectingDoctor(null)}
                disabled={actionLoading}
                className="text-neutral-400 hover:text-black transition p-1"
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed">
              Anda akan menolak pendaftaran akun untuk dokter{" "}
              <strong>
                {rejectingDoctor.full_name || rejectingDoctor.username}
              </strong>
              . Silakan tuliskan alasan penolakan agar dokter dapat memahami berkas
              yang perlu diperbaiki.
            </p>

            <form onSubmit={handleConfirmReject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Alasan Penolakan (Wajib diisi sebagai catatan revisi dokter)
                </label>
                <textarea
                  rows={3}
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Contoh: Nomor STR tidak sesuai data KKI / Foto dokumen STR buram dan tidak terbaca."
                  className="w-full rounded-xl border border-neutral-300 p-3 text-xs outline-none focus:border-black transition"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setRejectingDoctor(null)}
                  disabled={actionLoading}
                  className="rounded-xl border border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 transition disabled:opacity-50"
                >
                  {actionLoading ? "Memproses…" : "Konfirmasi Tolak Pendaftaran"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Suspend Confirmation Modal */}
      {suspendingDoctor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-md animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="suspend-modal-title"
        >
          <div className="relative w-full max-w-lg rounded-2xl border border-neutral-300 bg-white p-6 sm:p-7 shadow-2xl space-y-4 text-neutral-900">
            <div className="flex items-start justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-neutral-300 bg-neutral-100 text-neutral-800">
                  <Lock size={20} />
                </div>
                <div>
                  <h3 id="suspend-modal-title" className="font-bold text-base text-black">
                    Tangguhkan Akses Dokter
                  </h3>
                  <span className="text-[11px] text-neutral-500 font-mono">
                    @{suspendingDoctor.username}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSuspendingDoctor(null)}
                disabled={actionLoading}
                className="text-neutral-400 hover:text-black transition p-1"
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed">
              Anda akan menangguhkan akun dokter{" "}
              <strong>
                {suspendingDoctor.full_name || suspendingDoctor.username}
              </strong>
              . Akses dokter ke workspace analisis radiograf toraks QORA akan
              langsung dinonaktifkan sementara hingga dipulihkan kembali oleh
              administrator.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-neutral-200">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setSuspendingDoctor(null)}
                className="rounded-xl border border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition disabled:opacity-50"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmSuspend}
                className="flex items-center gap-1.5 rounded-xl bg-neutral-900 px-4 py-2 text-xs font-bold text-white hover:bg-black transition disabled:opacity-50"
              >
                {actionLoading ? "Memproses…" : "Konfirmasi Tangguhkan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-white py-4 text-center text-xs text-neutral-500">
        © {new Date().getFullYear()} QORA Radiograph Analysis · RJ EST. 2026. All rights reserved. · Administrator Console
      </footer>
    </div>
  );
}
