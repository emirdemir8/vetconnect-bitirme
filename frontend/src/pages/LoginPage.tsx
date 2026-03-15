import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getApiBaseUrl } from "../lib/apiClient";
import { useNavigate, Link, Navigate } from "react-router-dom";

export const LoginPage: React.FC = () => {
  const { login, user, token, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      await login(email, password);
      nav("/");
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
      } else if (status === 401) {
        msg = "Invalid email or password. Try the email and password you registered with.";
      } else if (status === 422) {
        msg = "Invalid input (email format or password must be at least 6 characters).";
      } else if (status === 503 || status === 500) {
        msg = typeof detail === "string" ? detail : "Server error. Check backend console.";
      } else {
        msg = "Login failed.";
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
        <h1>🐾 Paws & Care</h1>
        <p className="auth-subtitle">Sign in to your account</p>
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
            Password
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              placeholder="••••••••"
            />
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
        <p>
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
};