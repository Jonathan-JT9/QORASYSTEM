
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

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);

    try {
      if (mode === "signin") {
        const user = await signIn({ identifier, password });
        setSuccessMsg(
          `Selamat datang kembali, ${user.name || user.username}!`
        );
        onLoginSuccess(user);
      } else {
        const result = await signUp({ email, username, password });

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

        setSuccessMsg(`Akun @${result.username} berhasil dibuat!`);
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

  return (
    <div className="qora-auth">
      <main className="qora-auth-main">
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
              <span><Layers size={15} /></span>
              <strong>Grad-CAM</strong>
              <small>Visual explanation</small>
            </div>

            <div>
              <span><Sparkles size={15} /></span>
              <strong>AI-assisted</strong>
              <small>Clinical interpretation</small>
            </div>

            <div>
              <span><ShieldCheck size={15} /></span>
              <strong>Review first</strong>
              <small>Decision support</small>
            </div>
          </div>
        </section>

        <section
          className="qora-auth-form-side"
          aria-label="Authentication"
        >
          <div className="qora-auth-form-card">
            <div className="qora-auth-form-heading">
              <h2>
                {mode === "signin"
                  ? "Welcome back."
                  : "Create your account."}
              </h2>

              <p>
                {mode === "signin"
                  ? "Masuk untuk melanjutkan pemeriksaan radiograf menggunakan QORA."
                  : "Buat akun untuk mulai menggunakan QORA."}
              </p>
            </div>

            <div
              className="qora-auth-tabs"
              role="tablist"
              aria-label="Authentication mode"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signin"}
                onClick={() => changeMode("signin")}
                className={
                  mode === "signin" ? "is-active" : ""
                }
              >
                Sign in
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={mode === "signup"}
                onClick={() => changeMode("signup")}
                className={
                  mode === "signup" ? "is-active" : ""
                }
              >
                Create account
              </button>
            </div>

            {error && (
              <div
                role="alert"
                className="qora-auth-message is-error"
              >
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div
                role="status"
                className="qora-auth-message"
              >
                <CheckCircle2 size={16} />
                <span>{successMsg}</span>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="qora-auth-form"
            >
              {mode === "signin" ? (
                <div className="qora-field">
                  <label htmlFor="qora-identifier">
                    Email or username
                  </label>

                  <div className="qora-input-wrap">
                    <User size={16} />

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
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="qora-field">
                    <label htmlFor="qora-email">
                      Email address
                    </label>

                    <div className="qora-input-wrap">
                      <Mail size={16} />

                      <input
                        id="qora-email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) =>
                          setEmail(e.target.value)
                        }
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>

                  <div className="qora-field">
                    <label htmlFor="qora-username">
                      Username
                    </label>

                    <div className="qora-input-wrap">
                      <User size={16} />

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
                        placeholder="your username"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="qora-field">
                <label htmlFor="qora-password">
                  Password
                </label>

                <div className="qora-input-wrap">
                  <Lock size={16} />

                  <input
                    id="qora-password"
                    type={
                      showPassword ? "text" : "password"
                    }
                    autoComplete={
                      mode === "signin"
                        ? "current-password"
                        : "new-password"
                    }
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) =>
                      setPassword(e.target.value)
                    }
                    placeholder="Enter your password"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword((value) => !value)
                    }
                    aria-label={
                      showPassword
                        ? "Sembunyikan sandi"
                        : "Tampilkan sandi"
                    }
                    className="qora-password-toggle"
                  >
                    {showPassword
                      ? <EyeOff size={16} />
                      : <Eye size={16} />}
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
                    Processing…
                  </>
                ) : (
                  <>
                    {mode === "signin"
                      ? "Enter QORA"
                      : "Create account"}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            <div className="qora-auth-divider">
              <span />
              <small>OR</small>
              <span />
            </div>

            <button
              type="button"
              onClick={handleDemoLogin}
              className="qora-demo-button"
            >
              Fill demo credentials
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="qora-auth-security">
            <ShieldCheck size={14} />
            <span>
              Secure access to your clinical workspace
            </span>
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
