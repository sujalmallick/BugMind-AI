import { useState } from "react";
import { X, Building2, Loader2 } from "lucide-react";

export default function OrgCreateModal({ onClose, onCreate }) {
  const [name, setName]               = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onCreate({ name: name.trim(), description: description.trim() || undefined });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="modal-backdrop-enter fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4"
    >
      <div className="w-full max-w-md glass glass-menu modal-pop-enter rounded-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-signal-soft text-signal">
              <Building2 size={16} />
            </div>
            <h2 className="text-[15px] font-semibold text-ink">New Organization</h2>
          </div>
          <button
            id="org-create-modal-close"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition hover:bg-paper hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
          {error && (
            <div className="rounded-lg border border-flagged/30 bg-flagged-soft px-4 py-2.5 text-sm text-flagged">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-ink" htmlFor="org-name">
              Organization name <span className="text-flagged">*</span>
            </label>
            <input
              id="org-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme QA Team"
              maxLength={100}
              required
              className="field"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-ink" htmlFor="org-description">
              Description <span className="text-muted font-normal">(optional)</span>
            </label>
            <textarea
              id="org-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this organization do?"
              rows={3}
              maxLength={500}
              className="resize-none field leading-relaxed"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              id="org-create-submit"
              type="submit"
              disabled={loading || !name.trim()}
              className="btn-primary"
            >
              {loading && <Loader2 size={14} className="spin" />}
              Create organization
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
