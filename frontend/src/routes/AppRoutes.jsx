import {
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import ProtectedRoute from "../auth/ProtectedRoute";

import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";

import ProjectsPage from "../pages/ProjectsPage";
import WorkspacePage from "../pages/WorkspacePage";

export default function AppRoutes() {
  const { authenticated } =
    useAuth();

  return (
    <Routes>

      <Route
        path="/login"
        element={
          authenticated
            ? <Navigate to="/" replace />
            : <LoginPage />
        }
      />

      <Route
        path="/register"
        element={
          authenticated
            ? <Navigate to="/" replace />
            : <RegisterPage />
        }
      />

      <Route
        path="/"
        element={
          <ProtectedRoute>

            <ProjectsPage />

          </ProtectedRoute>
        }
      />

      <Route
        path="/project/:projectId"
        element={
          <ProtectedRoute>

            <WorkspacePage />

          </ProtectedRoute>
        }
      />

      <Route
        path="/project/:projectId/workspace"
        element={
          <ProtectedRoute>

            <WorkspacePage />

          </ProtectedRoute>
        }
      />

    </Routes>
  );
}