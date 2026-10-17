import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import {
  getGoogleOAuthClient,
  GOOGLE_ATTEMPT_COOKIE,
} from "@/lib/google-oauth";
import { getStoreSettings } from "@/lib/store-settings";

const TEN_MINUTES = 10 * 60;

export async function GET(request: Request) {
  try {
    if ((await getStoreSettings()).maintenanceMode) {
      return NextResponse.redirect(new URL("/maintenance", request.url));
    }
    const client = await getGoogleOAuthClient();
    const state = randomBytes(32).toString("base64url");
    const nonce = randomBytes(32).toString("base64url");
    const authorizationUrl = client.generateAuthUrl({
      access_type: "online",
      prompt: "select_account",
      scope: ["openid", "email", "profile"],
      state,
      nonce,
    });
    const response = NextResponse.redirect(authorizationUrl);
    response.cookies.set(GOOGLE_ATTEMPT_COOKIE, `${state}.${nonce}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: TEN_MINUTES,
      path: "/api/auth/google",
    });
    return response;
  } catch (error) {
    console.error("Google sign-in setup error:", error);
    return NextResponse.redirect(new URL("/login?error=google", request.url));
  }
}
