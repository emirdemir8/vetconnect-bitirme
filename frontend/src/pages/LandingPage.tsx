import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Navigate } from "react-router-dom";

export const LandingPage: React.FC = () => {
  const { user, token, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-page" style={{ color: "rgba(255,255,255,0.9)", fontSize: 16 }}>
        <div className="auth-card" style={{ textAlign: "center", padding: 48 }}>
          Loading…
        </div>
      </div>
    );
  }

  if (token && user) {
    if (user.role === "vet") return <Navigate to="/vet/dashboard" replace />;
    if (user.role === "pet_owner") return <Navigate to="/owner/dashboard" replace />;
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ textAlign: "center" }}>
        <h1>🐾 Paws & Care</h1>
        <p className="auth-subtitle">
          Pet care and veterinary panel. Sign in or create an account to continue.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 28 }}>
          <Link to="/login" className="auth-cta-primary">
            Sign In
          </Link>
          <Link to="/register" className="auth-cta-secondary">
            Register
          </Link>
        </div>
      </div>
    </div>
  );
};
