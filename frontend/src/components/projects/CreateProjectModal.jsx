import { useState } from "react";
import { X } from "lucide-react";

export default function CreateProjectModal({
  open,
  onClose,
  onCreate,
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  if (!open) return null;

  function handleSubmit(e) {
    e.preventDefault();

    if (!name.trim()) return;

    onCreate({
      name: name.trim(),
      description: description.trim(),
    });

    setName("");
    setDescription("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-hairline bg-white shadow-xl">

        {/* Header */}

        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">
              Create Project
            </h2>

            <p className="mt-1 text-sm text-muted">
              Start a new testing workspace.
            </p>
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
              className="rounded-lg border border-hairline px-4 py-2 text-sm transition hover:bg-paper"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={!name.trim()}
              className="rounded-lg bg-signal px-5 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}