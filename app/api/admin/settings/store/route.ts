import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStoreSettings, ensureStoreSettings } from "@/lib/store-settings";
import { isEmailVerificationConfigured } from "@/lib/verification-email";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+0-9().\s-]{0,30}$/;
const URL_PATTERN = /^\/(?!\/)|^https?:\/\//i;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function authError(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return json({ success: false, message: "Authentication required." }, 401);
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return json({ success: false, message: "Admin access required." }, 403);
  }
  return null;
}

function isText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim().length <= maximum;
}

function publicSettings(settings: Awaited<ReturnType<typeof getStoreSettings>>) {
  return {
    siteName: settings.siteName,
    siteLogo: settings.siteLogo,
    siteFavicon: settings.siteFavicon,
    storeAddress: settings.storeAddress,
    supportEmail: settings.supportEmail,
    supportPhone: settings.supportPhone,
    currency: settings.currency,
    timeZone: settings.timeZone,
    defaultOrderStatus: settings.defaultOrderStatus,
    websiteUrl: settings.websiteUrl,
    maintenanceMode: settings.maintenanceMode,
    registrationEnabled: settings.registrationEnabled,
    passwordLoginEnabled: settings.passwordLoginEnabled,
    googleSignInEnabled: settings.googleSignInEnabled,
    emailVerificationRequired: settings.emailVerificationRequired,
  };
}

export async function GET() {
  try {
    await requireAdmin();
    const [settings, emailConfigured] = await Promise.all([
      getStoreSettings(),
      isEmailVerificationConfigured(),
    ]);
    return json({
      success: true,
      settings: publicSettings(settings),
      emailConfigured,
      effectiveEmailVerificationRequired:
        settings.emailVerificationRequired ?? emailConfigured,
      forgotPasswordImplemented: false,
    });
  } catch (error) {
    const auth = authError(error);
    if (auth) return auth;
    console.error("Admin store settings GET error:", error);
    return json(
      { success: false, message: "Unable to load store settings." },
      500
    );
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ success: false, message: "Invalid store settings." }, 400);
    }

    const values = body as Record<string, unknown>;
    const allowedKeys = new Set([
      "siteName",
      "siteLogo",
      "siteFavicon",
      "storeAddress",
      "supportEmail",
      "supportPhone",
      "currency",
      "timeZone",
      "defaultOrderStatus",
      "websiteUrl",
      "maintenanceMode",
      "registrationEnabled",
      "passwordLoginEnabled",
      "googleSignInEnabled",
      "emailVerificationRequired",
    ]);
    if (Object.keys(values).some((key) => !allowedKeys.has(key))) {
      return json({ success: false, message: "Unsupported store setting." }, 400);
    }

    const textFields = [
      ["siteName", 100],
      ["siteLogo", 2048],
      ["siteFavicon", 2048],
      ["storeAddress", 500],
      ["supportEmail", 254],
      ["supportPhone", 30],
    ] as const;
    for (const [key, maximum] of textFields) {
      if (!isText(values[key], maximum) || values[key].trim().length === 0 && key === "siteName") {
        return json({ success: false, message: `Enter a valid ${key}.` }, 400);
      }
    }
    for (const key of ["siteLogo", "siteFavicon"] as const) {
      const value = (values[key] as string).trim();
      if (value && !URL_PATTERN.test(value)) {
        return json(
          { success: false, message: `${key} must be a local path or HTTP(S) URL.` },
          400
        );
      }
    }
    const supportEmail = (values.supportEmail as string).trim();
    if (supportEmail && !EMAIL_PATTERN.test(supportEmail)) {
      return json({ success: false, message: "Enter a valid support email." }, 400);
    }
    const supportPhone = (values.supportPhone as string).trim();
    if (!PHONE_PATTERN.test(supportPhone)) {
      return json({ success: false, message: "Enter a valid support phone." }, 400);
    }
    if (values.currency !== "INR") {
      return json(
        {
          success: false,
          message:
            "Only INR is supported by the current checkout and Cashfree configuration.",
        },
        400
      );
    }
    if (
      typeof values.websiteUrl !== "string" ||
      values.websiteUrl.trim().length > 2048
    ) {
      return json({ success: false, message: "Enter a valid website URL." }, 400);
    }
    const websiteUrl = values.websiteUrl.trim();
    if (websiteUrl) {
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(websiteUrl);
      } catch {
        return json(
          { success: false, message: "Website URL must be an absolute HTTP(S) URL." },
          400
        );
      }
      if (
        !["http:", "https:"].includes(parsedUrl.protocol) ||
        parsedUrl.username ||
        parsedUrl.password ||
        (parsedUrl.pathname !== "/" && parsedUrl.pathname !== "") ||
        parsedUrl.search ||
        parsedUrl.hash ||
        (process.env.NODE_ENV === "production" &&
          parsedUrl.protocol !== "https:")
      ) {
        return json(
          {
            success: false,
            message:
              "Website URL must be a site origin (HTTPS in production), without credentials, path, query, or fragment.",
          },
          400
        );
      }
    }
    if (typeof values.storeAddress !== "string" ||
      values.storeAddress.trim().length > 500) {
      return json({ success: false, message: "Enter a valid store address." }, 400);
    }
    if (typeof values.timeZone !== "string" || values.timeZone.length > 100) {
      return json({ success: false, message: "Choose a valid time zone." }, 400);
    }
    try {
      new Intl.DateTimeFormat("en", { timeZone: values.timeZone });
    } catch {
      return json({ success: false, message: "Choose a valid time zone." }, 400);
    }
    if (
      values.defaultOrderStatus !== "PENDING" &&
      values.defaultOrderStatus !== "ACCEPTED"
    ) {
      return json(
        { success: false, message: "Choose PENDING or ACCEPTED as the default order status." },
        400
      );
    }
    if (typeof values.maintenanceMode !== "boolean") {
      return json(
        { success: false, message: "Choose whether maintenance mode is enabled." },
        400
      );
    }
    for (const key of [
      "registrationEnabled",
      "passwordLoginEnabled",
      "googleSignInEnabled",
    ]) {
      if (typeof values[key] !== "boolean") {
        return json(
          { success: false, message: `Choose whether ${key} is enabled.` },
          400
        );
      }
    }
    if (
      values.emailVerificationRequired !== null &&
      typeof values.emailVerificationRequired !== "boolean"
    ) {
      return json(
        { success: false, message: "Choose a valid email verification policy." },
        400
      );
    }

    const updated = await ensureStoreSettings(prisma, {
        siteName: (values.siteName as string).trim(),
        siteLogo: (values.siteLogo as string).trim(),
        siteFavicon: (values.siteFavicon as string).trim(),
        storeAddress: (values.storeAddress as string).trim(),
        supportEmail,
        supportPhone,
        currency: "INR",
        timeZone: values.timeZone as string,
        defaultOrderStatus: values.defaultOrderStatus as string,
        websiteUrl,
        maintenanceMode: values.maintenanceMode as boolean,
        registrationEnabled: values.registrationEnabled as boolean,
        passwordLoginEnabled: values.passwordLoginEnabled as boolean,
        googleSignInEnabled: values.googleSignInEnabled as boolean,
        emailVerificationRequired:
          values.emailVerificationRequired as boolean | null,
      });

    return json({
      success: true,
      message: "Store and authentication settings saved.",
      settings: publicSettings(updated),
      emailConfigured: await isEmailVerificationConfigured(),
      effectiveEmailVerificationRequired:
        updated.emailVerificationRequired ??
        (await isEmailVerificationConfigured()),
      forgotPasswordImplemented: false,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return json({ success: false, message: "Invalid JSON request." }, 400);
    }
    const auth = authError(error);
    if (auth) return auth;
    console.error("Admin store settings PUT error:", error);
    return json({ success: false, message: "Unable to save store settings." }, 500);
  }
}
