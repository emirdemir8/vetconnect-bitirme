import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/apiClient";

export const ResetPasswordPage: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: password });
      setDone(true);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (Array.isArray(detail)) setError(detail.map((x: any) => x?.msg || x).join(" "));
      else setError(typeof detail === "string" ? detail : "Could not reset password. The link may have expired.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>🐾 Paws & Care</h1>
        <p className="auth-subtitle">Set a new password</p>

        {!token ? (
          <>
            <div className="auth-error">This reset link is invalid or incomplete.</div>
            <p style={{ marginTop: 16 }}>
              <Link to="/forgot-password">Request a new reset link</Link>
            </p>
          </>
        ) : done ? (
          <>
            <div
              style={{
                marginBottom: 16,
                padding: "12px 16px",
                borderRadius: 8,
                background: "rgba(16, 185, 129, 0.08)",
                color: "#047857",
                border: "1px solid rgba(5, 150, 105, 0.2)",
                fontSize: "0.875rem",
              }}
            >
              Your password has been reset. You can now sign in with your new password.
            </div>
            <p>
              <Link to="/login">Go to sign in</Link>
            </p>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <label>
              New password
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                minLength={8}
                placeholder="At least 8 chars, with a letter and a number"
              />
            </label>
            <label>
              Confirm new password
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                type="password"
                required
                minLength={8}
                placeholder="••••••••"
              />
            </label>
            {error && <div className="auth-error">{error}</div>}
            <button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Reset password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
