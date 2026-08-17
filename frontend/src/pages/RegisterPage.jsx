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
  Zap,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";

import { useAuth } from "../auth/AuthContext";

import logo from "../assets/bugmind2.png";
import favicon from "../assets/favicon.png";

const FEATURES = [
  {
    icon: Zap,
    title: "AI Workflow Analysis",
    sub: "Modules, risk areas & critical paths identified instantly",
  },
  {
    icon: CheckCircle2,
    title: "Execution-Ready Test Cases",
    sub: "Functional, negative & edge cases generated automatically",
  },
  {
    icon: ShieldCheck,
    title: "Full Issue Traceability",
    sub: "Every bug linked back to its test case and workflow",
  },
];

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
    <div className="hero-glow min-h-screen bg-paper">
      <div className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-4 py-10 sm:px-6">

        <div className="auth-card-enter auth-panel grid w-full lg:grid-cols-2">

          {/* ─────────── LEFT: FORM ─────────── */}
          <div className="flex flex-col justify-center px-8 py-12 sm:px-12 lg:px-16 lg:py-16">

            {/* Logo */}
            <div className="mb-8 flex items-center gap-3">
              <img src={favicon} alt="BugMind icon" className="h-10 w-10 rounded-xl object-contain" />
              <img src={logo} alt="BugMind" className="h-8 w-auto" />
            </div>

            {/* Badge + Headline */}
            <span className="mb-3 inline-flex w-fit items-center rounded-full bg-signal-soft px-3.5 py-1.5 text-xs font-semibold tracking-wide text-signal">
              Create your account
            </span>

            <h1 className="text-4xl font-bold leading-tight tracking-tight text-ink">
              Join BugMind AI.
            </h1>

            <p className="mt-3 max-w-sm text-sm leading-7 text-muted">
              Build AI-assisted testing workflows, generate test cases,
              manage issues and ship software with confidence.
            </p>

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-8 space-y-4">

              {/* Full Name */}
              <div>
                <label htmlFor="reg-name" className="mb-2 block text-sm font-semibold text-ink">
                  Full Name
                </label>
                <div className="auth-input-wrap">
                  <User size={16} className="auth-input-icon" />
                  <input
                    id="reg-name"
                    type="text"
                    autoComplete="name"
                    required
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="John Doe"
                    className="auth-input"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label htmlFor="reg-email" className="mb-2 block text-sm font-semibold text-ink">
                  Email address
                </label>
                <div className="auth-input-wrap">
                  <Mail size={16} className="auth-input-icon" />
                  <input
                    id="reg-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    placeholder="you@example.com"
                    className="auth-input"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="reg-password" className="mb-2 block text-sm font-semibold text-ink">
                  Password
                </label>
                <div className="auth-input-wrap">
                  <Lock size={16} className="auth-input-icon" />
                  <input
                    id="reg-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={form.password}
                    onChange={(e) => updateField("password", e.target.value)}
                    placeholder="At least 8 characters"
                    className="auth-input"
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

              {/* Confirm Password */}
              <div>
                <label htmlFor="reg-confirm" className="mb-2 block text-sm font-semibold text-ink">
                  Confirm Password
                </label>
                <div className="auth-input-wrap">
                  <Lock size={16} className="auth-input-icon" />
                  <input
                    id="reg-confirm"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={form.confirmPassword}
                    onChange={(e) => updateField("confirmPassword", e.target.value)}
                    placeholder="Re-enter your password"
                    className="auth-input"
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="auth-error" role="alert">
                  <AlertCircle size={15} className="mt-px shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="auth-submit-btn"
              >
                {loading ? (
                  <>
                    <Loader2 size={17} className="spin" />
                    Creating Account…
                  </>
                ) : (
                  <>
                    Create Account
                    <ArrowRight size={17} />
                  </>
                )}
              </button>

              <p className="pt-1 text-center text-sm text-muted">
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="font-semibold text-signal hover:underline"
                >
                  Sign In
                </Link>
              </p>
            </form>

          </div>

          {/* ─────────── RIGHT: HERO PANEL ─────────── */}
          <div className="auth-hero-panel">

            {/* Animated blobs */}
            <div className="auth-blob auth-blob-1" />
            <div className="auth-blob auth-blob-2" />
            <div className="auth-blob auth-blob-3" />

            <div className="relative z-10 flex h-full flex-col justify-between p-12 lg:p-16">

              {/* Top content */}
              <div>
                <span className="inline-block rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/90">
                  BugMind AI
                </span>

                <h2 className="mt-8 text-4xl font-bold leading-tight text-white lg:text-5xl">
                  Smarter QA.
                  <br />
                  Faster Releases.
                </h2>

                <p className="mt-5 max-w-xs text-sm leading-7 text-blue-100/85">
                  Transform workflows into intelligent test cases, discover
                  hidden defects, and manage your complete QA lifecycle
                  from one elegant workspace.
                </p>
              </div>

              {/* Feature cards */}
              <div className="mt-10 flex flex-col gap-3">
                {FEATURES.map(({ icon: Icon, title, sub }) => (
                  <div key={title} className="auth-feature-card">
                    <div className="auth-feature-icon">
                      <Icon size={15} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold leading-5 text-white">{title}</p>
                      <p className="mt-0.5 text-xs leading-5 text-blue-200/75">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}