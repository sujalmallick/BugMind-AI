import { useState } from "react";
import { X, Users, Loader2 } from "lucide-react";

export default function TeamCreateModal({ onClose, onCreate, orgProjects = [] }) {
  const [name, setName]               = useState("");
  const [description, setDescription] = useState("");
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onCreate(
        { name: name.trim(), description: description.trim() || undefined },
        selectedProjects
      );
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

        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-verified-soft text-verified">
              <Users size={16} />
            </div>
            <h2 className="text-base font-semibold text-ink">New Team</h2>
          </div>
          <button
            id="team-create-modal-close"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition hover:bg-paper hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
          {error && (
            <div className="rounded-lg border border-flagged/30 bg-flagged-soft px-4 py-2.5 text-sm text-flagged">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-ink" htmlFor="team-name">
              Team name <span className="text-flagged">*</span>
            </label>
            <input
              id="team-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Frontend QA"
              maxLength={100}
              required
              className="rounded-lg border border-hairline bg-paper px-3 py-2.5 text-sm text-ink
                         placeholder:text-muted focus:border-signal focus:bg-white focus:outline-none transition"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-ink" htmlFor="team-description">
              Description <span className="text-muted font-normal">(optional)</span>
            </label>
            <textarea
              id="team-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this team test?"
              rows={2}
              maxLength={500}
              className="resize-none rounded-lg border border-hairline bg-paper px-3 py-2.5 text-sm text-ink
                         placeholder:text-muted focus:border-signal focus:bg-white focus:outline-none transition"
            />
          </div>

          {orgProjects.length > 0 && (
            <div className="flex flex-col gap-2 pt-2 border-t border-hairline">
              <label className="text-xs font-semibold text-ink">
                Assign Projects <span className="text-muted font-normal">(optional)</span>
              </label>
              <div className="max-h-32 overflow-y-auto rounded-lg border border-hairline bg-paper divide-y divide-hairline">
                {orgProjects.map(p => (
                  <label key={p.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-surface transition">
                    <input
                      type="checkbox"
                      checked={selectedProjects.includes(p.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedProjects([...selectedProjects, p.id]);
                        else setSelectedProjects(selectedProjects.filter(id => id !== p.id));
                      }}
                      className="rounded border-hairline text-signal focus:ring-signal"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-ink">{p.name}</span>
                      {p.description && <span className="text-xs text-muted truncate max-w-[280px]">{p.description}</span>}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

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
              id="team-create-submit"
              type="submit"
              disabled={loading || !name.trim()}
              className="flex items-center gap-2 rounded-lg bg-verified px-4 py-2 text-sm font-semibold
                         text-white shadow-sm transition hover:bg-verified/90 disabled:cursor-not-allowed
                         disabled:opacity-60"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              Create team
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
