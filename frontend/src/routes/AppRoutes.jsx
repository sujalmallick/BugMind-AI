import {
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";

import { useAuth } from "../auth/AuthContext";
import ProtectedRoute from "../auth/ProtectedRoute";

import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import LandingPage from "../pages/LandingPage";

// Lazy-loaded heavy application routes for code-splitting
const ProjectsPage = lazy(() => import("../pages/ProjectsPage"));
const WorkspacePage = lazy(() => import("../pages/WorkspacePage"));
const ProfilePage = lazy(() => import("../pages/settings/ProfilePage"));
const OrganizationsPage = lazy(() => import("../pages/OrganizationsPage"));
const InviteAcceptPage = lazy(() => import("../pages/InviteAcceptPage"));
const ActivityFeedPage = lazy(() => import("../pages/ActivityFeedPage"));
const DashboardPage = lazy(() => import("../pages/DashboardPage"));
const ProjectDashboardPage = lazy(() => import("../pages/ProjectDashboardPage"));
const TeamDashboardPage = lazy(() => import("../pages/TeamDashboardPage"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }, [pathname]);

  return null;
}

export default function AppRoutes() {
  const { authenticated } = useAuth();
  const location = useLocation();

  return (
    <div key={location.pathname} className="page-fade-in min-h-screen">
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
        <Routes>

      {/* Public Marketing Landing Pages */}
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/details" element={<LandingPage />} />
      <Route path="/about" element={<LandingPage />} />

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
          authenticated ? (
            <ProtectedRoute>
              <ProjectsPage />
            </ProtectedRoute>
          ) : (
            <LandingPage />
          )
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
        path="/workspace/:projectId"
        element={
          <ProtectedRoute>

            <WorkspacePage />

          </ProtectedRoute>
        }
      />

      <Route
        path="/project/:projectId/activity"
        element={
          <ProtectedRoute>

            <ActivityFeedPage />

          </ProtectedRoute>
        }
      />

      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <ProjectsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/activity"
        element={
          <ProtectedRoute>
            <ActivityFeedPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
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

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/project/:projectId/dashboard"
        element={
          <ProtectedRoute>
            <ProjectDashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/organizations/:orgId/teams/:teamId/dashboard"
        element={
          <ProtectedRoute>
            <TeamDashboardPage />
          </ProtectedRoute>
        }
      />

      {/* Catch-all: Unauthenticated users are redirected to login */}
      <Route
        path="*"
        element={
          authenticated ? (
            <Navigate to="/" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      </Routes>
      </Suspense>
    </div>
  );
}
