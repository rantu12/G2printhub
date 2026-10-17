"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function VerifyEmailForm({ token }: { token: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const [email, setEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [resendError, setResendError] = useState("");

  async function verifyEmail() {
    setLoading(true);
    setError("");
    setMessage("");
    setExpired(false);
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || "Unable to verify this email address.");
        setExpired(response.status === 410);
        return;
      }
      setMessage(data.message);
      router.push("/account");
      router.refresh();
    } catch {
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function resendVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^[^\s@]+@gmail\.com$/i.test(email.trim())) {
      setResendError("Enter a valid @gmail.com address.");
      return;
    }
    setResending(true);
    setResendMessage("");
    setResendError("");
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) {
        setResendError(data.message || "Unable to request another email.");
        return;
      }
      setResendMessage(data.message || "If eligible, a new verification email will arrive shortly.");
    } catch {
      setResendError("Unable to connect to the server. Please try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-background" />
      <section className="auth-shell">
        <div className="auth-brand">
          <Link href="/" className="brand-logo">
            <span className="brand-icon">P</span>
            <span>Print<span>Hub</span></span>
          </Link>
          <p>Confirm your email address</p>
        </div>
        <div className="auth-card">
          <div className="auth-card-header">
            <span className="auth-badge">EMAIL VERIFICATION</span>
            <h1>Verify your Gmail</h1>
            <p>Confirm this address to activate your account and sign in.</p>
          </div>
          {error && <div className="auth-alert auth-error" role="alert">{error}</div>}
          {message && <div className="auth-alert auth-success" role="status">{message}</div>}
          {token ? (
            <button
              type="button"
              className="auth-submit"
              onClick={verifyEmail}
              disabled={loading}
            >
              {loading ? "Verifying..." : "Verify email and continue"}
            </button>
          ) : (
            <div className="auth-alert auth-error" role="alert">
              This verification link is missing or invalid.
            </div>
          )}
          {expired && (
            <form className="auth-form" onSubmit={resendVerification}>
              <p className="auth-terms">
                The link has expired. Enter your Gmail address to request a new verification email.
              </p>
              <label>
                Gmail address
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>
              {resendError && <div className="auth-alert auth-error" role="alert">{resendError}</div>}
              {resendMessage && <div className="auth-alert auth-success" role="status">{resendMessage}</div>}
              <button className="auth-submit" type="submit" disabled={resending}>
                {resending ? "Sending..." : "Resend verification email"}
              </button>
            </form>
          )}
          <Link href="/register" className="secondary-auth-button">
            Return to registration
          </Link>
        </div>
      </section>
    </main>
  );
}
