import { Plus, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

import logo from "../../assets/bugmind2.png";
import favicon from "../../assets/favicon.png";

export default function ProjectsHeader({
  onCreateProject,
}) {
  const navigate = useNavigate();
  const { logout } = useAuth();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const currentDate = new Intl.DateTimeFormat(
    undefined,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  ).format(new Date());

  return (
    <header className="sticky top-0 z-50 border-b border-hairline/70 bg-white/90 shadow-sm backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-8 sm:py-4">

        {/* Logo */}
        <div
          title="Go to Projects"
          onClick={() => navigate("/")}
          className="group flex cursor-pointer items-center gap-3 transition-opacity hover:opacity-90"
        >
          <img
            src={favicon}
            alt="BugMind"
            className="h-10 w-10 object-contain"
          />

          <img
            src={logo}
            alt="BugMind AI"
            className="h-11 w-auto object-contain"
          />

          <div className="hidden border-l border-hairline pl-3 lg:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              Project Hub
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {currentDate}
            </p>
          </div>
        </div>

        {/* Action */}
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden rounded-full border border-hairline bg-paper px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted sm:inline-flex">
            Workspace Ready
          </span>

          <button
            type="button"
            onClick={onCreateProject}
            className="btn-primary"
          >
            <Plus size={16} />
            New Project
          </button>

          <button
            type="button"
            onClick={handleLogout}
            title="Logout"
            className="btn-secondary hover:!border-flagged hover:!text-flagged hover:!bg-flagged-soft"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>

      </div>
    </header>
  );
}
