import { useState } from "react";
import {
  Mail,
  User,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
  Cpu,
  Sparkles,
  Activity,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { signIn, signUp } from "../services/auth.js";

export default function LandingPage({ onLoginSuccess, health }) {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"

  // Form states
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Status states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const online = health?.ok;
  const device = health?.device ? health.device.toUpperCase() : "CPU";

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);

    try {
      if (mode === "signin") {
        const user = await signIn({ identifier, password });
        setSuccessMsg(`Selamat datang kembali, ${user.name || user.username}! Mengalihkan ke sistem...`);
        setTimeout(() => {
          onLoginSuccess(user);
        }, 400);
      } else {
        const user = await signUp({ email, username, password });
        setSuccessMsg(`Akun @${user.username} berhasil dibuat! Mengalihkan ke sistem...`);
        setTimeout(() => {
          onLoginSuccess(user);
        }, 500);
      }
    } catch (err) {
      setError(err?.message || "Terjadi kesalahan saat memproses autentikasi.");
    } finally {
      setLoading(false);
    }
  }

  function handleDemoLogin() {
    setMode("signin");
    setIdentifier("dr_radiologi");
    setPassword("password123");
    setError("");
    setSuccessMsg("Kredensial akun demo terisi. Klik 'Masuk ke Sistem' untuk melanjutkan.");
  }

  return (
    <div className="relative min-h-screen bg-neutral-50 bg-monochrome-grid text-neutral-900 flex flex-col justify-between selection:bg-black selection:text-white">
      {/* Top micro bar */}
      <header className="border-b border-neutral-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-xl bg-black px-3.5 py-1.5 shadow-sm">
              <img
                src="/logo-transparent.png"
                alt="QORA Logo"
                className="h-7 w-auto object-contain"
              />
            </div>
            <div className="hidden border-l border-neutral-200 pl-3 sm:block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Quantum-Optimized Radiograph Analysis
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs text-neutral-700">
            <span className="relative flex h-2 w-2">
              {online ? (
                <>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-black opacity-30"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-black"></span>
                </>
              ) : (
                <span className="relative inline-flex h-2 w-2 rounded-full bg-neutral-400"></span>
              )}
            </span>
            <span className="text-[11px] font-medium">
              {online ? `Online (${device})` : "Offline"}
            </span>
          </div>
        </div>
      </header>

      {/* Main Landing & Auth Grid */}
      <main className="mx-auto flex w-full max-w-7xl flex-1 items-center px-4 py-8 sm:px-6 lg:py-16">
        <div className="grid w-full grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">

          {/* Left Column: Brand, Short Description, Clinical Value */}
          <div className="flex flex-col justify-center space-y-8 lg:col-span-7 lg:pr-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-3.5 py-1 text-xs font-semibold text-neutral-800 shadow-sm">
                <Sparkles className="h-3.5 w-3.5 text-black" />
                <span>Clinical Decision Support System</span>
              </div>

              {/* Large QORA Logo Branding */}
              <div className="flex items-center gap-4 pt-1">
                <div className="inline-flex items-center rounded-2xl bg-black px-5 py-2.5 shadow-md">
                  <img
                    src="/logo-transparent.png"
                    alt="QORA Radiograph Analysis"
                    className="h-10 sm:h-12 w-auto object-contain"
                  />
                </div>
              </div>

              {/* Short explanation of what the website is */}
              <h1 className="text-2xl font-bold tracking-tight text-neutral-950 sm:text-3xl lg:text-4xl">
                Quantum-Optimized Radiograph Analysis
              </h1>

              <p className="max-w-2xl text-sm leading-relaxed text-neutral-600 sm:text-base">
                QORA adalah platform radiologi digital terintegrasi yang menggabungkan algoritma <em>Variational Quantum Circuit</em> (VQC 6-Qubit) dengan model <em>Deep Convolutional</em> untuk mendeteksi indikasi Tuberkulosis (TB) pada citra Chest X-Ray secara presisi, objektif, dan transparan.
              </p>
            </div>

            {/* Three key pillars */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-300">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 text-black mb-3">
                  <Cpu className="h-4 w-4" />
                </div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-900">
                  Hybrid QCNN
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                  Klasifikasi kuantum 6-qubit berbasis PennyLane untuk komputasi batas keputusan optimal.
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-300">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 text-black mb-3">
                  <Activity className="h-4 w-4" />
                </div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-900">
                  Atensi Grad-CAM
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                  Visualisasi peta panas atensi jaringan pada area infiltrat dan kavitas lapang paru.
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-300">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 text-black mb-3">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-900">
                  Interpretasi AI
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                  Rangkuman klinis terstruktur 4-poin dan asisten tanya-jawab interaktif terintegrasi.
                </p>
              </div>
            </div>

            {/* Cautious disclaimer note */}
            <div className="rounded-xl border border-neutral-200 bg-white/70 p-3.5 text-xs text-neutral-500">
              <strong className="text-neutral-900 font-semibold">Pemberitahuan Medis:</strong> QORA dirancang khusus sebagai alat bantu skrining dan pendukung keputusan klinis tenaga medis, bukan pengganti pemeriksaan radiologi definitif atau konfirmasi mikrobiologis (TCM/BTA).
            </div>
          </div>

          {/* Right Column: Authentication Card (Sign In / Sign Up) */}
          <div className="lg:col-span-5">
            <div className="relative rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">

              {/* Segmented Mode Switch */}
              <div className="flex rounded-xl bg-neutral-100 p-1 mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setError("");
                    setSuccessMsg("");
                  }}
                  className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${mode === "signin"
                    ? "bg-white text-black shadow-sm"
                    : "text-neutral-500 hover:text-black"
                    }`}
                >
                  Masuk (Sign In)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setError("");
                    setSuccessMsg("");
                  }}
                  className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${mode === "signup"
                    ? "bg-white text-black shadow-sm"
                    : "text-neutral-500 hover:text-black"
                    }`}
                >
                  Daftar (Sign Up)
                </button>
              </div>

              {/* Title & prompt */}
              <div className="mb-6">
                <h2 className="text-xl font-bold tracking-tight text-neutral-950">
                  {mode === "signin" ? "Akses Workstation Radiologi" : "Registrasi Akun Baru QORA"}
                </h2>
                <p className="mt-1 text-xs text-neutral-500">
                  {mode === "signin"
                    ? "Masukkan email atau username dan kata sandi untuk masuk ke sistem."
                    : "Lengkapi data email, username, dan kata sandi untuk membuat akun klinisi."}
                </p>
              </div>

              {/* Feedback Alerts */}
              {error && (
                <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-neutral-300 bg-neutral-50 p-3 text-xs text-neutral-900">
                  <AlertCircle className="h-4 w-4 shrink-0 text-black mt-0.5" />
                  <span className="leading-snug">{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-black bg-black p-3 text-xs text-white">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-white mt-0.5" />
                  <span className="leading-snug">{successMsg}</span>
                </div>
              )}

              {/* Auth Form */}
              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Sign In Mode: Email or Username */}
                {mode === "signin" ? (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5">
                      Email atau Username
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-neutral-400">
                        <User className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        required
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="contoh: dr_radiologi atau user@qora.med"
                        className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 py-2.5 pl-10 pr-3.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-black focus:bg-white focus:outline-none focus:ring-1 focus:ring-black"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Sign Up Mode: Email */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5">
                        Alamat Email
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-neutral-400">
                          <Mail className="h-4 w-4" />
                        </div>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="nama@institusi-medis.id"
                          className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 py-2.5 pl-10 pr-3.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-black focus:bg-white focus:outline-none focus:ring-1 focus:ring-black"
                        />
                      </div>
                    </div>

                    {/* Sign Up Mode: Username */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5">
                        Username
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-neutral-400">
                          <User className="h-4 w-4" />
                        </div>
                        <input
                          type="text"
                          required
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="contoh: dr_ahmad (tanpa spasi)"
                          className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 py-2.5 pl-10 pr-3.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-black focus:bg-white focus:outline-none focus:ring-1 focus:ring-black"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Password field (used in both) */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5">
                    Kata Sandi (Password)
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-neutral-400">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 py-2.5 pl-10 pr-10 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-black focus:bg-white focus:outline-none focus:ring-1 focus:ring-black"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-neutral-400 hover:text-black"
                      aria-label={showPassword ? "Sembunyikan sandi" : "Tampilkan sandi"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-black py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 active:scale-[0.99] disabled:opacity-60"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                      <span>Memproses...</span>
                    </span>
                  ) : (
                    <>
                      <span>{mode === "signin" ? "Masuk ke Sistem" : "Daftar & Masuk ke Sistem"}</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Quick fill demo credentials button */}
              <div className="mt-6 pt-5 border-t border-neutral-100 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleDemoLogin}
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 hover:text-black"
                >
                  ⚡ Gunakan Akun Demo (dr_radiologi)
                </button>
                <p className="text-[11px] text-center text-neutral-400">
                  Untuk pengujian cepat tanpa registrasi manual.
                </p>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Footer Minimal */}
      <footer className="border-t border-neutral-200 bg-white/80 py-4 text-center text-xs text-neutral-500">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; {new Date().getFullYear()} QORA Platform. Hak cipta dilindungi.</span>
          <span className="text-[11px] text-neutral-400">
            ResNet-50 + 6-Qubit PennyLane VQC · Multimodal Clinical Intelligence
          </span>
        </div>
      </footer>
    </div>
  );
}
