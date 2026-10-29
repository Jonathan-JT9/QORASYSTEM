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
  Layers,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { signIn, signUpDoctorAccount } from "../services/auth.js";

export default function LandingPage({ onLoginSuccess, health }) {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"

  // Sign In state
  const [identifier, setIdentifier] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [showSignInPassword, setShowSignInPassword] = useState(false);

  // Doctor Account Sign Up state (Hanya nama, email, username, dan password)
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  async function handleSignInSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);

    try {
      const user = await signIn({
        identifier: identifier.trim(),
        password: signInPassword,
      });

      setSuccessMsg(`Selamat datang, ${user.name || user.username}!`);
      onLoginSuccess(user);
    } catch (err) {
      setError(err?.message || "Terjadi kesalahan saat memproses login.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUpSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (signUpPassword !== confirmPassword) {
      setError("Konfirmasi kata sandi tidak cocok.");
      return;
    }

    setLoading(true);

    try {
      const result = await signUpDoctorAccount({
        fullName,
        email,
        username,
        password: signUpPassword,
      });

      if (result.needsEmailConfirmation) {
        setSuccessMsg(
          result.message ||
            "Pendaftaran akun berhasil! Silakan periksa email Anda untuk verifikasi sebelum masuk."
        );
        setMode("signin");
        setIdentifier(email.trim().toLowerCase());
        setSignInPassword("");
        return;
      }

      setSuccessMsg(
        result.message ||
          "Akun dokter berhasil dibuat! Mengalihkan ke pengisian kredensial…"
      );
      onLoginSuccess(result);
    } catch (err) {
      setError(err?.message || "Pembuatan akun dokter gagal diproses.");
    } finally {
      setLoading(false);
    }
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setError("");
    setSuccessMsg("");
  }

  return (
    <div className="qora-auth min-h-screen flex flex-col justify-between">
      <main className="qora-auth-main">
        {/* Left Side: Brand Story & Feature Highlights */}
        <section className="qora-auth-story">
          <div className="qora-auth-title-row">
            <div className="qora-auth-title-mark">
              <img src="/tiny-logo.png" alt="QORA" />
            </div>

            <div className="qora-auth-hero-title">
              <h1>
                <span>Quantum-Optimized</span>
                <span>Radiograph Analysis</span>
              </h1>
            </div>
          </div>

          <div className="qora-auth-image-card">
            <div className="qora-auth-image-window">
              <img
                src="/education-normal.png"
                alt="Contoh radiograf toraks untuk referensi visual"
              />
              <span className="qora-auth-image-corner qora-auth-corner-a" />
              <span className="qora-auth-image-corner qora-auth-corner-b" />
              <span className="qora-auth-image-corner qora-auth-corner-c" />
              <span className="qora-auth-image-corner qora-auth-corner-d" />
            </div>
          </div>

          <div className="qora-auth-feature-row">
            <div>
              <span>
                <Layers size={15} />
              </span>
              <strong>Grad-CAM</strong>
              <small>Explainable attention map</small>
            </div>

            <div>
              <span>
                <Sparkles size={15} />
              </span>
              <strong>AI Clinical</strong>
              <small>Gemini decision support</small>
            </div>

            <div>
              <span>
                <ShieldCheck size={15} />
              </span>
              <strong>Doctor-Only</strong>
              <small>Verified credentials access</small>
            </div>
          </div>
        </section>

        {/* Right Side: Shared Sign In & Doctor Registration */}
        <section
          className="qora-auth-form-side"
          aria-label="Portal Autentikasi QORA"
        >
          <div className="qora-auth-form-card">
            <div className="qora-auth-form-heading">
              <h2>
                {mode === "signin"
                  ? "Welcome back."
                  : "Create doctor account."}
              </h2>

              <p>
                {mode === "signin"
                  ? "Masuk ke workspace QORA menggunakan email atau username dokter / administrator."
                  : "Buat akun dokter Anda terlebih dahulu. Kredensial STR dan tempat praktik akan dilengkapi setelah akun aktif."}
              </p>
            </div>

            {/* Mode Switcher */}
            <div
              className="qora-auth-tabs"
              role="tablist"
              aria-label="Mode autentikasi"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signin"}
                onClick={() => changeMode("signin")}
                className={mode === "signin" ? "is-active" : ""}
              >
                Sign in
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={mode === "signup"}
                onClick={() => changeMode("signup")}
                className={mode === "signup" ? "is-active" : ""}
              >
                Buat Akun Dokter
              </button>
            </div>

            {/* Feedback Messages */}
            {error && (
              <div role="alert" className="qora-auth-message is-error">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div role="status" className="qora-auth-message">
                <CheckCircle2 size={16} />
                <span>{successMsg}</span>
              </div>
            )}

            {/* SIGN IN FORM */}
            {mode === "signin" && (
              <form onSubmit={handleSignInSubmit} className="qora-auth-form">
                <div className="qora-field">
                  <label htmlFor="qora-identifier">Email or username</label>
                  <div className="qora-input-wrap">
                    <User size={16} />
                    <input
                      id="qora-identifier"
                      type="text"
                      autoComplete="username"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="Email atau username Anda"
                    />
                  </div>
                </div>

                <div className="qora-field">
                  <label htmlFor="qora-signin-password">Password</label>
                  <div className="qora-input-wrap">
                    <Lock size={16} />
                    <input
                      id="qora-signin-password"
                      type={showSignInPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={signInPassword}
                      onChange={(e) => setSignInPassword(e.target.value)}
                      placeholder="Masukkan kata sandi"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignInPassword((v) => !v)}
                      aria-label={
                        showSignInPassword
                          ? "Sembunyikan sandi"
                          : "Tampilkan sandi"
                      }
                      className="qora-password-toggle"
                    >
                      {showSignInPassword ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="qora-button qora-button-dark qora-auth-submit"
                >
                  {loading ? (
                    <>
                      <span className="qora-processing-spinner" />
                      Memverifikasi…
                    </>
                  ) : (
                    <>
                      Enter QORA
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* DOCTOR ACCOUNT SIGN UP FORM */}
            {mode === "signup" && (
              <form onSubmit={handleSignUpSubmit} className="space-y-4 pt-1">
                <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-3 text-[11px] text-neutral-600 space-y-1">
                  <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                    <ShieldCheck size={13} className="text-black" />
                    <span>Langkah 1 dari 2: Pembuatan Akun Dokter</span>
                  </div>
                  <p>
                    Isi data identitas dasar untuk membuat akun. Unggah dokumen
                    STR dan informasi tempat praktik akan dilakukan setelah akun aktif.
                  </p>
                </div>

                <div className="qora-field">
                  <label htmlFor="reg-fullname">Nama Lengkap & Gelar Medis</label>
                  <div className="qora-input-wrap">
                    <User size={16} />
                    <input
                      id="reg-fullname"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Contoh: dr. Siti Rahma, Sp.Rad"
                    />
                  </div>
                </div>

                <div className="qora-field">
                  <label htmlFor="reg-email">Alamat Email</label>
                  <div className="qora-input-wrap">
                    <Mail size={16} />
                    <input
                      id="reg-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="dokter@gmail.com"
                    />
                  </div>
                </div>

                <div className="qora-field">
                  <label htmlFor="reg-username">Username</label>
                  <div className="qora-input-wrap">
                    <User size={16} />
                    <input
                      id="reg-username"
                      type="text"
                      required
                      minLength={3}
                      pattern="[a-zA-Z0-9_]+"
                      title="Username hanya boleh berisi huruf, angka, dan garis bawah tanpa spasi."
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="username_dokter"
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="qora-field">
                    <label htmlFor="reg-password">Kata Sandi</label>
                    <div className="qora-input-wrap">
                      <Lock size={16} />
                      <input
                        id="reg-password"
                        type={showSignUpPassword ? "text" : "password"}
                        required
                        minLength={6}
                        value={signUpPassword}
                        onChange={(e) => setSignUpPassword(e.target.value)}
                        placeholder="Min. 6 karakter"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignUpPassword((v) => !v)}
                        className="qora-password-toggle"
                      >
                        {showSignUpPassword ? (
                          <EyeOff size={15} />
                        ) : (
                          <Eye size={15} />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="qora-field">
                    <label htmlFor="reg-confirm">Konfirmasi Sandi</label>
                    <div className="qora-input-wrap">
                      <Lock size={16} />
                      <input
                        id="reg-confirm"
                        type={showSignUpPassword ? "text" : "password"}
                        required
                        minLength={6}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Ulangi kata sandi"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="qora-button qora-button-dark qora-auth-submit w-full mt-2"
                >
                  {loading ? (
                    <>
                      <span className="qora-processing-spinner" />
                      Mendaftarkan Akun…
                    </>
                  ) : (
                    <>
                      Buat Akun Dokter
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          <div className="qora-auth-security">
            <ShieldCheck size={14} />
            <span>Secure Role-Based Access Control · QORA RBAC</span>
          </div>
        </section>
      </main>

      <footer className="qora-auth-footer">
        <span>
          © {new Date().getFullYear()} QORA Radiograph Analysis · RJ EST. 2026
        </span>
      </footer>
    </div>
  );
}
