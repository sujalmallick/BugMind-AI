import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  ArrowRight,
  AlertCircle,
  Loader2,
} from "lucide-react";

import { useAuth } from "../auth/AuthContext";
import AuthLayout from "../components/auth/AuthLayout";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const mismatch =
    form.confirmPassword.length > 0 && form.password !== form.confirmPassword;

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      await register({
        name: form.name,
        email: form.email,
        password: form.password,
      });
      navigate("/");
    } catch (err) {
      setError(err?.response?.data?.detail ?? "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Projects, test cases and issue tracking in one workspace."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-signal hover:text-signal-strong hover:underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="reg-name" className="auth-label">
            Full name
          </label>
          <div className="auth-input-wrap">
            <User size={16} className="auth-input-icon" aria-hidden="true" />
            <input
              id="reg-name"
              type="text"
              autoComplete="name"
              autoFocus
              required
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="Jane Doe"
              className="auth-input"
            />
          </div>
        </div>

        <div>
          <label htmlFor="reg-email" className="auth-label">
            Work email
          </label>
          <div className="auth-input-wrap">
            <Mail size={16} className="auth-input-icon" aria-hidden="true" />
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              placeholder="you@company.com"
              className="auth-input"
            />
          </div>
        </div>

        <div>
          <label htmlFor="reg-password" className="auth-label">
            Password
          </label>
          <div className="auth-input-wrap">
            <Lock size={16} className="auth-input-icon" aria-hidden="true" />
            <input
              id="reg-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={form.password}
              onChange={(e) => updateField("password", e.target.value)}
              placeholder="At least 8 characters"
              className="auth-input"
              aria-describedby="reg-password-hint"
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
          <p id="reg-password-hint" className="mt-1.5 text-[12px] text-muted">
            Use 8 or more characters.
          </p>
        </div>

        <div>
          <label htmlFor="reg-confirm" className="auth-label">
            Confirm password
          </label>
          <div className="auth-input-wrap">
            <Lock size={16} className="auth-input-icon" aria-hidden="true" />
            <input
              id="reg-confirm"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={form.confirmPassword}
              onChange={(e) => updateField("confirmPassword", e.target.value)}
              placeholder="Re-enter your password"
              className="auth-input"
              aria-invalid={mismatch || undefined}
              aria-describedby={mismatch ? "reg-confirm-hint" : undefined}
            />
          </div>
          {mismatch && (
            <p id="reg-confirm-hint" className="mt-1.5 text-[12px] text-flagged">
              Passwords don't match yet.
            </p>
          )}
        </div>

        {error && (
          <div className="auth-error" role="alert">
            <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <div className="pt-1">
          <button type="submit" disabled={loading} className="auth-submit-btn">
            {loading ? (
              <>
                <Loader2 size={16} className="spin" aria-hidden="true" />
                Creating account…
              </>
            ) : (
              <>
                Create account
                <ArrowRight size={16} aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}
