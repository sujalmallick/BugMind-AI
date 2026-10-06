import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Mail,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

import { requestPasswordReset } from "../auth/authService";
import AuthLayout from "../components/auth/AuthLayout";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [sentMessage, setSentMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setNotFound(false);
    try {
      setLoading(true);
      const data = await requestPasswordReset(email);
      setSentMessage(data.message);
    } catch (err) {
      const status = err?.response?.status;
      if (!err?.response) {
        setError("Can't reach the server. Please check your connection and try again in a minute.");
      } else if (status === 429) {
        setError("Too many requests. Please wait a minute and try again.");
      } else {
        setNotFound(status === 404);
        setError(err.response.data?.detail ?? "Unable to send reset link. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title={sentMessage ? "Check your inbox" : "Reset your password"}
      subtitle={
        sentMessage
          ? null
          : "Enter the email you signed up with and we'll send you a reset link."
      }
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
      {sentMessage ? (
        <div className="space-y-5">
          <div className="auth-success" role="status">
            <CheckCircle2 size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              {sentMessage} The link expires in 30 minutes. Check your spam folder if you don't see it.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSentMessage("")}
            className="text-sm font-medium text-signal hover:text-signal-strong hover:underline underline-offset-4"
          >
            Didn't get it? Send again
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="forgot-email" className="auth-label">
              Email
            </label>
            <div className="auth-input-wrap">
              <Mail size={16} className="auth-input-icon" aria-hidden="true" />
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="auth-input"
                placeholder="you@company.com"
              />
            </div>
          </div>

          {error && (
            <div className="auth-error" role="alert">
              <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                {error}{" "}
                {notFound && (
                  <Link to="/register" className="font-semibold underline">
                    Create an account
                  </Link>
                )}
              </span>
            </div>
          )}

          <button type="submit" disabled={loading} className="auth-submit-btn">
            {loading ? (
              <>
                <Loader2 size={16} className="spin" aria-hidden="true" />
                Sending link…
              </>
            ) : (
              <>
                Send reset link
                <ArrowRight size={16} aria-hidden="true" />
              </>
            )}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
