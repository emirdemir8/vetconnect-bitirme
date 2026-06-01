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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!authLoading && token && user) {
    if (user.role === "vet") return <Navigate to="/vet/dashboard" replace />;
    if (user.role === "admin") return <Navigate to="/admin/applications" replace />;
    return <Navigate to="/owner/dashboard" replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);
    try {
      await register(email, password, fullName.trim() || undefined);
      setSuccess(true);
      setTimeout(() => nav("/login", { state: { registered: true } }), 800);
    } catch (err: unknown) {
      const ax = err as {
        code?: string;
        message?: string;
        response?: { status?: number; data?: { detail?: unknown } };
      };
      if (ax?.code === "ERR_NETWORK" || ax?.message === "Network Error") {
        setError(
          "Could not connect to the server. Is the backend running? From the project folder: " +
            "python -m uvicorn app.main:app --reload --port 8000 " +
            `(API: ${getApiBaseUrl()})`
        );
        return;
      }
      const status = ax?.response?.status;
      const detail = ax?.response?.data?.detail;
      let msg: string;
      if (Array.isArray(detail)) {
        msg = detail.map((x: { msg?: string }) => x?.msg || String(x)).join(" ");
      } else if (typeof detail === "string") {
        msg = detail;
      } else if (status === 409) {
        msg = "This email is already registered.";
      } else if (status === 422) {
        msg = "Invalid input (check email format or use a password of at least 8 characters).";
      } else if (status === 503) {
        msg =
          typeof detail === "string"
            ? detail
            : "Could not connect to the database. Start the MongoDB service in XAMPP.";
      } else if (status === 500) {
        msg = typeof detail === "string" ? detail : "Server error. Check the backend console.";
      } else if (status === 429) {
        msg =
          typeof detail === "string"
            ? detail
            : "Too many attempts. Wait a minute and try again.";
      } else if (status === 502 || status === 504) {
        msg = "Backend did not respond (check port 8000 and uvicorn).";
      } else {
        const extra =
          typeof detail === "string" ? detail : status != null ? ` (HTTP ${status})` : "";
        msg = `Registration failed${extra}.`;
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
        <h1>🐾 Sign up</h1>
        <p className="auth-subtitle">Create a pet owner account</p>
        <form onSubmit={handleSubmit}>
          <label>
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              placeholder="you@email.com"
            />
          </label>
          <label>
            Full name (optional)
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              type="text"
              placeholder="Full name"
            />
          </label>
          <label>
            Password (at least 8 characters)
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              minLength={8}
              placeholder="••••••••"
            />
          </label>
          {success && (
            <div className="auth-error" style={{ background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0" }}>
              Registration successful. Redirecting to sign in…
            </div>
          )}
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" disabled={loading}>
            {loading ? "Saving…" : "Sign up"}
          </button>
        </form>
        <p>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
};
