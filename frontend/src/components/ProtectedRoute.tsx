import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type Role = "vet" | "pet_owner" | "admin";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: Role;
}

/**
 * Redirects to /login if no token; redirects to the correct panel if role does not match.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
}) => {
  const { user, token, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#020617",
          color: "#9ca3af",
        }}
      >
        Loading...
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    if (user?.role === "vet") return <Navigate to="/vet/dashboard" replace />;
    if (user?.role === "pet_owner") return <Navigate to="/owner/dashboard" replace />;
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
