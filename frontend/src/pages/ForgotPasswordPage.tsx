import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/apiClient";

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post("/auth/forgot-password", { email });
      setDevLink((res.data?.dev_reset_link as string | undefined) ?? null);
      setDone(true);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Could not process the request. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>🐾 Paws & Care</h1>
        <p className="auth-subtitle">Reset your password</p>

        {done ? (
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
              If an account exists for this email, a password reset link has been sent. Please check your inbox.
            </div>
            {devLink && (
              <div className="auth-error" style={{ background: "#eff6ff", color: "#1e40af", borderColor: "#bfdbfe" }}>
                <strong>Development mode:</strong> email is not configured, so use this link directly:
                <br />
                <Link to={devLink.replace(/^https?:\/\/[^/]+/i, "")}>Open reset link</Link>
              </div>
            )}
            <p style={{ marginTop: 16 }}>
              <Link to="/login">Back to sign in</Link>
            </p>
          </>
        ) : (
          <>
            <p style={{ color: "#64748b", marginBottom: 16 }}>
              Enter the email address for your account and we'll send you a link to set a new password.
            </p>
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
              {error && <div className="auth-error">{error}</div>}
              <button type="submit" disabled={loading}>
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>
            <p>
              Remembered it? <Link to="/login">Back to sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
};
