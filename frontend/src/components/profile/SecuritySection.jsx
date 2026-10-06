import { useState, useId } from "react";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { changePassword } from "../../auth/profileService";

/**
 * SecuritySection — password change form.
 *
 * Props:
 *   showToast (msg) => void
 *
 * NOTE FOR FUTURE MAINTAINERS:
 * Session/device management (listing active sessions, "log out other devices"
 * as an explicit action) is a natural addition to this section. The
 * credentials_updated_at mechanism already invalidates all other sessions on
 * password change. A future UI here could list sessions from a sessions table
 * and allow selective revocation — no structural changes to this component
 * would be needed; just add a <SessionList /> below the form.
 */
export default function SecuritySection({ showToast }) {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw]         = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving]       = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    if (newPw !== confirmPw) {
      showToast("New passwords do not match.", "error");
      return;
    }

    if (newPw.length < 8) {
      showToast("New password must be at least 8 characters.", "error");
      return;
    }

    setSaving(true);
    try {
      await changePassword(currentPw, newPw);
      showToast("Password changed. Other sessions have been logged out.");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err) {
      const msg = err?.response?.data?.detail ?? "Failed to change password.";
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="signal-card p-5 sm:p-7">
      <h2 className="text-lg font-semibold text-ink mb-1">Security</h2>
      <p className="text-sm text-muted mb-6">
        Changing your password will log out all other active sessions.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm">
        <PasswordField
          label="Current password"
          value={currentPw}
          onChange={setCurrentPw}
          show={showCurrent}
          onToggle={() => setShowCurrent((v) => !v)}
          autoComplete="current-password"
        />
        <PasswordField
          label="New password"
          value={newPw}
          onChange={setNewPw}
          show={showNew}
          onToggle={() => setShowNew((v) => !v)}
          autoComplete="new-password"
        />
        <PasswordField
          label="Confirm new password"
          value={confirmPw}
          onChange={setConfirmPw}
          show={showNew}
          onToggle={() => setShowNew((v) => !v)}
          autoComplete="new-password"
        />

        <div>
          <button
            type="submit"
            className="btn-primary"
            disabled={saving || !currentPw || !newPw || !confirmPw}
          >
            {saving && <Loader2 size={14} className="spin" />}
            Update password
          </button>
        </div>
      </form>
    </section>
  );
}

function PasswordField({ label, value, onChange, show, onToggle, autoComplete }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-medium text-ink mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required
          className="field !pr-10"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={show}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors"
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );
}
