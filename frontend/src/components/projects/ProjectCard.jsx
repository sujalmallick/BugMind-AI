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
  Building2,
  Shield,
  Eye,
  Crown
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


console.log("ProjectCard:", project);

const canEdit = ["editor", "admin", "owner"].includes(project.myRole);
const canShare = ["admin", "owner"].includes(project.myRole);
const canDelete = project.myRole === "owner";
const hasMenu = canEdit || canShare || canDelete;

const RoleIcon = project.myRole === "owner" ? Crown : project.myRole === "viewer" ? Eye : Shield;

return (
  <div
    role="button"
    tabIndex={0}
    
    onClick={() => onOpen(project.id)}
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onOpen(project.id);
      }
    }}
    className="group w-full cursor-pointer base-card p-5 text-left hover:-translate-y-1"
  >
      {/* Header */}

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-paper p-2">
            <FolderOpen
              size={18}
              className="text-signal transition-transform duration-300 ease-out group-hover:scale-110"
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
      {project.status || "Draft"}
    </span>
    {project.organizationId && (
      <span className="rounded-full bg-paper px-1.5 py-0.5 text-muted flex items-center" title="Organization Project">
        <Building2 size={12} />
      </span>
    )}
    {project.myRole && project.myRole !== "owner" && (
      <span className="rounded-full bg-surface border border-hairline px-2 py-0.5 text-[10px] font-semibold text-muted flex items-center gap-1 capitalize">
        <RoleIcon size={10} /> {project.myRole}
      </span>
    )}

  </div>

  <p className="mt-1 line-clamp-2 text-sm text-muted">
    {project.description || "No description"}
  </p>
</div>

        </div>

      {hasMenu && (
        <div ref={menuRef} className="relative">
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
              className="absolute right-0 bottom-full mb-2 z-20 w-40 rounded-xl border border-hairline bg-white py-2 shadow-xl menu-enter"
            >
              {canEdit && (
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
              )}

              {canShare && (
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
              )}

              {canDelete && (
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
              )}
            </div>
          )}
        </div>
      )}
    </div>

      {/* Stats */}

    <div className="mt-5 flex items-center gap-5 text-sm text-muted">
  <div className="flex items-center gap-1.5">
    <ClipboardList size={15} />
    {project.testCaseCount ?? 0} Test Cases
  </div>

  <div className="flex items-center gap-1.5">
    <Boxes size={15} />
    {project.moduleCount ?? 0} Modules
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
       </div>
   
  );
}