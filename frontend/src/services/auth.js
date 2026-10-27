
import { supabase, supabaseConfigured } from "./supabase.js";

const CURRENT_USER_KEY = "qora_current_user";

function ensureSupabaseConfigured() {
  if (!supabaseConfigured || !supabase) {
    throw new Error(
      "Supabase belum dikonfigurasi. Periksa file .env."
    );
  }
}


function normalizeUser(user) {
  const metadata = user.user_metadata || {};

  // Pertahankan kapitalisasi yang tersimpan pada metadata.
  const username =
    metadata.username ||
    user.email?.split("@")[0] ||
    "user";

  const name =
    metadata.display_name ||
    metadata.full_name ||
    metadata.name ||
    username;

  return {
    id: user.id,
    email: user.email,
    username,
    name,
    loggedInAt: new Date().toISOString(),
  };
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  try {
    if (user) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
  } catch (error) {
    console.error("Gagal menyimpan sesi:", error);
  }
}

export async function signUp({ email, username, password }) {
  ensureSupabaseConfigured();

  const cleanEmail = (email || "").trim().toLowerCase();
  const cleanUsername = (username || "").trim();
  const cleanPassword = password || "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error("Format email tidak valid.");
  }

  if (cleanUsername.length < 3 || /\s/.test(cleanUsername)) {
    throw new Error(
      "Username minimal 3 karakter dan tidak boleh mengandung spasi."
    );
  }

  if (cleanPassword.length < 6) {
    throw new Error("Kata sandi minimal 6 karakter.");
  }

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password: cleanPassword,
    options: {
      data: {
        username: cleanUsername,
        name: cleanUsername,
        display_name: cleanUsername,
      },
    },
  });

  if (error) throw new Error(error.message);
  if (!data?.user) {
    throw new Error("Supabase tidak mengembalikan data pengguna.");
  }

  if (!data.session) {
    setStoredUser(null);

    return {
      ...normalizeUser(data.user),
      needsEmailConfirmation: true,
      message:
        "Pendaftaran diterima. Periksa email untuk menyelesaikan verifikasi sebelum masuk.",
    };
  }

  const sessionUser = normalizeUser(data.user);
  setStoredUser(sessionUser);

  return {
    ...sessionUser,
    needsEmailConfirmation: false,
  };
}

export async function signIn({ identifier, password }) {
  ensureSupabaseConfigured();

  const cleanId = (identifier || "").trim();
  const cleanPassword = password || "";

  if (!cleanId) {
    throw new Error("Masukkan email atau username.");
  }

  if (!cleanPassword) {
    throw new Error("Masukkan kata sandi.");
  }

  let emailToUse = cleanId.toLowerCase();

  // Jika input bukan email, cari email berdasarkan username di Supabase.
  if (!cleanId.includes("@")) {
    const { data: emailResult, error: lookupError } =
      await supabase.rpc("get_auth_email_by_username", {
        input_username: cleanId.toLowerCase(),
      });

    if (lookupError) {
      console.error("Username lookup error:", lookupError.message);
      throw new Error(
        "Gagal mencari username. Pastikan fungsi SQL Supabase sudah dibuat."
      );
    }

    if (!emailResult) {
      throw new Error(
        "Username tidak ditemukan. Periksa username atau daftar akun terlebih dahulu."
      );
    }

    emailToUse = emailResult;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailToUse,
    password: cleanPassword,
  });

  if (error) {
    throw new Error(
      "Login gagal. Periksa email/username dan kata sandi Anda."
    );
  }

  if (!data?.user || !data?.session) {
    throw new Error("Login gagal. Silakan coba lagi.");
  }

  const sessionUser = normalizeUser(data.user);
  setStoredUser(sessionUser);

  return sessionUser;
}

export async function signOut() {
  ensureSupabaseConfigured();

  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }

  setStoredUser(null);
}
