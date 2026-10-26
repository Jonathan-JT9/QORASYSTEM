import { supabase, supabaseConfigured } from "./supabase.js";

const CURRENT_USER_KEY = "qora_current_user";
const USERS_STORE_KEY = "qora_users_db";

const DEFAULT_USERS = [
  {
    email: "dr.radiologi@qora.med",
    username: "dr_radiologi",
    password: "password123",
    name: "dr. Radiologi Sp.Rad",
    role: "Spesialis Radiologi",
    createdAt: new Date().toISOString(),
  },
  {
    email: "admin@qora.med",
    username: "admin_qora",
    password: "password123",
    name: "Administrator QORA",
    role: "Clinical Lead",
    createdAt: new Date().toISOString(),
  },
];

function getRegisteredUsers() {
  try {
    const raw = localStorage.getItem(USERS_STORE_KEY);
    if (!raw) {
      localStorage.setItem(USERS_STORE_KEY, JSON.stringify(DEFAULT_USERS));
      return DEFAULT_USERS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_USERS;
  } catch {
    return DEFAULT_USERS;
  }
}

function saveRegisteredUsers(users) {
  try {
    localStorage.setItem(USERS_STORE_KEY, JSON.stringify(users));
  } catch (err) {
    console.error("Gagal menyimpan pengguna ke localStorage:", err);
  }
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
  } catch (err) {
    console.error("Gagal memperbarui session pengguna:", err);
  }
}

export async function signUp({ email, username, password }) {
  const cleanEmail = (email || "").trim().toLowerCase();
  const cleanUsername = (username || "").trim().toLowerCase();
  const cleanPassword = password || "";

  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("Format alamat email tidak valid.");
  }
  if (!cleanUsername || cleanUsername.length < 3) {
    throw new Error("Username minimal 3 karakter tanpa spasi.");
  }
  if (cleanPassword.length < 6) {
    throw new Error("Kata sandi minimal 6 karakter.");
  }

  const users = getRegisteredUsers();

  const emailExists = users.some((u) => u.email.toLowerCase() === cleanEmail);
  if (emailExists) {
    throw new Error("Alamat email ini sudah terdaftar. Silakan masuk.");
  }

  const usernameExists = users.some((u) => u.username.toLowerCase() === cleanUsername);
  if (usernameExists) {
    throw new Error("Username ini sudah digunakan. Silakan pilih username lain.");
  }

  const newUser = {
    email: cleanEmail,
    username: cleanUsername,
    password: cleanPassword,
    name: cleanUsername.charAt(0).toUpperCase() + cleanUsername.slice(1),
    role: "Klinisi / Radiografer",
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveRegisteredUsers(users);

  // Attempt Supabase sign up in background if configured
  if (supabaseConfigured && supabase) {
    try {
      await supabase.auth.signUp({
        email: cleanEmail,
        password: cleanPassword,
        options: {
          data: { username: cleanUsername },
        },
      });
    } catch (sbErr) {
      console.warn("Supabase auth signUp background note:", sbErr?.message);
    }
  }

  const sessionUser = {
    email: newUser.email,
    username: newUser.username,
    name: newUser.name,
    role: newUser.role,
    loggedInAt: new Date().toISOString(),
  };

  setStoredUser(sessionUser);
  return sessionUser;
}

export async function signIn({ identifier, password }) {
  const cleanId = (identifier || "").trim().toLowerCase();
  const cleanPassword = password || "";

  if (!cleanId) {
    throw new Error("Masukkan alamat email atau username Anda.");
  }
  if (!cleanPassword) {
    throw new Error("Masukkan kata sandi Anda.");
  }

  const users = getRegisteredUsers();
  const matchedUser = users.find(
    (u) =>
      u.email.toLowerCase() === cleanId ||
      u.username.toLowerCase() === cleanId
  );

  if (matchedUser) {
    if (matchedUser.password !== cleanPassword) {
      throw new Error("Kata sandi yang Anda masukkan salah.");
    }

    // Try Supabase auth in background to establish remote session if available
    if (supabaseConfigured && supabase) {
      try {
        await supabase.auth.signInWithPassword({
          email: matchedUser.email,
          password: cleanPassword,
        });
      } catch (sbErr) {
        console.warn("Supabase auth signIn background note:", sbErr?.message);
      }
    }

    const sessionUser = {
      email: matchedUser.email,
      username: matchedUser.username,
      name: matchedUser.name || matchedUser.username,
      role: matchedUser.role || "Klinisi / Radiografer",
      loggedInAt: new Date().toISOString(),
    };

    setStoredUser(sessionUser);
    return sessionUser;
  }

  // If not found in local DB and identifier looks like an email, try Supabase directly
  if (cleanId.includes("@") && supabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanId,
        password: cleanPassword,
      });
      if (error) throw error;

      if (data?.user) {
        const username =
          data.user.user_metadata?.username ||
          cleanId.split("@")[0];
        const sessionUser = {
          email: data.user.email,
          username,
          name: username,
          role: "Klinisi Terotentikasi",
          loggedInAt: new Date().toISOString(),
        };
        setStoredUser(sessionUser);
        return sessionUser;
      }
    } catch (remoteErr) {
      throw new Error(remoteErr.message || "Gagal masuk. Periksa kembali akun Anda.");
    }
  }

  throw new Error("Akun dengan email/username tersebut tidak ditemukan. Silakan daftar terlebih dahulu.");
}

export async function signOut() {
  setStoredUser(null);
  if (supabaseConfigured && supabase) {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Supabase signOut error:", err?.message);
    }
  }
}
