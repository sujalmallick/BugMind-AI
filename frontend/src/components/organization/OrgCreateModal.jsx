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
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(20,23,31,0.45)", backdropFilter: "blur(4px)" }}
    >
      <div className="w-full max-w-md rounded-2xl border border-hairline bg-white shadow-2xl animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-signal-soft text-signal">
              <Building2 size={16} />
            </div>
            <h2 className="text-base font-semibold text-ink">New Organization</h2>
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
            <label className="text-xs font-semibold text-ink" htmlFor="org-name">
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
              className="rounded-lg border border-hairline bg-paper px-3 py-2.5 text-sm text-ink
                         placeholder:text-muted focus:border-signal focus:bg-white focus:outline-none
                         transition"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-ink" htmlFor="org-description">
              Description <span className="text-muted font-normal">(optional)</span>
            </label>
            <textarea
              id="org-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this organization do?"
              rows={3}
              maxLength={500}
              className="resize-none rounded-lg border border-hairline bg-paper px-3 py-2.5 text-sm text-ink
                         placeholder:text-muted focus:border-signal focus:bg-white focus:outline-none
                         transition leading-relaxed"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-hairline px-4 py-2 text-sm font-medium text-muted
                         transition hover:bg-paper hover:text-ink"
            >
              Cancel
            </button>
            <button
              id="org-create-submit"
              type="submit"
              disabled={loading || !name.trim()}
              className="flex items-center gap-2 rounded-lg bg-signal px-4 py-2 text-sm font-semibold
                         text-white shadow-sm transition hover:bg-signal/90 disabled:cursor-not-allowed
                         disabled:opacity-60"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              Create organization
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
