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

import logo from "../assets/bugmind2.png";
import favicon from "../assets/favicon.png";

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
    <div className="hero-glow min-h-screen bg-paper">
      <div className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-4 py-10 sm:px-6">
        <div className="auth-card-enter auth-panel w-full max-w-md px-8 py-12 sm:px-10">

          {/* Logo */}
          <Link to="/login" className="mb-10 flex items-center gap-3 transition-opacity hover:opacity-85">
            <img src={favicon} alt="BugMind icon" className="h-10 w-10 rounded-xl object-contain" />
            <img src={logo} alt="BugMind" className="h-8 w-auto" />
          </Link>

          <h1 className="text-3xl font-bold leading-tight tracking-tight text-ink">
            Forgot your password?
          </h1>
          <p className="mt-3 text-sm leading-7 text-muted">
            Enter the email you signed up with and we'll send you a link to reset it.
          </p>

          {sentMessage ? (
            <div className="mt-8 space-y-5">
              <div className="auth-success" role="status">
                <CheckCircle2 size={15} className="mt-px shrink-0" />
                <span>
                  {sentMessage} The link expires in 30 minutes. Check your spam folder if you don't see it.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSentMessage("")}
                className="text-sm font-semibold text-signal hover:underline"
              >
                Didn't get it? Send again
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label htmlFor="forgot-email" className="mb-2 block text-sm font-semibold text-ink">
                  Email address
                </label>
                <div className="auth-input-wrap">
                  <Mail size={16} className="auth-input-icon" />
                  <input
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    className="auth-input"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              {error && (
                <div className="auth-error" role="alert">
                  <AlertCircle size={15} className="mt-px shrink-0" />
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
                    <Loader2 size={17} className="spin" />
                    Sending link…
                  </>
                ) : (
                  <>
                    Send Reset Link
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>
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
