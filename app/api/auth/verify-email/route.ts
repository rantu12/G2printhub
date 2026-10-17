import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { consumeAuthRateLimit, getRequestIdentity } from "@/lib/auth-rate-limit";
import {
  getVerificationTokenStatus,
  hashOpaqueToken,
} from "@/lib/auth-security";
import { prisma } from "@/lib/prisma";

const HOUR_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  try {
    if (
      !(await consumeAuthRateLimit(
        "verify-ip",
        getRequestIdentity(request),
        20,
        HOUR_MS,
      ))
    ) {
      return NextResponse.json(
        { success: false, message: "Too many verification attempts. Please try again later." },
        { status: 429 },
      );
    }

    const body: unknown = await request.json();
    const token =
      body && typeof body === "object" && "token" in body &&
      typeof body.token === "string"
        ? body.token
        : "";
    if (!/^[a-f0-9]{64}$/.test(token)) {
      return NextResponse.json(
        { success: false, message: "This verification link is invalid." },
        { status: 400 },
      );
    }

    const record = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash: hashOpaqueToken(token) },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
        user: {
          select: {
            email: true,
            emailVerifiedAt: true,
            isBlocked: true,
            role: true,
          },
        },
      },
    });
    if (!record) {
      return NextResponse.json(
        { success: false, message: "This verification link is invalid or has already been used." },
        { status: 400 },
      );
    }
    const tokenStatus = getVerificationTokenStatus(record);
    if (tokenStatus === "used") {
      return NextResponse.json(
        { success: false, message: "This verification link has already been used. Please sign in." },
        { status: 409 },
      );
    }
    if (tokenStatus === "expired") {
      return NextResponse.json(
        { success: false, message: "This verification link has expired. Request a new link." },
        { status: 410 },
      );
    }
    if (record.user.emailVerifiedAt) {
      return NextResponse.json(
        { success: false, message: "This email address is already verified. Please sign in." },
        { status: 409 },
      );
    }
    if (record.user.isBlocked || record.user.role !== "CUSTOMER") {
      return NextResponse.json(
        { success: false, message: "This account cannot be activated. Please contact support." },
        { status: 403 },
      );
    }

    const verified = await prisma.$transaction(async (tx) => {
      const claimed = await tx.emailVerificationToken.updateMany({
        where: {
          id: record.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) return false;

      const activated = await tx.user.updateMany({
        where: { id: record.userId, emailVerifiedAt: null, isBlocked: false },
        data: { emailVerifiedAt: new Date() },
      });
      return activated.count === 1;
    });

    if (!verified) {
      return NextResponse.json(
        { success: false, message: "This verification link has expired or has already been used." },
        { status: 409 },
      );
    }

    await createSession(record.userId);
    return NextResponse.json({
      success: true,
      message: "Email verified. You are now signed in.",
      redirectTo: "/account",
    });
  } catch (error) {
    console.error("Email verification error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to verify this email. Please try again." },
      { status: 500 },
    );
  }
}
