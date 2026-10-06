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
  Crown,
  LayoutDashboard,
  Bug
} from "lucide-react";

export default function ProjectCard({
  project,
  index = 0,
  onOpen,
  onDashboard,
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
    style={{ animationDelay: `${index * 60}ms` }}
    onClick={() => onOpen(project.id)}
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onOpen(project.id);
      }
    }}
    className="group flex w-full cursor-pointer flex-col base-card card-cascade-enter card-glow-hover p-5 text-left"
  >
      {/* Header */}

      <div className="flex items-start justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-signal-soft">
            <FolderOpen size={17} className="text-signal" aria-hidden="true" />
          </div>

         <div>
  <div className="flex items-center gap-2">

    <h3 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-ink">
      {project.name}
    </h3>


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

  <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted">
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
            aria-label={`Actions for ${project.name}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="-mr-1.5 -mt-1 rounded-lg p-1.5 text-muted transition-colors hover:bg-ink/[0.05] hover:text-ink"
          >
            <MoreVertical size={17} />
          </button>

          {menuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              role="menu"
              className="glass glass-menu menu-enter absolute right-0 top-full z-20 mt-1 w-44 rounded-xl p-1"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDashboard?.(project);
                  setMenuOpen(false);
                }}
                role="menuitem"
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-ink transition-colors hover:bg-ink/[0.04]"
              >
                <LayoutDashboard size={15} />
                Dashboard
              </button>

              {canEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRename(project);
                    setMenuOpen(false);
                  }}
                  role="menuitem"
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-ink transition-colors hover:bg-ink/[0.04]"
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
                  role="menuitem"
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-ink transition-colors hover:bg-ink/[0.04]"
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
                  role="menuitem"
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-flagged transition-colors hover:bg-flagged-soft"
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
    <div className="mt-auto flex items-center gap-5 pt-5 text-[13px] text-muted">
      {/* If project has issues but no modules (e.g. imported issues project), show Issues count */}
      {project.moduleCount === 0 && project.issueCount > 0 ? (
        <div className="flex items-center gap-1.5 text-flagged font-medium">
          <Bug size={15} />
          {project.issueCount} Issues
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <ClipboardList size={15} />
          {project.testCaseCount ?? 0} Test Cases
        </div>
      )}

      {project.moduleCount > 0 ? (
        <div className="flex items-center gap-1.5">
          <Boxes size={15} />
          {project.moduleCount} Modules
        </div>
      ) : project.moduleCount === 0 && project.issueCount > 0 ? (
        null
      ) : (
        <div className="flex items-center gap-1.5">
          <Boxes size={15} />
          0 Modules
        </div>
      )}
    </div>

      {/* Footer */}

      <div className="mt-4 flex items-center justify-between border-t border-hairline pt-3.5 text-xs text-muted">
        <div className="flex items-center gap-1.5">
          <Calendar size={13} />
       Updated {formatRelativeTime(project.updatedAt)}
        </div>

        <span className="flex items-center gap-1 font-medium text-ink opacity-60 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100">
          Open <span aria-hidden="true">→</span>
        </span>
      </div>
       </div>
   
  );
}