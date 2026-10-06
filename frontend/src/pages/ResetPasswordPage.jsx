import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Eye,
  EyeOff,
  Lock,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

import { resetPassword } from "../auth/authService";

import logo from "../assets/bugmind2.png";
import favicon from "../assets/favicon.png";

const MIN_LENGTH = 8;

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password.length < MIN_LENGTH) {
      setError(`Password must be at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    try {
      setLoading(true);
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      if (err?.response?.status === 429) {
        setError("Too many attempts. Please wait a minute and try again.");
      } else {
        setError(err?.response?.data?.detail ?? "Unable to reset password. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="hero-glow min-h-screen bg-paper">
      <div className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-4 py-10 sm:px-6">
        <div className="auth-card-enter auth-panel w-full max-w-md px-8 py-12 sm:px-10">

          {/* Logo */}
          <Link to="/login" className="mb-10 flex items-center gap-3 transition-opacity hover:opacity-85">
            <img src={favicon} alt="BugMind icon" className="h-10 w-10 rounded-xl object-contain" />
            <img src={logo} alt="BugMind" className="h-8 w-auto" />
          </Link>

          <h1 className="text-3xl font-bold leading-tight tracking-tight text-ink">
            Set a new password
          </h1>

          {!token ? (
            <div className="mt-8 space-y-5">
              <div className="auth-error" role="alert">
                <AlertCircle size={15} className="mt-px shrink-0" />
                <span>This reset link is missing its token. Please use the link from your email, or request a new one.</span>
              </div>
              <Link to="/forgot-password" className="auth-submit-btn">
                Request a new link
                <ArrowRight size={17} />
              </Link>
            </div>
          ) : done ? (
            <div className="mt-8 space-y-5">
              <div className="auth-success" role="status">
                <CheckCircle2 size={15} className="mt-px shrink-0" />
                <span>Your password has been reset. You've been signed out everywhere else, so sign in with your new password.</span>
              </div>
              <button type="button" onClick={() => navigate("/login", { replace: true })} className="auth-submit-btn">
                Go to Sign In
                <ArrowRight size={17} />
              </button>
            </div>
          ) : (
            <>
              <p className="mt-3 text-sm leading-7 text-muted">
                Choose a password with at least {MIN_LENGTH} characters.
              </p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <div>
                  <label htmlFor="reset-password" className="mb-2 block text-sm font-semibold text-ink">
                    New password
                  </label>
                  <div className="auth-input-wrap">
                    <Lock size={16} className="auth-input-icon" />
                    <input
                      id="reset-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoFocus
                      className="auth-input"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="auth-eye-btn"
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="reset-confirm" className="mb-2 block text-sm font-semibold text-ink">
                    Confirm new password
                  </label>
                  <div className="auth-input-wrap">
                    <Lock size={16} className="auth-input-icon" />
                    <input
                      id="reset-confirm"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      className="auth-input"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                {error && (
                  <div className="auth-error" role="alert">
                    <AlertCircle size={15} className="mt-px shrink-0" />
                    <span>
                      {error}{" "}
                      {error.includes("expired") && (
                        <Link to="/forgot-password" className="font-semibold underline">
                          Request a new link
                        </Link>
                      )}
                    </span>
                  </div>
                )}

                <button type="submit" disabled={loading} className="auth-submit-btn">
                  {loading ? (
                    <>
                      <Loader2 size={17} className="spin" />
                      Resetting…
                    </>
                  ) : (
                    <>
                      Reset Password
                      <ArrowRight size={17} />
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          <Link
            to="/login"
            className="mt-8 flex items-center justify-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-signal"
          >
            <ArrowLeft size={15} />
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
