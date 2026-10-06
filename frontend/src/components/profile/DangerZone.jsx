import { useState } from "react";
import { TriangleAlert, Loader2 } from "lucide-react";
import { deleteAccount } from "../../auth/profileService";
import ConfirmDialog from "../common/ConfirmDialog";
import { useAuth } from "../../auth/AuthContext";
import { useNavigate } from "react-router-dom";

/**
 * DangerZone — account deletion with password confirmation and ConfirmDialog.
 *
 * Props:
 *   showToast (msg) => void
 *
 * Uses the existing ConfirmDialog component (not native confirm()).
 * The delete is soft: backend sets deleted_at + deleted_by, never drops the row.
 */
export default function DangerZone({ showToast }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function handleOpenDialog(e) {
    e.preventDefault();
    if (!password) {
      showToast("Please enter your password to confirm deletion.", "error");
      return;
    }
    setDialogOpen(true);
  }

  async function handleConfirmDelete() {
    setDialogOpen(false);
    setDeleting(true);
    try {
      await deleteAccount(password);
      showToast("Account deleted. Logging you out…");
      // Short delay so the toast is visible, then log out
      setTimeout(() => {
        logout();
        navigate("/login");
      }, 1500);
    } catch (err) {
      const msg = err?.response?.data?.detail ?? "Failed to delete account. Check your password.";
      showToast(msg, "error");
      setDeleting(false);
    }
  }

  return (
    <>
      {/* Red-bordered danger card — variant of .signal-card */}
      <section
        className="signal-card p-5 sm:p-7"
        style={{ borderColor: "var(--color-flagged, #dc2626)", borderWidth: "1.5px" }}
      >
        <div className="flex items-center gap-3 mb-1">
          <TriangleAlert size={18} className="text-flagged shrink-0" />
          <h2 className="text-lg font-semibold text-flagged">Danger Zone</h2>
        </div>
        <p className="text-sm text-muted mb-6">
          Permanently deactivate your account. This action is irreversible from the UI — enter your
          password to confirm.
        </p>

        <form onSubmit={handleOpenDialog} className="flex flex-col gap-4 max-w-sm">
          <div>
            <label className="block text-[13px] font-medium text-ink mb-1.5">
              Confirm with your password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Enter your password…"
              required
              className="field !border-flagged/40 focus:!border-flagged focus:!shadow-[0_0_0_3px_rgba(220,38,38,0.15)]"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={deleting || !password}
              className="btn-primary !border-flagged !bg-flagged hover:!border-red-700 hover:!bg-red-700"
            >
              {deleting && <Loader2 size={14} className="spin" />}
              Delete my account
            </button>
          </div>
        </form>
      </section>

      {/* Confirmation dialog — not native confirm() */}
      <ConfirmDialog
        open={dialogOpen}
        title="Delete account?"
        message="Your account will be deactivated immediately. You will be logged out on all devices. This cannot be undone from the app."
        confirmText="Yes, delete my account"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDialogOpen(false)}
      />
    </>
  );
}
