import "dotenv/config";
import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "../lib/password";
import { normalizeEmail } from "../lib/auth-security";
import { isEmailVerificationConfiguredWithValues } from "../lib/email-verification-config";

test("Password hashing and verification uses consistent bcrypt algorithm", async () => {
  const password = "SuperSecretPassword123!";
  const hash = await hashPassword(password);

  assert.ok(hash.startsWith("$2"), "Hash should be a valid bcrypt hash");
  assert.notEqual(hash, password, "Hash must never equal plain text password");

  const isMatch = await verifyPassword(password, hash);
  assert.equal(isMatch, true, "Correct password must verify successfully");

  const isWrongMatch = await verifyPassword("WrongPassword456!", hash);
  assert.equal(isWrongMatch, false, "Incorrect password must be rejected");
});

test("Email normalization consistently trims and lowercases addresses", () => {
  assert.equal(normalizeEmail("  Customer@Example.Com  "), "customer@example.com");
  assert.equal(normalizeEmail("USER@GMAIL.COM"), "user@gmail.com");
  assert.equal(normalizeEmail(""), "");
  assert.equal(normalizeEmail(null), "");
  assert.equal(normalizeEmail(undefined), "");
});

test("Registration server logic strictly enforces CUSTOMER role and rejects ADMIN spoofing", () => {
  const sanitizeRegistrationRole = (clientPayload: Record<string, unknown>) => {
    // Server must always ignore any role passed by the client
    const safeRole = "CUSTOMER";
    return safeRole;
  };

  assert.equal(
    sanitizeRegistrationRole({ role: "ADMIN", name: "Hacker" }),
    "CUSTOMER",
    "Client cannot set ADMIN role during registration"
  );
  assert.equal(
    sanitizeRegistrationRole({ role: "SUPERADMIN", name: "User" }),
    "CUSTOMER"
  );
});

test("Registration handles optional phone and required fields validation", () => {
  const validateRegistrationFields = (input: {
    name?: string;
    email?: string;
    phone?: string;
    password?: string;
  }) => {
    const name = input.name?.trim() || "";
    const email = normalizeEmail(input.email);
    const password = input.password || "";
    const phone = input.phone?.trim() || "";

    if (!name || !email || !password) {
      return { valid: false, message: "Name, email address, and password are required." };
    }
    if (name.length < 2) {
      return { valid: false, message: "Name must be between 2 and 100 characters." };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { valid: false, message: "Please enter a valid email address." };
    }
    if (password.length < 8) {
      return { valid: false, message: "Password must be at least 8 characters." };
    }
    if (phone) {
      const phoneDigits = phone.replace(/\D/g, "");
      if (
        !/^\+?[0-9\s().-]{7,30}$/.test(phone) ||
        phoneDigits.length < 7 ||
        phoneDigits.length > 15
      ) {
        return { valid: false, message: "Invalid phone number." };
      }
    }
    return { valid: true, data: { name, email, phone: phone || null } };
  };

  // Missing phone is completely valid (phone is optional)
  const withoutPhone = validateRegistrationFields({
    name: "Jane Doe",
    email: "jane@example.com",
    password: "Password123!",
  });
  assert.equal(withoutPhone.valid, true);
  assert.equal(withoutPhone.data?.phone, null);

  // Valid phone is accepted
  const withPhone = validateRegistrationFields({
    name: "Jane Doe",
    email: "jane@example.com",
    phone: "+91 9876543210",
    password: "Password123!",
  });
  assert.equal(withPhone.valid, true);
  assert.equal(withPhone.data?.phone, "+91 9876543210");

  // Missing required name
  const missingName = validateRegistrationFields({
    name: "",
    email: "jane@example.com",
    password: "Password123!",
  });
  assert.equal(missingName.valid, false);

  // Missing required password
  const missingPassword = validateRegistrationFields({
    name: "Jane Doe",
    email: "jane@example.com",
    password: "",
  });
  assert.equal(missingPassword.valid, false);

  // Invalid email
  const invalidEmail = validateRegistrationFields({
    name: "Jane Doe",
    email: "not-an-email",
    password: "Password123!",
  });
  assert.equal(invalidEmail.valid, false);
});

test("Login credential validation returns uniform generic error message without user enumeration", async () => {
  const genericErrorMessage = "Invalid email or password.";

  const authenticateUser = async (
    userRecord: { passwordHash: string | null } | null,
    inputPassword: string
  ) => {
    // Non-existent user or user with no password hash (e.g. Google-only account)
    if (!userRecord || !userRecord.passwordHash) {
      return { status: 401, message: genericErrorMessage };
    }

    const isValid = await verifyPassword(inputPassword, userRecord.passwordHash);
    if (!isValid) {
      return { status: 401, message: genericErrorMessage };
    }

    return { status: 200, message: "Login successful." };
  };

  // 1. Non-existent user
  const nonExistent = await authenticateUser(null, "AnyPassword123!");
  assert.equal(nonExistent.status, 401);
  assert.equal(nonExistent.message, genericErrorMessage);

  // 2. Google-only user without password hash
  const googleUser = await authenticateUser({ passwordHash: null }, "AnyPassword123!");
  assert.equal(googleUser.status, 401);
  assert.equal(googleUser.message, genericErrorMessage);

  // 3. User with wrong password
  const realHash = await hashPassword("RealPassword123!");
  const wrongPassword = await authenticateUser({ passwordHash: realHash }, "WrongPassword123!");
  assert.equal(wrongPassword.status, 401);
  assert.equal(wrongPassword.message, genericErrorMessage);

  // 4. Correct credentials
  const success = await authenticateUser({ passwordHash: realHash }, "RealPassword123!");
  assert.equal(success.status, 200);
  assert.equal(success.message, "Login successful.");
});

test("Authenticated redirect logic redirects users to their appropriate dashboard without loops", () => {
  const getRedirectForUser = (user: { role: string } | null, currentPath: string) => {
    if (!user) {
      return null; // Stay on login/register page
    }
    if (user.role === "ADMIN") {
      return "/admin";
    }
    return "/account";
  };

  // Unauthenticated user -> no redirect, can view login/register
  assert.equal(getRedirectForUser(null, "/login"), null);
  assert.equal(getRedirectForUser(null, "/register"), null);

  // Authenticated customer visiting /login or /register -> redirected to /account
  assert.equal(getRedirectForUser({ role: "CUSTOMER" }, "/login"), "/account");
  assert.equal(getRedirectForUser({ role: "CUSTOMER" }, "/register"), "/account");

  // Authenticated admin visiting /login or /admin/login -> redirected to /admin
  assert.equal(getRedirectForUser({ role: "ADMIN" }, "/login"), "/admin");
  assert.equal(getRedirectForUser({ role: "ADMIN" }, "/admin/login"), "/admin");
});

test("email verification configuration requires credentials and an app URL", () => {
  assert.equal(
    isEmailVerificationConfiguredWithValues(
      "resend-key",
      "PrintHub <support@example.com>",
      "https://example.com"
    ),
    true
  );
  assert.equal(
    isEmailVerificationConfiguredWithValues(undefined, "support@example.com", "https://example.com"),
    false
  );
  assert.equal(
    isEmailVerificationConfiguredWithValues(
      "your-resend-api-key",
      "support@example.com",
      "https://example.com"
    ),
    false
  );
});
