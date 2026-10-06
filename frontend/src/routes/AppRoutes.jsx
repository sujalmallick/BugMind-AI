import {
  Routes,
  Route,
  Navigate,
  Link,
  useLocation,
  useParams,
} from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";

import { useAuth } from "../auth/AuthContext";
import ProtectedRoute from "../auth/ProtectedRoute";

import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import ForgotPasswordPage from "../pages/ForgotPasswordPage";
import ResetPasswordPage from "../pages/ResetPasswordPage";
import LandingPage from "../pages/LandingPage";
import HeaderBar from "../components/layout/HeaderBar";

// Lazy-loaded heavy application routes for code-splitting
const ProjectsPage = lazy(() => import("../pages/ProjectsPage"));
const WorkspacePage = lazy(() => import("../pages/WorkspacePage"));
const ProfilePage = lazy(() => import("../pages/settings/ProfilePage"));
const OrganizationsPage = lazy(() => import("../pages/OrganizationsPage"));
const InviteAcceptPage = lazy(() => import("../pages/InviteAcceptPage"));
const ActivityFeedPage = lazy(() => import("../pages/ActivityFeedPage"));
const AutomationPage = lazy(() => import("../pages/AutomationPage"));
const DashboardPage = lazy(() => import("../pages/DashboardPage"));
const ProjectDashboardPage = lazy(() => import("../pages/ProjectDashboardPage"));
const TeamDashboardPage = lazy(() => import("../pages/TeamDashboardPage"));

function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Loading">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-hairline border-t-signal" />
    </div>
  );
}

// Standalone project dashboard: the page component is also embedded in the
// workspace tabs, so the app chrome is added here rather than inside it.
function StandaloneProjectDashboard() {
  const { projectId } = useParams();
  return (
    <div className="projects-atmosphere min-h-screen">
      <HeaderBar />
      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-8 sm:px-6 sm:pt-10">
        <Link
          to={`/project/${projectId}/workspace`}
          className="-ml-2 mb-6 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-medium text-muted transition-colors hover:bg-ink/[0.04] hover:text-ink"
        >
          <span aria-hidden="true">←</span> Back to project
        </Link>
        <ProjectDashboardPage />
      </main>
    </div>
  );
}

function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      // Wait a frame so the target section has rendered
      const id = requestAnimationFrame(() => {
        document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" });
      });
      return () => cancelAnimationFrame(id);
    }
    window.scrollTo({ top: 0, left: 0 });
  }, [pathname, hash]);

  return null;
}

export default function AppRoutes() {
  const { authenticated, loading } = useAuth();
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
        path="/forgot-password"
        element={
          authenticated
            ? <Navigate to="/" replace />
            : <ForgotPasswordPage />
        }
      />

      {/* Public: reached from the emailed link; works whether or not a session exists */}
      <Route
        path="/reset-password"
        element={<ResetPasswordPage />}
      />

      <Route
        path="/"
        element={
          loading ? (
            <PageLoader />
          ) : authenticated ? (
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
        path="/project/:projectId/automation"
        element={
          <ProtectedRoute>
            <AutomationPage />
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
            <StandaloneProjectDashboard />
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

