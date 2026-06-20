import { useEffect, useRef, useState } from "react";
import { formatRelativeTime } from "../../utils/time";

import {
  FolderOpen,
  Calendar,
  MoreVertical,
  ClipboardList,
  Boxes,
  Pencil,
  Share2,
  Trash2,
} from "lucide-react";

export default function ProjectCard({
  project,
  onOpen,
  onRename,
  onDelete,
  onShare,
}) {
  const [menuOpen, setMenuOpen] = useState(false);

const menuRef = useRef(null);
useEffect(() => {
  function handleClickOutside(event) {
    if (
      menuRef.current &&
      !menuRef.current.contains(event.target)
    ) {
      setMenuOpen(false);
    }
  }

  document.addEventListener("mousedown", handleClickOutside);

  return () =>
    document.removeEventListener(
      "mousedown",
      handleClickOutside
    );
}, []);

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
  <div className="flex items-center gap-2">

    <h3 className="text-base font-semibold text-ink">
      {project.name}
    </h3>

    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
       (project.status || "Draft") === "Analyzed"
          ? "bg-green-100 text-green-700"
          : "bg-amber-100 text-amber-700"
      }`}
    >
{project.status || "Draft"}    </span>

  </div>

  <p className="mt-1 line-clamp-2 text-sm text-muted">
    {project.description || "No description"}
  </p>
</div>

        </div>

      <div
  ref={menuRef}
  className="relative"
>
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      setMenuOpen((prev) => !prev);
    }}
    className="rounded-lg p-1.5 text-muted transition hover:bg-paper hover:text-ink"
  >
    <MoreVertical size={18} />
  </button>

  {menuOpen && (
    <div
      onClick={(e) => e.stopPropagation()}
   className="absolute right-0 bottom-full mb-2 z-20 w-40 rounded-xl border border-hairline bg-white py-2 shadow-xl"
    >
     <button
  onClick={(e) => {
    e.stopPropagation();
    onRename(project);
    setMenuOpen(false);
  }}
  className="flex w-full items-center gap-3 px-4 py-2 text-sm hover:bg-paper"
>
  <Pencil size={15} />
  Rename
</button>

    <button
  onClick={(e) => {
    e.stopPropagation();
    setMenuOpen(false);
    onShare(project);
  }}
  className="flex w-full items-center gap-3 px-4 py-2 text-sm hover:bg-paper"
>
  <Share2 size={15} />
  Share
</button>

      <button
  onClick={(e) => {
    e.stopPropagation();

    setMenuOpen(false);

    onDelete(project);
  }}
  className="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
>
  <Trash2 size={15} />
  Delete
</button>

      
    </div>
  )}
</div>
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
       Updated {formatRelativeTime(project.updatedAt)}
        </div>

        <span className="font-medium text-signal">
          Open
        </span>
      </div>
    </button>
  );
}