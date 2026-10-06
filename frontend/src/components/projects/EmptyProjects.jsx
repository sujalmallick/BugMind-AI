import { FolderOpen, Plus } from "lucide-react";

export default function EmptyProjects({
  onCreateProject,
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-hairline-strong bg-surface px-6 py-16 text-center sm:py-20">
      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-signal-soft">
        <FolderOpen size={20} className="text-signal" aria-hidden="true" />
      </div>

      <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">
        No projects yet
      </h2>

      <p className="mt-2 max-w-md text-sm text-muted">
        Create your first BugMind project to organize workflows,
        test cases, issue analysis and execution history.
      </p>

      <button
        type="button"
        onClick={onCreateProject}
        className="btn-primary mt-6"
      >
        <Plus size={16} />
        Create project
      </button>
    </div>
  );
}
