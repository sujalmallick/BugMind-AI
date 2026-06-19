import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

import logo from "../../assets/bugmind2.png";
import favicon from "../../assets/favicon.png";

export default function ProjectsHeader({
  onCreateProject,
}) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-white shadow-sm">
      <div className="flex w-full items-center justify-between px-9 py-4">

        {/* Logo */}
        <div
          title="Go to Projects"
          onClick={() => navigate("/")}
          className="flex cursor-pointer items-center gap-3 transition-opacity hover:opacity-90"
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
        </div>

        {/* Action */}
        <button
          onClick={onCreateProject}
          className="flex items-center gap-2 rounded-lg bg-signal px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:opacity-90"
        >
          <Plus size={16} />
          New Project
        </button>

      </div>
    </header>
  );
}