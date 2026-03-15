import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getApiBaseUrl } from "../lib/apiClient";
import { Link, useNavigate, Navigate } from "react-router-dom";

export const RegisterPage: React.FC = () => {
  const { register, user, token, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"vet" | "pet_owner">("pet_owner");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Already logged in: redirect to role-specific dashboard
  if (!authLoading && token && user) {
    if (user.role === "vet") return <Navigate to="/vet/dashboard" replace />;
    return <Navigate to="/owner/dashboard" replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(email, password, role, fullName.trim() || undefined);
      nav("/login");
    } catch (err: any) {
      if (err?.code === "ERR_NETWORK" || err?.message === "Network Error") {
        setError(
          "Cannot connect to server. Did you start the backend? " +
            "In project folder run: python -m uvicorn app.main:app --reload --port 8000 " +
            `(API: ${getApiBaseUrl()})`
        );
        return;
      }
      const status = err?.response?.status;
      const data = err?.response?.data;
      const detail = data?.detail;
      let msg: string;
      if (Array.isArray(detail)) {
        msg = detail.map((x: any) => x?.msg || x).join(" ");
      } else if (typeof detail === "string") {
        msg = detail;
      } else if (detail && typeof detail === "object" && typeof (detail as any).message === "string") {
        msg = (detail as any).message;
      } else if (status === 409) {
        msg = "This email is already registered.";
      } else if (status === 422) {
        msg = "Invalid input (email format or password at least 6 characters).";
      } else if (status === 503 || status === 500) {
        msg = typeof detail === "string" ? detail : "Server error. Check backend console.";
      } else {
        msg = "Registration failed.";
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: "center", padding: 48 }}>
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>🐾 Register</h1>
        <p className="auth-subtitle">Create an account to get started</p>
        <form onSubmit={handleSubmit}>
          <label>
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              placeholder="you@example.com"
            />
          </label>
          <label>
            Full name (optional – shown as owner in vet panel)
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              type="text"
              placeholder="e.g. John Smith"
            />
          </label>
          <label>
            Password (at least 6 characters)
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              minLength={6}
              placeholder="••••••••"
            />
          </label>
          <label>
            Role
            <select
              value={role}
              onChange={(e) =>
                setRole(e.target.value as "vet" | "pet_owner")
              }
            >
              <option value="pet_owner">Pet Owner</option>
              <option value="vet">Veterinarian</option>
            </select>
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" disabled={loading}>
            {loading ? "Registering…" : "Register"}
          </button>
        </form>
        <p>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
};