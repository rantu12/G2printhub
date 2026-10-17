import { OAuth2Client } from "google-auth-library";
import { getIntegrationValue } from "@/lib/integration-secrets";
import {
  getConfiguredSiteUrl,
  getStoreSettings,
} from "@/lib/store-settings";

export const GOOGLE_CALLBACK_PATH = "/api/auth/google/callback";
export const GOOGLE_ATTEMPT_COOKIE = "printhub_google_attempt";

export async function getGoogleOAuthClient(): Promise<OAuth2Client> {
  const [clientId, clientSecret, settings] = await Promise.all([
    getIntegrationValue("GOOGLE_CLIENT_ID"),
    getIntegrationValue("GOOGLE_CLIENT_SECRET"),
    getStoreSettings(),
  ]);
  const appUrl = await getConfiguredSiteUrl(settings);

  if (!settings.googleSignInEnabled) {
    throw new Error("Google sign-in is disabled.");
  }
  if (!clientId || !clientSecret || !appUrl) {
    throw new Error("Google sign-in is not configured.");
  }

  return new OAuth2Client(
    clientId,
    clientSecret,
    new URL(GOOGLE_CALLBACK_PATH, appUrl).toString(),
  );
}

export async function getGoogleClientId(): Promise<string> {
  const clientId = await getIntegrationValue("GOOGLE_CLIENT_ID");
  if (!clientId) {
    throw new Error("Google sign-in is not configured.");
  }
  return clientId;
}
