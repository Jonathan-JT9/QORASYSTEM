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
  const status = profile?.status || meta.status || "pending";

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
    throw new Error("Nama lengkap beserta gelar dokter wajib diisi.");
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
 * Tahap 2: Pengisian / Pembaruan Formulir Kredensial Dokter (STR & SIP).
 * Dipanggil dari dialog akses terbatas atau menu akun.
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

  if (!cleanSpecialty) {
    throw new Error("Spesialisasi medis wajib diisi.");
  }

  if (!cleanStrNumber) {
    throw new Error("Nomor STR (Surat Tanda Registrasi) wajib diisi.");
  }

  if (!cleanStrExpiry) {
    throw new Error("Masa berlaku STR wajib diisi.");
  }

  if (!cleanInstitution) {
    throw new Error("Nama instansi / rumah sakit tempat praktik wajib diisi.");
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
    specialty: cleanSpecialty,
    str_number: cleanStrNumber,
    str_expiry: cleanStrExpiry,
    institution: cleanInstitution,
    sip_number: cleanSipNumber || null,
    sip_expiry: cleanSipExpiry || null,
    status: "pending",
    rejection_reason: null,
    updated_at: new Date().toISOString(),
  };

  if (strPath) {
    updatePayload.str_document_path = strPath;
  }
  if (sipPath) {
    updatePayload.sip_document_path = sipPath;
  }

  const { data: updatedProfile, error: updateErr } = await supabase
    .from("profiles")
    .update(updatePayload)
    .eq("id", user.id)
    .select()
    .single();

  if (updateErr) {
    console.error("Gagal menyimpan dokumen kredensial:", updateErr);
    throw new Error(`Gagal menyimpan kredensial: ${updateErr.message}`);
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
