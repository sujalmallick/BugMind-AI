import { FolderOpen, Plus } from "lucide-react";

export default function EmptyProjects({
  onCreateProject,
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-hairline bg-white px-8 py-20 text-center">
      <div className="mb-5 rounded-full bg-paper p-4">
        <FolderOpen
          size={34}
          className="text-signal"
        />
      </div>

      <h2 className="text-xl font-semibold text-ink">
        No projects yet
      </h2>

      <p className="mt-2 max-w-md text-sm text-muted">
        Create your first BugMind project to organize workflows,
        test cases, issue analysis and execution history.
      </p>

      <button
        type="button"
        onClick={onCreateProject}
        className="mt-8 inline-flex items-center gap-2 rounded-lg bg-signal px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
      >
        <Plus size={16} />
        Create Project
      </button>
    </div>
  );
}