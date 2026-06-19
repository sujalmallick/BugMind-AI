import {
  FolderOpen,
  Calendar,
  ChevronRight,
  ClipboardList,
  Boxes,
} from "lucide-react";

export default function ProjectCard({
  project,
  onOpen,
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(project.id)}
      className="group w-full rounded-xl border border-hairline bg-white p-5 text-left shadow-sm transition hover:border-signal hover:shadow-md"
    >
      {/* Header */}

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-paper p-2">
            <FolderOpen
              size={18}
              className="text-signal"
            />
          </div>

          <div>
            <h3 className="text-base font-semibold text-ink">
              {project.name}
            </h3>

            <p className="mt-1 line-clamp-2 text-sm text-muted">
              {project.description || "No description"}
            </p>
          </div>
        </div>

        <ChevronRight
          size={18}
          className="text-muted transition group-hover:text-signal"
        />
      </div>

      {/* Stats */}

      <div className="mt-5 flex items-center gap-5 text-sm text-muted">
        <div className="flex items-center gap-1.5">
          <ClipboardList size={15} />
          {project.testCases?.length ?? 0} Test Cases
        </div>

        <div className="flex items-center gap-1.5">
          <Boxes size={15} />
          {project.analysis?.confirmedModules?.length ?? 0} Modules
        </div>
      </div>

      {/* Footer */}

      <div className="mt-5 flex items-center justify-between border-t border-hairline pt-4 text-xs text-muted">
        <div className="flex items-center gap-1.5">
          <Calendar size={13} />
          Updated{" "}
          {new Date(project.updatedAt).toLocaleDateString()}
        </div>

        <span className="font-medium text-signal">
          Open
        </span>
      </div>
    </button>
  );
}