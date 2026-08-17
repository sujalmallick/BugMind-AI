import { useEffect, useState } from "react";
import { X, ChevronDown } from "lucide-react";

export default function CreateProjectModal({
  open,
  onClose,
  onCreate,
  initialData = null,
  organizationName = "",
  teamName = "",
}) {

  const [name, setName] = useState(
  initialData?.name || ""
);

const [description, setDescription] = useState(
  initialData?.description || ""
);

const [isSubmitting, setIsSubmitting] = useState(false);

useEffect(() => {
  if (!open) return;

  setName(initialData?.name || "");
  setDescription(initialData?.description || "");
}, [open, initialData]);


  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();

    if (!name.trim()) return;

    setIsSubmitting(true);

    try {
      await onCreate({
        name: name.trim(),
        description: description.trim(),
        organizationId: initialData?.organizationId ?? null,
        teamId: initialData?.teamId ?? null,
      });

      setName("");
      setDescription("");
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm modal-backdrop-enter">
      <div className="w-full max-w-lg rounded-xl border border-hairline bg-white shadow-xl modal-pop-enter">

        {/* Header */}

        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-ink">
              {initialData?.id ? "Edit Project" : "Create a Project"}
            </h2>
            {organizationName && (
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                <span>{organizationName}</span>
                {teamName && (
                  <>
                    <span>/</span>
                    <span>{teamName}</span>
                  </>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-muted transition hover:bg-paper hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}

        <form
          onSubmit={handleSubmit}
          className="space-y-5 p-6"
        >
          <div>
            <label className="mb-2 block text-sm font-medium text-ink">
              Project Name
            </label>

            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="E-Commerce Website"
              className="w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm outline-none transition focus:border-signal"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-ink">
              Description
            </label>

            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the application..."
              className="w-full resize-none rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm outline-none transition focus:border-signal"
            />
          </div>



          {/* Footer */}

          <div className="flex justify-end gap-3 border-t border-hairline pt-5">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="btn-primary"
            >
              {isSubmitting ? "Saving..." : initialData?.id ? "Save Changes" : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}