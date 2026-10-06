import { Plus } from "lucide-react";

import HeaderBar from "../layout/HeaderBar";

// Projects hub header — the shared app header plus a "New project" action,
// so every signed-in page uses the same navigation, menus and notifications.
export default function ProjectsHeader({ onCreateProject }) {
  return (
    <HeaderBar
      actions={
        onCreateProject && (
          <button type="button" onClick={onCreateProject} className="btn-primary mr-1">
            <Plus size={15} aria-hidden="true" className="shrink-0" />
            <span className="hidden xs:inline">New project</span>
            <span className="xs:hidden">New</span>
          </button>
        )
      }
    />
  );
}
