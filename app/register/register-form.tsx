"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setError("");
    setSuccess("");

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName || !trimmedEmail || !password) {
      setError("Please fill in all required fields (Name, Email, Password).");
      return;
    }

    if (trimmedName.length < 2 || trimmedName.length > 100) {
      setError("Name must be between 2 and 100 characters.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (trimmedPhone) {
      const phoneDigits = trimmedPhone.replace(/\D/g, "");
      if (
        !/^\+?[0-9\s().-]{7,30}$/.test(trimmedPhone) ||
        phoneDigits.length < 7 ||
        phoneDigits.length > 15
      ) {
        setError("Please enter a valid mobile number (7–15 digits) or leave it blank.");
        return;
      }
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (new TextEncoder().encode(password).length > 72) {
      setError("Password must be no more than 72 bytes.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!agreeTerms) {
      setError("Please agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          phone: trimmedPhone || undefined,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || "Registration failed. Please check your details.");
        return;
      }

      setSuccess(data.message || "Account created successfully! Redirecting...");
      if (data.requiresEmailVerification) {
        return;
      }

      // Redirect to customer dashboard
      const destination = data.redirectTo || "/account";
      router.push(destination);
      router.refresh();
    } catch {
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page register-page">
      <div className="auth-background" />

      <section className="auth-shell">
        <div className="auth-brand">
          <Link href="/" className="brand-logo">
            <span className="brand-icon">P</span>
            <span>
              Print<span>Hub</span>
            </span>
          </Link>
          <p>Create. Print. Deliver.</p>
        </div>

        <div className="auth-card register-card">
          <div className="auth-card-header">
            <span className="auth-badge">GET STARTED</span>
            <h1>Create your account</h1>
            <p>
              Join G2 PrintHub and manage your custom printing orders from one
              place.
            </p>
          </div>

          {error && (
            <div className="auth-alert auth-error" role="alert">
              <span>!</span>
              {error}
            </div>
          )}

          {success && (
            <div className="auth-alert auth-success" role="status">
              <span>✓</span>
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <label>
              Full name *
              <div className="input-wrap">
                <span className="input-icon">◉</span>
                <input
                  type="text"
                  placeholder="Your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  minLength={2}
                  maxLength={100}
                  required
                  disabled={loading}
                />
              </div>
            </label>

            <label>
              Email address *
              <div className="input-wrap">
                <span className="input-icon">✉</span>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  disabled={loading}
                />
              </div>
            </label>

            <label>
              Mobile number <small style={{ color: "#64748b", fontWeight: 400 }}>(optional)</small>
              <div className="input-wrap">
                <span className="input-icon">☎</span>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  disabled={loading}
                />
              </div>
            </label>

            <label>
              Password *
              <div className="input-wrap">
                <span className="input-icon">●</span>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={loading}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            <label>
              Confirm password *
              <div className="input-wrap">
                <span className="input-icon">●</span>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  disabled={loading}
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            <label className="terms-check">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                required
                disabled={loading}
              />
              <span>
                I agree to the{" "}
                <Link href="/terms">Terms of Service</Link> and{" "}
                <Link href="/privacy">Privacy Policy</Link>.
              </span>
            </label>

            <button
              type="submit"
              className="auth-submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner" />
                  Creating account...
                </>
              ) : (
                <>
                  Create account
                  <span>→</span>
                </>
              )}
            </button>
          </form>

          <div className="auth-divider">
            <span>Or</span>
          </div>

          <a href="/api/auth/google" className="secondary-auth-button">
            Continue with Google
          </a>

          <div className="auth-divider">
            <span>Already have an account?</span>
          </div>

          <Link href="/login" className="secondary-auth-button">
            Sign in instead
          </Link>

          <p className="auth-terms">
            Your account is protected with secure bcrypt password hashing
            and HTTP-only session cookies.
          </p>
        </div>

        <Link href="/" className="back-home">
          ← Back to G2 PrintHub
        </Link>
      </section>
    </main>
  );
}
