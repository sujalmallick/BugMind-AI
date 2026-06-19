import { Routes, Route } from "react-router-dom";

import ProjectsPage from "../pages/ProjectsPage";
import WorkspacePage from "../pages/WorkspacePage";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<ProjectsPage />} />

      <Route
        path="/project/:projectId"
        element={<WorkspacePage />}
      />
    </Routes>
  );
}