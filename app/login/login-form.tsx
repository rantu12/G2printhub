"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type LoginFormProps = {
  accountType: "customer" | "admin";
  returnTo?: string;
  initialError?: string;
  passwordLoginEnabled?: boolean;
  googleSignInEnabled?: boolean;
  registrationEnabled?: boolean;
};

export default function LoginForm({
  accountType,
  returnTo,
  initialError = "",
  passwordLoginEnabled = true,
  googleSignInEnabled = true,
  registrationEnabled = true,
}: LoginFormProps) {
  const isAdmin = accountType === "admin";
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Email and password are required.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: trimmedEmail,
          password,
          accountType,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || "Invalid email or password.");
        return;
      }

      const destination =
        data.user?.role === "ADMIN" || isAdmin
          ? returnTo ?? "/admin"
          : "/account";
      router.push(destination);
      router.refresh();
    } catch {
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={`auth-page${isAdmin ? " admin-auth-page" : ""}`}>
      <div className="auth-background" />

      <section className="auth-shell">
        <div className="auth-brand">
          <Link href="/" className="brand-logo">
            <span className="brand-icon">P</span>
            <span>
              Print<span>Hub</span>
            </span>
          </Link>
          <p>{isAdmin ? "Administrator portal" : "Premium printing, made simple."}</p>
        </div>

        <div className="auth-card">
          <div className="auth-card-header">
            <span className="auth-badge">
              {isAdmin ? "ADMINISTRATOR ACCESS" : "CUSTOMER ACCOUNT"}
            </span>
            <h1>{isAdmin ? "Admin sign in" : "Sign in to PrintHub"}</h1>
            <p>
              {isAdmin
                ? "Sign in with an administrator account to manage your store."
                : "Access your orders, saved designs, addresses and account settings."}
            </p>
          </div>

          {error && (
            <div className="auth-alert auth-error" role="alert">
              <span>!</span>
              {error}
            </div>
          )}

          {(!isAdmin && !passwordLoginEnabled) ? (
            <p className="auth-alert" role="status">
              Email and password sign-in is currently disabled.
            </p>
          ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <label>
              Email address
              <div className="input-wrap">
                <span className="input-icon">✉</span>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                  disabled={loading}
                />
              </div>
            </label>

            <label>
              Password
              <div className="input-wrap">
                <span className="input-icon">●</span>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={loading}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            <button
              type="submit"
              className="auth-submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner" />
                  Signing in...
                </>
              ) : (
                <>
                  {isAdmin ? "Sign in to Admin" : "Sign in"}
                  <span>→</span>
                </>
              )}
            </button>
          </form>
          )}

          {!isAdmin && googleSignInEnabled && (
            <div className="auth-divider">
              <span>Or</span>
            </div>
          )}

          {!isAdmin && googleSignInEnabled && passwordLoginEnabled && (
            <a href="/api/auth/google" className="secondary-auth-button">
              Continue with Google
            </a>
          )}

          {!isAdmin && registrationEnabled && (
            <>
              <div className="auth-divider">
                <span>New to PrintHub?</span>
              </div>
              <Link href="/register" className="secondary-auth-button">
                Create a new account
              </Link>
            </>
          )}
          {!isAdmin && !registrationEnabled && (
            <p className="auth-alert" role="status">
              Customer registration is currently closed.
            </p>
          )}

          {!isAdmin && (
            <p className="auth-terms">
              By continuing, you agree to our{" "}
              <Link href="/terms">Terms</Link> and{" "}
              <Link href="/privacy">Privacy Policy</Link>.
            </p>
          )}
        </div>

        {!isAdmin && (
          <Link href="/" className="back-home">
            ← Back to PrintHub
          </Link>
        )}
      </section>
    </main>
  );
}
