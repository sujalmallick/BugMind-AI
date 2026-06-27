import { Trash2, X } from "lucide-react";

export default function DeleteProjectModal({
  open,
  project,
  onClose,
  onDelete,
}) {
  if (!open || !project) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-hairline bg-white shadow-xl">

        {/* Header */}

        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-red-600">
              Delete Project
            </h2>

            <p className="mt-1 text-sm text-muted">
              This action cannot be undone.
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-md p-2 text-muted transition hover:bg-paper hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}

        <div className="px-6 py-6">
          <p className="text-sm text-muted">
            Are you sure you want to delete
          </p>

          <p className="mt-2 text-lg font-semibold text-ink">
            {project.name}
          </p>
        </div>

        {/* Footer */}

        <div className="flex justify-end gap-3 border-t border-hairline px-6 py-5">
          <button
            onClick={onClose}
            className="btn-secondary"
          >
            Cancel
          </button>

          <button
            onClick={() => onDelete(project.id)}
            className="btn-primary !bg-red-600 hover:!bg-red-700 !border-red-600 !shadow-none"
          >
            <Trash2 size={15} />
            Delete
          </button>
        </div>

      </div>
    </div>
  );
}