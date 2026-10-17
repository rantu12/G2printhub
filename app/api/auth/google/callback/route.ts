import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSession } from "@/lib/auth";
import {
  isGmailAddress,
  normalizeEmail,
} from "@/lib/auth-security";
import {
  getGoogleClientId,
  getGoogleOAuthClient,
  GOOGLE_ATTEMPT_COOKIE,
} from "@/lib/google-oauth";
import { prisma } from "@/lib/prisma";
import { getStoreSettings } from "@/lib/store-settings";

function signInError(requestUrl: URL) {
  return NextResponse.redirect(new URL("/login?error=google", requestUrl));
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const cookieStore = await cookies();
  const attempt = cookieStore.get(GOOGLE_ATTEMPT_COOKIE)?.value;
  const clearAttempt = () => {
    cookieStore.set(GOOGLE_ATTEMPT_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: new Date(0),
      path: "/api/auth/google",
    });
  };

  try {
    const code = requestUrl.searchParams.get("code");
    const returnedState = requestUrl.searchParams.get("state");
    const error = requestUrl.searchParams.get("error");
    const [expectedState, expectedNonce] = attempt?.split(".") ?? [];
    clearAttempt();

    if (
      error ||
      !code ||
      !returnedState ||
      !expectedState ||
      !expectedNonce ||
      returnedState !== expectedState
    ) {
      return signInError(requestUrl);
    }

    const [clientId, client, authSettings] = await Promise.all([
      getGoogleClientId(),
      getGoogleOAuthClient(),
      getStoreSettings(),
    ]);
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) return signInError(requestUrl);

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: clientId,
    });
    const claims = ticket.getPayload();
    if (
      !claims ||
      (claims.iss !== "https://accounts.google.com" &&
        claims.iss !== "accounts.google.com") ||
      claims.aud !== clientId ||
      typeof claims.exp !== "number" ||
      claims.exp * 1000 <= Date.now() ||
      claims.nonce !== expectedNonce ||
      claims.email_verified !== true ||
      typeof claims.email !== "string" ||
      claims.hd !== undefined
    ) {
      return signInError(requestUrl);
    }

    const email = normalizeEmail(claims.email);
    if (!isGmailAddress(email)) return signInError(requestUrl);

    const account = await prisma.$transaction(async (tx) => {
      const linkedAccount = await tx.oAuthAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider: "GOOGLE",
            providerAccountId: claims.sub,
          },
        },
        include: { user: true },
      });

      if (linkedAccount) {
        if (
          normalizeEmail(linkedAccount.user.email) !== email ||
          linkedAccount.user.role !== "CUSTOMER" ||
          linkedAccount.user.isBlocked
        ) {
          throw new Error("GOOGLE_ACCOUNT_NOT_ALLOWED");
        }
        return linkedAccount.user;
      }

      const matchingUsers = await tx.user.findMany({
        where: { email: { equals: email, mode: "insensitive" } },
        take: 2,
      });
      if (matchingUsers.length > 1) {
        throw new Error("GOOGLE_EMAIL_AMBIGUOUS");
      }
      const existingUser = matchingUsers[0] ?? null;
      if (
        existingUser &&
        (existingUser.role !== "CUSTOMER" || existingUser.isBlocked)
      ) {
        throw new Error("GOOGLE_ACCOUNT_NOT_ALLOWED");
      }
      if (!existingUser && !authSettings.registrationEnabled) {
        throw new Error("GOOGLE_REGISTRATION_DISABLED");
      }

      const user = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: { emailVerifiedAt: existingUser.emailVerifiedAt ?? new Date() },
          })
        : await tx.user.create({
            data: {
              name:
                typeof claims.name === "string" && claims.name.trim()
                  ? claims.name.trim().slice(0, 100)
                  : email.split("@")[0],
              email,
              role: "CUSTOMER",
              emailVerifiedAt: new Date(),
            },
          });

      if (existingUser && !existingUser.emailVerifiedAt) {
        await tx.emailVerificationToken.deleteMany({
          where: { userId: existingUser.id },
        });
      }

      await tx.oAuthAccount.create({
        data: {
          provider: "GOOGLE",
          providerAccountId: claims.sub,
          userId: user.id,
        },
      });
      return user;
    });

    await createSession(account.id);
    return NextResponse.redirect(new URL("/account", requestUrl));
  } catch (error) {
    if (
      !(
        error instanceof Error &&
        [
          "GOOGLE_ACCOUNT_NOT_ALLOWED",
          "GOOGLE_EMAIL_AMBIGUOUS",
          "GOOGLE_REGISTRATION_DISABLED",
        ].includes(
          error.message,
        )
      )
    ) {
      console.error("Google sign-in callback error:", error);
    }
    return signInError(requestUrl);
  }
}
