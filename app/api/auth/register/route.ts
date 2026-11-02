import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { getStoreSettings } from "@/lib/store-settings";
import { createSession } from "@/lib/auth";
import {
  createOpaqueToken,
  hashOpaqueToken,
  normalizeEmail,
  VERIFICATION_TTL_MS,
} from "@/lib/auth-security";
import { consumeAuthRateLimit, getRequestIdentity } from "@/lib/auth-rate-limit";
import {
  isEmailVerificationConfigured,
  sendVerificationEmail,
} from "@/lib/verification-email";

const HOUR_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  try {
    if (
      !(await consumeAuthRateLimit(
        "register-ip",
        getRequestIdentity(request),
        10,
        HOUR_MS,
      ))
    ) {
      return NextResponse.json(
        { success: false, message: "Too many registration attempts. Please try again later." },
        { status: 429 },
      );
    }

    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, message: "Please provide valid registration details." },
        { status: 400 },
      );
    }

    const values = body as Record<string, unknown>;
    const name = typeof values.name === "string" ? values.name.trim() : "";
    const email = normalizeEmail(values.email);
    const phone = typeof values.phone === "string" ? values.phone.trim() : "";
    const password = typeof values.password === "string" ? values.password : "";
    const authSettings = await getStoreSettings();
    if (authSettings.maintenanceMode) {
      return NextResponse.json(
        { success: false, message: "The store is temporarily unavailable for maintenance." },
        { status: 503 },
      );
    }
    if (!authSettings.registrationEnabled) {
      return NextResponse.json(
        { success: false, message: "Customer registration is currently closed." },
        { status: 403 },
      );
    }

    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, message: "Name, email address, and password are required." },
        { status: 400 },
      );
    }
    if (name.length < 2 || name.length > 100) {
      return NextResponse.json(
        { success: false, message: "Name must be between 2 and 100 characters." },
        { status: 400 },
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, message: "Please enter a valid email address." },
        { status: 400 },
      );
    }
    if (
      !(await consumeAuthRateLimit(
        "register-email",
        email,
        5,
        HOUR_MS,
      ))
    ) {
      return NextResponse.json(
        { success: false, message: "Too many registration attempts for this email. Please try again later." },
        { status: 429 },
      );
    }

    if (phone) {
      const phoneDigits = phone.replace(/\D/g, "");
      if (
        !/^\+?[0-9\s().-]{7,30}$/.test(phone) ||
        phoneDigits.length < 7 ||
        phoneDigits.length > 15
      ) {
        return NextResponse.json(
          { success: false, message: "Please enter a valid mobile number or leave it blank." },
          { status: 400 },
        );
      }
    }

    if (
      password.length < 8 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      return NextResponse.json(
        { success: false, message: "Password must be at least 8 characters and no more than 72 UTF-8 bytes." },
        { status: 400 },
      );
    }

    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    if (existingUser) {
      return NextResponse.json(
        { success: false, message: "An account with this email already exists. Please sign in." },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(password);
    const emailConfigured = await isEmailVerificationConfigured();
    const verificationRequired =
      authSettings.emailVerificationRequired ?? emailConfigured;
    if (verificationRequired && !emailConfigured) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Email verification is required, but email delivery is not configured. Please contact support.",
        },
        { status: 503 },
      );
    }
    const token = verificationRequired ? createOpaqueToken() : null;
    const now = new Date();

    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone: phone || null,
        passwordHash,
        role: "CUSTOMER",
        emailVerifiedAt: verificationRequired ? null : now,
        ...(token
          ? {
              emailVerificationToken: {
                create: {
                  tokenHash: hashOpaqueToken(token),
                  expiresAt: new Date(now.getTime() + VERIFICATION_TTL_MS),
                  sentAt: now,
                },
              },
            }
          : {}),
      },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!verificationRequired) {
      await createSession(user.id);
    }

    if (verificationRequired && token) {
      try {
        await sendVerificationEmail(user.email, token);
      } catch (emailError) {
        console.error("Registration verification email error:", emailError);
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: verificationRequired
          ? "Your account was created. Check your email to verify your address before signing in."
          : "Account created successfully! Welcome to G2 PrintHub.",
        redirectTo: verificationRequired ? undefined : "/account",
        requiresEmailVerification: verificationRequired,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { success: false, message: "An account with this email already exists. Please sign in." },
        { status: 409 },
      );
    }
    console.error("Registration error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to create your account. Please try again." },
      { status: 500 },
    );
  }
}
