import { NextResponse } from "next/server";
import { consumeAuthRateLimit, getRequestIdentity } from "@/lib/auth-rate-limit";
import {
  createOpaqueToken,
  hashOpaqueToken,
  isGmailAddress,
  normalizeEmail,
  VERIFICATION_RESEND_COOLDOWN_MS,
  VERIFICATION_TTL_MS,
} from "@/lib/auth-security";
import { prisma } from "@/lib/prisma";
import {
  isEmailVerificationConfigured,
  sendVerificationEmail,
} from "@/lib/verification-email";
import { getStoreSettings } from "@/lib/store-settings";

const HOUR_MS = 60 * 60 * 1000;
const GENERIC_MESSAGE =
  "If an unverified account exists for that Gmail address, a verification email will be sent.";

export async function POST(request: Request) {
  try {
    const settings = await getStoreSettings();
    const emailConfigured = await isEmailVerificationConfigured();
    if (!(settings.emailVerificationRequired ?? emailConfigured)) {
      return NextResponse.json(
        { success: true, message: GENERIC_MESSAGE },
        { status: 202 }
      );
    }
    const body: unknown = await request.json();
    const email =
      body && typeof body === "object" && "email" in body
        ? normalizeEmail(body.email)
        : "";
    if (!isGmailAddress(email)) {
      return NextResponse.json(
        { success: false, message: "Enter a valid @gmail.com address." },
        { status: 400 },
      );
    }

    const identity = getRequestIdentity(request);
    const [ipAllowed, emailAllowed] = await Promise.all([
      consumeAuthRateLimit("resend-ip", identity, 10, HOUR_MS),
      consumeAuthRateLimit("resend-email", email, 5, HOUR_MS),
    ]);
    if (!ipAllowed || !emailAllowed) {
      return NextResponse.json(
        { success: false, message: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, emailVerifiedAt: true, isBlocked: true },
    });
    if (!user || user.emailVerifiedAt || user.isBlocked) {
      return NextResponse.json({ success: true, message: GENERIC_MESSAGE }, { status: 202 });
    }

    const now = new Date();
    const cooldownCutoff = new Date(now.getTime() - VERIFICATION_RESEND_COOLDOWN_MS);
    const token = createOpaqueToken();
    const current = await prisma.emailVerificationToken.findUnique({
      where: { userId: user.id },
      select: { id: true, sentAt: true },
    });

    if (current && current.sentAt > cooldownCutoff) {
      return NextResponse.json(
        { success: false, message: "Please wait 60 seconds before requesting another verification email." },
        { status: 429 },
      );
    }

    if (current) {
      const updated = await prisma.emailVerificationToken.updateMany({
        where: { id: current.id, sentAt: { lte: cooldownCutoff } },
        data: {
          tokenHash: hashOpaqueToken(token),
          expiresAt: new Date(now.getTime() + VERIFICATION_TTL_MS),
          sentAt: now,
          usedAt: null,
        },
      });
      if (updated.count !== 1) {
        return NextResponse.json(
          { success: false, message: "Please wait 60 seconds before requesting another verification email." },
          { status: 429 },
        );
      }
    } else {
      await prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: hashOpaqueToken(token),
          expiresAt: new Date(now.getTime() + VERIFICATION_TTL_MS),
          sentAt: now,
        },
      });
    }

    try {
      await sendVerificationEmail(email, token);
    } catch (error) {
      console.error("Resend verification email error:", error);
      return NextResponse.json(
        { success: false, message: "We could not send the verification email. Please try again after 60 seconds." },
        { status: 503 },
      );
    }

    return NextResponse.json({ success: true, message: GENERIC_MESSAGE }, { status: 202 });
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to request a verification email. Please try again." },
      { status: 500 },
    );
  }
}
