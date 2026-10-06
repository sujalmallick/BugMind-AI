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
import AuthLayout from "../components/auth/AuthLayout";

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

  const subtitle = !token
    ? null
    : done
      ? null
      : `Choose a password with at least ${MIN_LENGTH} characters.`;

  return (
    <AuthLayout
      variant="centered"
      title="Set a new password"
      subtitle={subtitle}
      footer={
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 font-medium text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Back to sign in
        </Link>
      }
    >
      {!token ? (
        <div className="space-y-5">
          <div className="auth-error" role="alert">
            <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>This reset link is missing its token. Use the link from your email, or request a new one.</span>
          </div>
          <Link to="/forgot-password" className="auth-submit-btn">
            Request a new link
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      ) : done ? (
        <div className="space-y-5">
          <div className="auth-success" role="status">
            <CheckCircle2 size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>Your password has been reset. You've been signed out everywhere else, so sign in with your new password.</span>
          </div>
          <button type="button" onClick={() => navigate("/login", { replace: true })} className="auth-submit-btn">
            Go to sign in
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="reset-password" className="auth-label">
              New password
            </label>
            <div className="auth-input-wrap">
              <Lock size={16} className="auth-input-icon" aria-hidden="true" />
              <input
                id="reset-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                className="auth-input"
                placeholder={`At least ${MIN_LENGTH} characters`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="auth-eye-btn"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="reset-confirm" className="auth-label">
              Confirm new password
            </label>
            <div className="auth-input-wrap">
              <Lock size={16} className="auth-input-icon" aria-hidden="true" />
              <input
                id="reset-confirm"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="auth-input"
                placeholder="Re-enter the new password"
              />
            </div>
          </div>

          {error && (
            <div className="auth-error" role="alert">
              <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
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
                <Loader2 size={16} className="spin" aria-hidden="true" />
                Resetting…
              </>
            ) : (
              <>
                Reset password
                <ArrowRight size={16} aria-hidden="true" />
              </>
            )}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
