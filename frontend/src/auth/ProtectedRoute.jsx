import { Navigate } from "react-router-dom";

import { useAuth } from "./AuthContext";

export default function ProtectedRoute({
  children,
}) {
  const {
    authenticated,
    loading,
  } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <div className="text-lg font-semibold text-muted">
          Loading...
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  return children;
}