import { useState } from "react";
import { Loader2, Trash2, Check, AlertTriangle } from "lucide-react";
import useOrgStore from "../../store/useOrgStore";

export default function OrgSettingsPanel() {
  const store = useOrgStore();
  const org = store.activeOrg;

  const [name, setName] = useState(org?.name || "");
  const [description, setDescription] = useState(org?.description || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!org) return null;

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await store.updateOrg(org.id, {
        name: name.trim() || undefined,
        description: description.trim() || undefined,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Are you absolutely sure you want to delete ${org.name}? This action cannot be undone.`)) return;
    setDeleting(true);
    try {
      await store.deleteOrg(org.id);
      // Navigation is typically handled by the parent, which should listen to store changes
      // or we just let it be deleted and the parent UI goes back to list.
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      {/* General Settings */}
      <section className="glass-card p-5 sm:p-6">
        <div className="mb-4">
          <h2 className="text-[15px] font-semibold text-ink">General Settings</h2>
          <p className="text-xs text-muted">Update your organization's name and description.</p>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {error && (
            <div className="rounded-lg border border-flagged/30 bg-flagged-soft px-4 py-2.5 text-sm text-flagged">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-verified/30 bg-verified-soft px-4 py-2.5 text-sm text-verified flex items-center gap-2">
              <Check size={16} /> Settings saved successfully.
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-ink" htmlFor="org-name">
              Organization name
            </label>
            <input
              id="org-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="field"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-ink" htmlFor="org-desc">
              Description
            </label>
            <textarea
              id="org-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="resize-none field"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary"
            >
              {saving && <Loader2 size={14} className="spin" />}
              Save changes
            </button>
          </div>
        </form>
      </section>

      {/* Danger Zone */}
      <section className="glass-card !border-flagged/25 p-5 sm:p-6">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-flagged flex items-center gap-2">
            <AlertTriangle size={16} /> Danger Zone
          </h2>
          <p className="text-xs text-muted mt-1">
            Permanently delete this organization and all its data. This action is irreversible.
          </p>
        </div>

        <button
          onClick={handleDelete}
          disabled={deleting}
          className="btn-primary !border-flagged !bg-flagged hover:!border-red-700 hover:!bg-red-700"
        >
          {deleting && <Loader2 size={14} className="spin" />}
          <Trash2 size={14} />
          Delete organization
        </button>
      </section>
    </div>
  );
}
