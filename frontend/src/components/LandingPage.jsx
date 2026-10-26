
import { useState } from "react";
import {
  Mail,
  User,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { signIn, signUp } from "../services/auth.js";

export default function LandingPage({ onLoginSuccess, health }) {
  const [mode, setMode] = useState("signin");
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const online = health?.ok;
  const device = health?.device
    ? health.device.toUpperCase()
    : "CPU";

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");
    setSuccessMsg("");
    setLoading(true);

    try {
      if (mode === "signin") {
        const user = await signIn({
          identifier,
          password,
        });

        setSuccessMsg(
          `Selamat datang kembali, ${user.name || user.username}!`
        );

        onLoginSuccess(user);
      } else {
        const result = await signUp({
          email,
          username,
          password,
        });

        if (result.needsEmailConfirmation) {
          setSuccessMsg(
            result.message ||
            "Pendaftaran diterima. Periksa email untuk menyelesaikan verifikasi sebelum masuk."
          );

          setMode("signin");
          setIdentifier(email.trim().toLowerCase());
          setPassword("");
          return;
        }

        setSuccessMsg(
          `Akun @${result.username} berhasil dibuat!`
        );

        onLoginSuccess(result);
      }
    } catch (err) {
      setError(
        err?.message ||
        "Terjadi kesalahan saat memproses autentikasi."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleDemoLogin() {
    setMode("signin");
    setIdentifier("demo@gmail.com");
    setPassword("demo123");
    setError("");
    setSuccessMsg(
      "Kredensial demo terisi. Akun ini harus sudah terdaftar di Supabase agar dapat digunakan."
    );
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setError("");
    setSuccessMsg("");
  }

  const inputClass =
    "w-full rounded-xl border border-neutral-200 bg-neutral-50/50 py-3 pl-10 pr-3.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-black focus:bg-white focus:outline-none focus:ring-1 focus:ring-black";

  const labelClass =
    "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-700";

  return (
    <div className="relative flex min-h-screen flex-col bg-neutral-50 bg-monochrome-grid text-neutral-900 selection:bg-black selection:text-white">
      <main className="mx-auto flex w-full max-w-7xl flex-1 items-center px-4 py-8 sm:px-6 lg:py-12">
        <div className="grid w-full grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
          {/* QORA branding and description */}
          <section className="flex flex-col justify-center space-y-6 lg:col-span-7 lg:pr-8">
            <div className="flex items-center">
              <div className="inline-flex items-center rounded-2xl bg-black px-5 py-2.5 shadow-md">
                <img
                  src="/logo-transparent.png"
                  alt="QORA"
                  className="h-12 w-auto object-contain sm:h-14"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h1 className="text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl lg:text-5xl">
                Quantum-Optimized Radiograph Analysis
              </h1>

              <p className="max-w-2xl text-sm leading-relaxed text-neutral-600 sm:text-base">
                QORA adalah platform radiologi digital terintegrasi
                yang menggabungkan algoritma{" "}
                <em>Variational Quantum Circuit</em> (VQC 6-Qubit)
                dengan model{" "}
                <em>Deep Convolutional Neural Network</em> untuk
                mendeteksi indikasi Tuberkulosis (TB) pada citra
                Chest X-Ray secara presisi, objektif, dan transparan.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <span
                className={`h-2.5 w-2.5 rounded-full ${online ? "bg-black" : "bg-neutral-400"
                  }`}
              />
              <span>
                {online
                  ? `Backend online (${device})`
                  : "Backend offline"}
              </span>
            </div>
          </section>

          {/* Sign in and sign up panel */}
          <section className="lg:col-span-5">
            <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-7 flex rounded-xl bg-neutral-100 p-1">
                <button
                  type="button"
                  onClick={() => changeMode("signin")}
                  className={`flex-1 rounded-lg py-2.5 text-xs font-bold transition-all ${mode === "signin"
                    ? "bg-white text-black shadow-sm"
                    : "text-neutral-500 hover:text-black"
                    }`}
                >
                  Masuk (Sign In)
                </button>

                <button
                  type="button"
                  onClick={() => changeMode("signup")}
                  className={`flex-1 rounded-lg py-2.5 text-xs font-bold transition-all ${mode === "signup"
                    ? "bg-white text-black shadow-sm"
                    : "text-neutral-500 hover:text-black"
                    }`}
                >
                  Daftar (Sign Up)
                </button>
              </div>

              <div className="mb-6">
                <h2 className="text-xl font-bold tracking-tight text-neutral-950">
                  {mode === "signin"
                    ? "Selamat Datang Kembali"
                    : "Registrasi Akun Baru QORA"}
                </h2>

                <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                  {mode === "signin"
                    ? "Masukkan email atau username dan kata sandi untuk masuk ke sistem."
                    : "Lengkapi informasi berikut untuk membuat akun QORA."}
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="mb-4 flex items-start gap-2.5 rounded-xl border border-neutral-300 bg-neutral-50 p-3 text-xs text-neutral-900"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="leading-snug">{error}</span>
                </div>
              )}

              {successMsg && (
                <div
                  role="status"
                  className="mb-4 flex items-start gap-2.5 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-800"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="leading-snug">{successMsg}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === "signin" ? (
                  <div>
                    <label
                      htmlFor="qora-identifier"
                      className={labelClass}
                    >
                      Email atau Username
                    </label>

                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-neutral-400">
                        <User className="h-4 w-4" />
                      </div>

                      <input
                        id="qora-identifier"
                        type="text"
                        autoComplete="username"
                        required
                        value={identifier}
                        onChange={(e) =>
                          setIdentifier(e.target.value)
                        }
                        placeholder="example@gmail.com"
                        className={inputClass}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <label
                        htmlFor="qora-email"
                        className={labelClass}
                      >
                        Alamat Email
                      </label>

                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-neutral-400">
                          <Mail className="h-4 w-4" />
                        </div>

                        <input
                          id="qora-email"
                          type="email"
                          autoComplete="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="example@gmail.com"
                          className={inputClass}
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="qora-username"
                        className={labelClass}
                      >
                        Username
                      </label>

                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-neutral-400">
                          <User className="h-4 w-4" />
                        </div>

                        <input
                          id="qora-username"
                          type="text"
                          autoComplete="nickname"
                          required
                          minLength={3}
                          pattern="[^\s]+"
                          title="Username minimal 3 karakter dan tanpa spasi."
                          value={username}
                          onChange={(e) =>
                            setUsername(e.target.value)
                          }
                          placeholder="contoh: Ryveline"
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label
                    htmlFor="qora-password"
                    className={labelClass}
                  >
                    Kata Sandi (Password)
                  </label>

                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-neutral-400">
                      <Lock className="h-4 w-4" />
                    </div>

                    <input
                      id="qora-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={
                        mode === "signin"
                          ? "current-password"
                          : "new-password"
                      }
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="password"
                      className={`${inputClass} pr-10`}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword((value) => !value)
                      }
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-neutral-400 hover:text-black"
                      aria-label={
                        showPassword
                          ? "Sembunyikan sandi"
                          : "Tampilkan sandi"
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-black py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Memproses...
                    </span>
                  ) : (
                    <>
                      <span>
                        {mode === "signin"
                          ? "Masuk ke Sistem"
                          : "Daftar Akun"}
                      </span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 flex flex-col gap-2 border-t border-neutral-100 pt-5">
                <button
                  type="button"
                  onClick={handleDemoLogin}
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 hover:text-black"
                >
                  ⚡ Gunakan Akun Demo
                </button>

                <p className="text-center text-[11px] leading-relaxed text-neutral-400">
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-neutral-200 bg-white/80 py-4 text-center text-xs text-neutral-500">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 sm:flex-row">
          <span>
            &copy; {new Date().getFullYear()} QORA Radiograph Analysis · RJ EST. 2026. All rights reserved.
          </span>

          <span className="text-[11px] text-neutral-400">
            Quantum-Classical Hybrid Machine Learning for Thoracic Healthcare
          </span>
        </div>
      </footer>
    </div>
  );
}
