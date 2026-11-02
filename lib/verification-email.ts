import { Resend } from "resend";
import { isEmailVerificationConfiguredWithValues } from "@/lib/email-verification-config";
import { getIntegrationValue } from "@/lib/integration-secrets";
import { getConfiguredSiteUrl, getStoreSettings } from "@/lib/store-settings";

export async function isEmailVerificationConfigured(): Promise<boolean> {
  const [apiKey, from, settings] = await Promise.all([
    getIntegrationValue("RESEND_API_KEY"),
    getIntegrationValue("EMAIL_FROM"),
    getStoreSettings(),
  ]);
  let appUrl: string;
  try {
    appUrl = await getConfiguredSiteUrl(settings);
  } catch (error) {
    if (
      error instanceof Error &&
      ["WEBSITE_URL_NOT_CONFIGURED", "WEBSITE_URL_INVALID"].includes(
        error.message,
      )
    ) {
      return false;
    }
    throw error;
  }

  return isEmailVerificationConfiguredWithValues(apiKey, from, appUrl);
}

export async function sendVerificationEmail(
  email: string,
  token: string,
): Promise<void> {
  const [apiKey, from, settings] = await Promise.all([
    getIntegrationValue("RESEND_API_KEY"),
    getIntegrationValue("EMAIL_FROM"),
    getStoreSettings(),
  ]);
  const appUrl = await getConfiguredSiteUrl(settings);

  if (
    !apiKey ||
    !from ||
    !appUrl ||
    !isEmailVerificationConfiguredWithValues(apiKey, from, appUrl)
  ) {
    throw new Error("Email verification is not configured.");
  }

  let verificationUrl: URL;
  try {
    verificationUrl = new URL("/verify-email", appUrl);
  } catch {
    throw new Error("APP_URL must be a valid absolute URL.");
  }
  if (
    !["http:", "https:"].includes(verificationUrl.protocol) ||
    (process.env.NODE_ENV === "production" && verificationUrl.protocol !== "https:")
  ) {
    throw new Error("APP_URL must use HTTP or HTTPS and HTTPS in production.");
  }
  verificationUrl.searchParams.set("token", token);

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: "Verify your G2 PrintHub email",
    html: `<p>Thanks for creating a G2 PrintHub account.</p><p><a href="${verificationUrl.toString()}">Verify your email address</a></p><p>This link expires in 30 minutes and can only be used once.</p>`,
    text: `Thanks for creating a G2 PrintHub account. Verify your email address: ${verificationUrl.toString()}\nThis link expires in 30 minutes and can only be used once.`,
  });

  if (error) {
    throw new Error(`Resend could not deliver the verification email: ${error.message}`);
  }
}
