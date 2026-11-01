import { supabase, supabaseConfigured } from "./supabase.js";

function ensureSupabaseConfigured() {
  if (!supabaseConfigured || !supabase) {
    throw new Error(
      "Supabase belum dikonfigurasi. Periksa file .env pada proyek frontend."
    );
  }
}

/**
 * Normalisasi objek user dari Supabase Auth dan tabel profiles.
 */
function normalizeUser(authUser, profile = null) {
  const meta = authUser.user_metadata || {};

  const username =
    profile?.username ||
    meta.username ||
    authUser.email?.split("@")[0] ||
    "user";

  const name =
    profile?.full_name ||
    meta.full_name ||
    meta.name ||
    meta.display_name ||
    username;

  const role = profile?.role || meta.role || "doctor";
  let status = profile?.status || meta.status || "pending";

  // Dokter hanya boleh berstatus 'approved' jika Admin telah meninjau pengajuan dokumennya
  if (role !== "admin" && status === "approved" && profile) {
    const reviewedAt = profile.reviewed_at ? new Date(profile.reviewed_at).getTime() : 0;
    const updatedAt = profile.updated_at ? new Date(profile.updated_at).getTime() : 0;
    if (reviewedAt === 0 || (updatedAt > 0 && updatedAt > reviewedAt)) {
      status = "pending";
    }
  }

  return {
    id: authUser.id,
    email: authUser.email,
    username,
    name,
    role,
    status,
    profile: profile || null,
    loggedInAt: new Date().toISOString(),
  };
}

/**
 * Mendapatkan user yang sedang aktif secara aman dari Supabase session & database.
 * Tidak mengandalkan data rawan manipulasi di localStorage.
 */
export async function getCurrentUser() {
  if (!supabaseConfigured || !supabase) return null;

  try {
    const { data: sessionData, error: sessionErr } =
      await supabase.auth.getSession();

    if (sessionErr || !sessionData?.session?.user) {
      return null;
    }

    const authUser = sessionData.session.user;

    // Ambil profil resmi langsung dari tabel profiles
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle();

    if (profileErr) {
      console.warn("Gagal mengambil profil database:", profileErr.message);
    }

    return normalizeUser(authUser, profile);
  } catch (err) {
    console.error("Kesalahan memeriksa status user:", err);
    return null;
  }
}

/**
 * Masuk sistem (Shared Sign In untuk Dokter dan Admin).
 * Menerima email atau username + password.
 */
export async function signIn({ identifier, password }) {
  ensureSupabaseConfigured();

  const cleanId = (identifier || "").trim();
  const cleanPassword = password || "";

  if (!cleanId) {
    throw new Error("Masukkan email atau username Anda.");
  }

  if (!cleanPassword) {
    throw new Error("Masukkan kata sandi.");
  }

  let emailToUse = cleanId.toLowerCase();

  // Jika input adalah username (tidak ada simbol '@'), cari email terdaftar di database via RPC
  if (!cleanId.includes("@")) {
    const { data: emailResult, error: lookupError } = await supabase.rpc(
      "get_auth_email_by_username",
      {
        input_username: cleanId.toLowerCase(),
      }
    );

    if (lookupError) {
      console.error("Username lookup error:", lookupError.message);
      throw new Error(
        "Gagal memverifikasi username. Pastikan konfigurasi SQL Supabase sudah dijalankan."
      );
    }

    if (!emailResult) {
      throw new Error(
        "Username tidak ditemukan. Periksa kembali username Anda atau lakukan pendaftaran."
      );
    }

    emailToUse = emailResult;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailToUse,
    password: cleanPassword,
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes("invalid login credentials") ||
      msg.includes("invalid_credentials")
    ) {
      throw new Error("Kombinasi email/username dan kata sandi salah.");
    }
    if (msg.includes("email not confirmed")) {
      throw new Error(
        "Email Anda belum dikonfirmasi. Periksa inbox email Anda untuk menyelesaikan verifikasi."
      );
    }
    throw new Error(error.message || "Gagal masuk ke sistem.");
  }

  if (!data?.user || !data?.session) {
    throw new Error("Otentikasi gagal. Sesi tidak dapat dibuat.");
  }

  // Ambil profil lengkap dari tabel profiles
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .maybeSingle();

  return normalizeUser(data.user, profile);
}

/**
 * Tahap 1: Pembuatan Akun Dokter (Hanya nama, email, username, dan password).
 * Pengisian dokumen profesional dipisahkan ke modal bertahap setelah akun dibuat.
 */
export async function signUpDoctorAccount({
  fullName,
  email,
  username,
  password,
}) {
  ensureSupabaseConfigured();

  const cleanFullName = (fullName || "").trim();
  const cleanEmail = (email || "").trim().toLowerCase();
  const cleanUsername = (username || "").trim();
  const cleanPassword = password || "";

  if (!cleanFullName) {
    throw new Error("Nama lengkap wajib diisi.");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error("Format alamat email tidak valid.");
  }

  if (cleanUsername.length < 3 || /\s/.test(cleanUsername)) {
    throw new Error(
      "Username minimal 3 karakter dan tidak boleh mengandung spasi."
    );
  }

  if (/^admin/i.test(cleanUsername)) {
    throw new Error(
      "Username tersebut tidak dapat digunakan untuk pendaftaran publik."
    );
  }

  if (cleanPassword.length < 6) {
    throw new Error("Kata sandi minimal 6 karakter.");
  }

  // Cek apakah username sudah dipakai di database
  const { data: existingEmail } = await supabase.rpc(
    "get_auth_email_by_username",
    {
      input_username: cleanUsername.toLowerCase(),
    }
  );

  if (existingEmail) {
    throw new Error("Username sudah terdaftar. Silakan gunakan username lain.");
  }

  // Eksekusi Pendaftaran Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password: cleanPassword,
    options: {
      data: {
        username: cleanUsername,
        full_name: cleanFullName,
        name: cleanFullName,
        role: "doctor",
      },
    },
  });

  if (error) {
    if (error.message.includes("User already registered")) {
      throw new Error(
        "Alamat email sudah terdaftar. Silakan masuk menggunakan akun tersebut."
      );
    }
    if (error.message.includes("rate limit")) {
      throw new Error(
        "Batas pengiriman email sistem tercapai. Silakan coba kembali dalam beberapa saat atau hubungi administrator."
      );
    }
    throw new Error(error.message);
  }

  if (!data?.user) {
    throw new Error("Supabase tidak mengembalikan data pengguna.");
  }

  const userId = data.user.id;

  // Ambil profil yang dibuat oleh database trigger
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  const normalized = normalizeUser(data.user, profile);

  if (!data.session) {
    return {
      ...normalized,
      needsEmailConfirmation: true,
      message:
        "Pendaftaran akun dokter berhasil! Silakan periksa inbox email Anda untuk konfirmasi sebelum masuk.",
    };
  }

  return {
    ...normalized,
    needsEmailConfirmation: false,
    message: "Akun dokter berhasil dibuat! Silakan lengkapi dokumen kredensial Anda.",
  };
}

/**
 * Memeriksa status kelengkapan dokumen dan verifikasi akun dokter.
 *
 * Alur status verifikasi kredensial:
 * 1. "incomplete": Dokter belum melengkapi seluruh dokumen kredensial (STR dan SIP).
 * 2. "pending": Dokter telah menyerahkan seluruh dokumen (STR dan SIP) dan sedang menunggu verifikasi Admin.
 * 3. "approved": Admin telah memeriksa dan menyetujui seluruh dokumen kredensial.
 * 4. "rejected": Admin menolak pengajuan dokumen kredensial (dengan alasan penolakan).
 * 5. "suspended": Akun dokter ditangguhkan oleh Administrator.
 *
 * PENTING: Hanya status "approved" yang diizinkan mengakses fitur Analisis / Klasifikasi.
 */
export function getDoctorVerificationStatus(user) {
  if (!user) {
    return {
      isDoctor: false,
      isAdmin: false,
      isVerified: false,
      hasStr: false,
      hasSip: false,
      hasAllDocuments: false,
      status: "unauthenticated",
      verificationState: "incomplete",
      missingDocuments: ["STR (Surat Tanda Registrasi)", "SIP (Surat Izin Praktik)"],
      rejectionReason: null,
    };
  }

  const role = String(user.role || user.profile?.role || "").toLowerCase().trim();
  const isAdmin = role === "admin";

  if (isAdmin) {
    return {
      isDoctor: false,
      isAdmin: true,
      isVerified: true,
      hasStr: true,
      hasSip: true,
      hasAllDocuments: true,
      status: "approved",
      verificationState: "approved",
      missingDocuments: [],
      rejectionReason: null,
    };
  }

  const profile = user.profile || {};
  const hasStr = Boolean(
    (profile.str_document_path && profile.str_document_path.trim()) ||
    (profile.str_number && profile.str_number.trim())
  );
  const hasSip = Boolean(
    (profile.sip_document_path && profile.sip_document_path.trim()) ||
    (profile.sip_number && profile.sip_number.trim())
  );
  const hasAllDocuments = hasStr && hasSip;

  const rawStatus = String(profile.status || user.status || "pending").toLowerCase().trim();
  const rejectionReason = profile.rejection_reason || user.rejection_reason || null;

  // Verifikasi persetujuan Admin:
  // Dokter HANYA disetujui jika Admin telah memeriksa dan menyetujui pengajuan berkas ini
  // (reviewed_at valid dan tidak mendahului pengunggahan/pembaruan dokumen terakhir)
  const reviewedAt = profile.reviewed_at ? new Date(profile.reviewed_at).getTime() : 0;
  const updatedAt = profile.updated_at ? new Date(profile.updated_at).getTime() : 0;
  const isReviewedAndApprovedByAdmin = Boolean(
    rawStatus === "approved" &&
    reviewedAt > 0 &&
    (updatedAt === 0 || reviewedAt >= updatedAt)
  );

  // Alur Status:
  // - "rejected": Ditolak oleh Admin
  // - "suspended": Ditangguhkan oleh Admin
  // - "incomplete": Dokumen STR atau SIP belum lengkap
  // - "approved": STR dan SIP lengkap DAN Admin telah menyetujui dokumen yang diajukan
  // - "pending": STR dan SIP lengkap, menunggu persetujuan Admin
  let verificationState = "incomplete";
  if (rawStatus === "rejected") {
    verificationState = "rejected";
  } else if (rawStatus === "suspended") {
    verificationState = "suspended";
  } else if (!hasAllDocuments) {
    verificationState = "incomplete";
  } else if (isReviewedAndApprovedByAdmin) {
    verificationState = "approved";
  } else {
    verificationState = "pending";
  }

  // ATURAN MUTLAK: Hanya status "approved" yang boleh membuka akses analisis / klasifikasi
  const isVerified = verificationState === "approved";

  const missingDocuments = [];
  if (!hasStr) missingDocuments.push("STR (Surat Tanda Registrasi)");
  if (!hasSip) missingDocuments.push("SIP (Surat Izin Praktik)");

  return {
    isDoctor: true,
    isAdmin: false,
    isVerified,
    hasStr,
    hasSip,
    hasAllDocuments,
    status: rawStatus,
    verificationState,
    missingDocuments,
    rejectionReason,
  };
}

/**
 * Tahap 2: Pengisian / Pembaruan Formulir Kredensial Dokter (STR & SIP).
 * Dipanggil dari dialog kredensial atau gate verifikasi.
 */
export async function submitDoctorCredentials({
  specialty,
  strNumber,
  strExpiry,
  strFile,
  institution,
  sipNumber,
  sipExpiry,
  sipFile,
}) {
  ensureSupabaseConfigured();

  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;
  if (!user) {
    throw new Error("Sesi login telah berakhir. Silakan masuk kembali.");
  }

  const cleanSpecialty = (specialty || "").trim();
  const cleanStrNumber = (strNumber || "").trim();
  const cleanStrExpiry = strExpiry || null;
  const cleanInstitution = (institution || "").trim();
  const cleanSipNumber = (sipNumber || "").trim();
  const cleanSipExpiry = sipExpiry || null;

  const hasStrData = Boolean(cleanStrNumber || strFile);
  const hasSipData = Boolean(cleanSipNumber || sipFile);

  if (!hasStrData && !hasSipData && !cleanInstitution && !cleanSpecialty) {
    throw new Error("Mohon lengkapi data dokumen STR atau SIP.");
  }

  // Upload STR jika file baru dipilih
  let strPath = null;
  if (strFile) {
    strPath = await uploadDoctorDocument({
      file: strFile,
      type: "str",
      userId: user.id,
    });
  }

  // Upload SIP jika file baru dipilih
  let sipPath = null;
  if (sipFile) {
    sipPath = await uploadDoctorDocument({
      file: sipFile,
      type: "sip",
      userId: user.id,
    });
  }

  const updatePayload = {
    updated_at: new Date().toISOString(),
    status: "pending",
    reviewed_at: null,
    reviewed_by: null,
    rejection_reason: null,
  };

  if (cleanSpecialty) updatePayload.specialty = cleanSpecialty;
  if (cleanInstitution) updatePayload.institution = cleanInstitution;
  if (cleanStrNumber) updatePayload.str_number = cleanStrNumber;
  if (cleanStrExpiry) updatePayload.str_expiry = cleanStrExpiry;
  if (strPath) updatePayload.str_document_path = strPath;
  if (cleanSipNumber) updatePayload.sip_number = cleanSipNumber;
  if (cleanSipExpiry) updatePayload.sip_expiry = cleanSipExpiry;
  if (sipPath) updatePayload.sip_document_path = sipPath;

  let updatedProfile = null;
  try {
    const { data: profileResult, error: updateErr } = await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("id", user.id)
      .select()
      .single();

    if (updateErr) throw updateErr;
    updatedProfile = profileResult;
  } catch (err) {
    // Jika update status/reviewed_at ditolak oleh RLS di database
    if (err.message?.toLowerCase().includes("row-level security")) {
      delete updatePayload.status;
      delete updatePayload.reviewed_at;
      delete updatePayload.reviewed_by;
      delete updatePayload.rejection_reason;

      const { data: fallbackResult, error: fallbackErr } = await supabase
        .from("profiles")
        .update(updatePayload)
        .eq("id", user.id)
        .select()
        .single();

      if (fallbackErr) {
        console.error("Gagal menyimpan dokumen kredensial:", fallbackErr);
        throw new Error(`Gagal menyimpan kredensial: ${fallbackErr.message}`);
      }
      updatedProfile = {
        ...fallbackResult,
        status: "pending",
        reviewed_at: null,
        reviewed_by: null,
        rejection_reason: null,
      };

      // Coba panggil RPC resubmit jika tersedia
      try {
        await supabase.rpc("resubmit_doctor_credentials");
      } catch {
        // RPC opsional jika belum diterapkan
      }
    } else {
      console.error("Gagal menyimpan dokumen kredensial:", err);
      throw new Error(`Gagal menyimpan kredensial: ${err.message}`);
    }
  }

  return updatedProfile;
}

/**
 * Unggah dokumen STR / SIP ke private bucket `doctor-documents`.
 */
export async function uploadDoctorDocument({ file, type, userId }) {
  ensureSupabaseConfigured();

  if (!file) return null;

  const cleanType = type === "str" ? "str" : "sip";
  const safeName = file.name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .substring(0, 50);
  const filePath = `${userId}/${cleanType}_${Date.now()}_${safeName}`;

  const { error } = await supabase.storage
    .from("doctor-documents")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (error) {
    console.error("Gagal mengunggah dokumen:", error.message);
    throw new Error(
      `Gagal mengunggah dokumen ${cleanType.toUpperCase()}: ${error.message}`
    );
  }

  return filePath;
}

/**
 * Buat Signed URL sementara untuk membaca dokumen di private storage bucket.
 * Hanya admin atau dokter pemilik dokumen yang diizinkan oleh RLS.
 */
export async function getDocumentSignedUrl(filePath) {
  ensureSupabaseConfigured();

  if (!filePath) return null;

  const { data, error } = await supabase.storage
    .from("doctor-documents")
    .createSignedUrl(filePath, 3600); // Valid 1 jam

  if (error) {
    console.error("Gagal membuat signed URL dokumen:", error.message);
    throw new Error(
      "Gagal membuka dokumen. Izin akses ditolak atau berkas tidak ditemukan."
    );
  }

  return data?.signedUrl || null;
}

/**
 * Keluar dari sistem.
 */
export async function signOut() {
  ensureSupabaseConfigured();

  const { error } = await supabase.auth.signOut();
  if (error) {
    console.warn("Sign out warning:", error.message);
  }
}
