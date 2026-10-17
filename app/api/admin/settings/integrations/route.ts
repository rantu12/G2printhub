import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getCashfreeMode, isCashfreeConfigured } from "@/lib/cashfree";
import {
  getConfiguredSiteUrl,
  getStoreSettings,
} from "@/lib/store-settings";
import {
  getIntegrationOverrides,
  getIntegrationValue,
  INTEGRATION_SECRET_KEYS,
  isIntegrationSecretKey,
  saveIntegrationSecrets,
  type IntegrationSecretKey,
} from "@/lib/integration-secrets";

const MAX_VALUE_LENGTH = 4096;

function authError(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json(
      { success: false, message: "Authentication required." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return NextResponse.json(
      { success: false, message: "Admin access required." },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }
  return null;
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function integrationStatus() {
  const [overrides, values] = await Promise.all([
    getIntegrationOverrides(),
    Promise.all(INTEGRATION_SECRET_KEYS.map((key) => getIntegrationValue(key))),
  ]);
  const fields = Object.fromEntries(
    INTEGRATION_SECRET_KEYS.map((key, index) => [
      key,
      {
        hasOverride: overrides[key] === true,
        configured: Boolean(values[index]),
        source: overrides[key] ? "admin" : values[index] ? "environment" : "missing",
      },
    ])
  );
  const [
    cashfreeConfigured,
    cashfreeMode,
    storeSettings,
  ] =
    await Promise.all([
      isCashfreeConfigured(),
      getCashfreeMode(),
      getStoreSettings(),
    ]);
  let siteUrlConfigured = false;
  try {
    await getConfiguredSiteUrl(storeSettings);
    siteUrlConfigured = true;
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !["WEBSITE_URL_NOT_CONFIGURED", "WEBSITE_URL_INVALID"].includes(
        error.message
      )
    ) {
      throw error;
    }
  }
  const googleHasCredentials = Boolean(values[0] && values[1]);
  const resendHasCredentials = Boolean(
    values[2] &&
      values[2] !== "your-resend-api-key" &&
      values[3]
  );

  return {
    fields,
    integrations: {
      google: {
        configured: googleHasCredentials && siteUrlConfigured,
        enabled: storeSettings.googleSignInEnabled,
      },
      resend: { configured: resendHasCredentials && siteUrlConfigured },
      cashfree: {
        configured: cashfreeConfigured,
        enabled: storeSettings.cashfreeEnabled,
        mode: cashfreeMode,
      },
      unsupported: {
        smtp: "not_implemented",
        sms: "not_implemented",
        shipping: "not_implemented",
      },
    },
  };
}

export async function GET() {
  try {
    await requireAdmin();
    return json({ success: true, ...(await integrationStatus()) });
  } catch (error) {
    const auth = authError(error);
    if (auth) return auth;
    console.error("Admin integration settings GET error:", error);
    return json(
      { success: false, message: "Unable to load integration settings." },
      500
    );
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
    const body: unknown = await request.json();
    if (
      body === null ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return json(
        { success: false, message: "Provide valid integration settings." },
        400
      );
    }

    const payload = body as Record<string, unknown>;
    if (
      Object.keys(payload).some(
        (key) =>
          key !== "values" &&
          key !== "clearKeys" &&
          key !== "confirmProduction"
      )
    ) {
      return json(
        { success: false, message: "Unsupported integration setting." },
        400
      );
    }
    const valuesPayload = payload.values ?? {};
    const clearPayload = payload.clearKeys ?? [];
    if (
      valuesPayload === null ||
      typeof valuesPayload !== "object" ||
      Array.isArray(valuesPayload) ||
      !Array.isArray(clearPayload) ||
      (payload.confirmProduction !== undefined &&
        typeof payload.confirmProduction !== "boolean")
    ) {
      return json(
        { success: false, message: "Provide valid integration settings." },
        400
      );
    }

    const values: Partial<Record<IntegrationSecretKey, string>> = {};
    for (const [key, value] of Object.entries(valuesPayload)) {
      if (!isIntegrationSecretKey(key)) {
        return json(
          { success: false, message: "Unsupported integration credential." },
          400
        );
      }
      if (typeof value !== "string") {
        return json(
          { success: false, message: "Integration credentials must be text." },
          400
        );
      }
      const trimmed = value.trim();
      if (!trimmed) continue;
      if (trimmed.length > MAX_VALUE_LENGTH) {
        return json(
          { success: false, message: "Integration credential is too long." },
          400
        );
      }
      if (
        key === "CASHFREE_ENVIRONMENT" &&
        trimmed !== "sandbox" &&
        trimmed !== "production"
      ) {
        return json(
          { success: false, message: "Choose sandbox or production mode." },
          400
        );
      }
      values[key] = trimmed;
    }

    const clearKeys: IntegrationSecretKey[] = [];
    for (const key of clearPayload) {
      if (
        typeof key !== "string" ||
        !isIntegrationSecretKey(key) ||
        clearKeys.includes(key)
      ) {
        return json(
          { success: false, message: "Unsupported integration credential." },
          400
        );
      }
      if (values[key]) {
        return json(
          {
            success: false,
            message: "A credential cannot be saved and cleared at the same time.",
          },
          400
        );
      }
      clearKeys.push(key);
    }

    const currentMode = await getCashfreeMode();
    const nextMode =
      values.CASHFREE_ENVIRONMENT ??
      (clearKeys.includes("CASHFREE_ENVIRONMENT")
        ? process.env.CASHFREE_ENVIRONMENT?.trim() === "production"
          ? "production"
          : "sandbox"
        : currentMode);
    const modifiesCashfreeCredentials =
      values.CASHFREE_CLIENT_ID !== undefined ||
      values.CASHFREE_CLIENT_SECRET !== undefined ||
      clearKeys.includes("CASHFREE_CLIENT_ID") ||
      clearKeys.includes("CASHFREE_CLIENT_SECRET");
    if (
      nextMode === "production" &&
      (currentMode !== "production" || modifiesCashfreeCredentials) &&
      payload.confirmProduction !== true
    ) {
      return json(
        {
          success: false,
          message:
            "Explicitly confirm production mode before saving live Cashfree settings.",
        },
        400
      );
    }
    if (
      nextMode === "production" &&
      (clearKeys.includes("CASHFREE_CLIENT_ID") ||
        clearKeys.includes("CASHFREE_CLIENT_SECRET"))
    ) {
      return json(
        { success: false, message: "Live Cashfree credentials are required." },
        400
      );
    }
    const nextClientId =
      values.CASHFREE_CLIENT_ID ??
      (clearKeys.includes("CASHFREE_CLIENT_ID")
        ? undefined
        : await getIntegrationValue("CASHFREE_CLIENT_ID"));
    const nextClientSecret =
      values.CASHFREE_CLIENT_SECRET ??
      (clearKeys.includes("CASHFREE_CLIENT_SECRET")
        ? undefined
        : await getIntegrationValue("CASHFREE_CLIENT_SECRET"));
    if (
      nextMode === "production" &&
      (!nextClientId ||
        !nextClientSecret ||
        nextClientId.toUpperCase().startsWith("TEST"))
    ) {
      return json(
        {
          success: false,
          message:
            "Production requires configured live credentials; sandbox TEST credentials cannot be used.",
        },
        400
      );
    }
    if (
      nextMode === "sandbox" &&
      nextClientId &&
      !nextClientId.toUpperCase().startsWith("TEST")
    ) {
      return json(
        {
          success: false,
          message:
            "Sandbox mode requires a Cashfree test App ID beginning with TEST.",
        },
        400
      );
    }

    await saveIntegrationSecrets(values, clearKeys);
    return json({
      success: true,
      message: "Integration settings saved. Secret values are never displayed.",
      ...(await integrationStatus()),
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return json({ success: false, message: "Invalid JSON request." }, 400);
    }
    const auth = authError(error);
    if (auth) return auth;
    console.error("Admin integration settings PUT error:", error);
    return json(
      {
        success: false,
        message:
          "Unable to save integration settings. Verify INTEGRATION_SECRETS_KEY and database connectivity.",
      },
      500
    );
  }
}
