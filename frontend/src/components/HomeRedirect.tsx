import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Home: redirect to /login if not signed in; otherwise /vet/dashboard or /owner/dashboard by role.
 */
export const HomeRedirect: React.FC = () => {
  const { user, token, loading } = useAuth();

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

  if (!token) return <Navigate to="/login" replace />;
  if (user?.role === "vet") return <Navigate to="/vet/dashboard" replace />;
  if (user?.role === "pet_owner") return <Navigate to="/owner/dashboard" replace />;
  return <Navigate to="/login" replace />;
};
