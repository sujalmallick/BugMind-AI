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
import ProfilePage from "../pages/settings/ProfilePage";
import OrganizationsPage from "../pages/OrganizationsPage";
import InviteAcceptPage from "../pages/InviteAcceptPage";

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

      <Route
        path="/settings/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/organizations"
        element={
          <ProtectedRoute>
            <OrganizationsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/organizations/:orgId"
        element={
          <ProtectedRoute>
            <OrganizationsPage />
          </ProtectedRoute>
        }
      />

      {/* Public invite accept page — no auth required to view, auth checked on accept */}
      <Route
        path="/invite/:token"
        element={<InviteAcceptPage />}
      />

    </Routes>
  );
}