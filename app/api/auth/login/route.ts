import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/auth";
import { consumeAuthRateLimit, getRequestIdentity } from "@/lib/auth-rate-limit";
import { normalizeEmail } from "@/lib/auth-security";
import { isEmailVerificationConfigured } from "@/lib/verification-email";
import { getStoreSettings } from "@/lib/store-settings";

const HOUR_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, message: "Email and password are required." },
        { status: 400 },
      );
    }

    const values = body as Record<string, unknown>;
    const email = normalizeEmail(values.email);
    const password =
      typeof values.password === "string" ? values.password : "";
    const accountType =
      values.accountType === "admin" ? "admin" : "customer";
    if (
      accountType === "customer" &&
      (await getStoreSettings()).maintenanceMode
    ) {
      return NextResponse.json(
        { success: false, message: "The store is temporarily unavailable for maintenance." },
        { status: 503 },
      );
    }

    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          message: "Email and password are required.",
        },
        { status: 400 }
      );
    }

    const identity = getRequestIdentity(request);
    const [ipAllowed, emailAllowed] = await Promise.all([
      consumeAuthRateLimit("login-ip", identity, 20, HOUR_MS),
      consumeAuthRateLimit("login-email", email, 10, HOUR_MS),
    ]);
    if (!ipAllowed || !emailAllowed) {
      return NextResponse.json(
        { success: false, message: "Too many sign-in attempts. Please try again later." },
        { status: 429 },
      );
    }

    const matchingUsers = await prisma.user.findMany({
      where: { email: { equals: email, mode: "insensitive" } },
      take: 2,
    });
    const user = matchingUsers.length === 1 ? matchingUsers[0] : null;

    // Prevent user enumeration: generic error message if user does not exist or has no password
    if (!user || !user.passwordHash) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid email or password.",
        },
        { status: 401 }
      );
    }

    const passwordValid = await verifyPassword(
      password,
      user.passwordHash
    );

    if (!passwordValid) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid email or password.",
        },
        { status: 401 }
      );
    }

    if (user.isBlocked) {
      return NextResponse.json(
        {
          success: false,
          message: "This account has been blocked. Please contact support.",
        },
        { status: 403 }
      );
    }

    if (accountType === "admin" && user.role !== "ADMIN") {
      return NextResponse.json(
        {
          success: false,
          message: "This account does not have administrator access.",
        },
        { status: 403 }
      );
    }

    // Check email verification status for customers
    if (user.role === "CUSTOMER") {
      const [settings, emailConfigured] = await Promise.all([
        getStoreSettings(),
        isEmailVerificationConfigured(),
      ]);
      if (!settings.passwordLoginEnabled) {
        return NextResponse.json(
          {
            success: false,
            message: "Email and password login is currently disabled.",
          },
          { status: 403 }
        );
      }
      const verificationRequired =
        settings.emailVerificationRequired ?? emailConfigured;
      if (verificationRequired && !user.emailVerifiedAt) {
        return NextResponse.json(
          {
            success: false,
            message: "Please verify your email address before signing in.",
          },
          { status: 403 }
        );
      }
      if (
        settings.emailVerificationRequired === null &&
        !emailConfigured &&
        !user.emailVerifiedAt
      ) {
        await prisma.user.update({
          where: { id: user.id },
          data: { emailVerifiedAt: new Date() },
        });
      }
    }

    await createSession(user.id);

    return NextResponse.json({
      success: true,
      message: "Login successful.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Something went wrong. Please try again.",
      },
      { status: 500 }
    );
  }
}