import { getIntegrationValue } from "@/lib/integration-secrets";
import { verifyCashfreeSignatureWithSecret } from "@/lib/cashfree-webhook-signature";
import {
  getConfiguredSiteUrl,
  getStoreSettings,
} from "@/lib/store-settings";

export type CashfreeMode = "sandbox" | "production";

type CashfreeConfig = {
  clientId: string;
  clientSecret: string;
  apiBaseUrl: string;
  appUrl: string;
};

type CashfreeOrderInput = {
  orderId: string;
  amount: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  returnUrl: string;
};

type CashfreeOrder = {
  order_id: string;
  order_status: string;
  order_amount: number;
  order_currency: string;
  payment_session_id?: string;
};

async function readCashfreeConfig(): Promise<CashfreeConfig> {
  const [clientId, clientSecret, configuredEnvironment, settings] = await Promise.all([
    getIntegrationValue("CASHFREE_CLIENT_ID"),
    getIntegrationValue("CASHFREE_CLIENT_SECRET"),
    getIntegrationValue("CASHFREE_ENVIRONMENT"),
    getStoreSettings(),
  ]);
  const environment = configuredEnvironment || "sandbox";
  const appUrl = await getConfiguredSiteUrl(settings);

  if (!clientId || !clientSecret) {
    throw new Error("CASHFREE_NOT_CONFIGURED");
  }
  if (environment !== "sandbox" && environment !== "production") {
    throw new Error("CASHFREE_ENVIRONMENT_INVALID");
  }
  const testCredential = clientId.toUpperCase().startsWith("TEST");
  if (
    (environment === "sandbox" && !testCredential) ||
    (environment === "production" && testCredential)
  ) {
    throw new Error("CASHFREE_CREDENTIALS_ENVIRONMENT_MISMATCH");
  }

  let parsedAppUrl: URL;
  try {
    parsedAppUrl = new URL(appUrl);
  } catch {
    throw new Error("APP_URL_INVALID");
  }
  if (
    !["http:", "https:"].includes(parsedAppUrl.protocol) ||
    (environment === "production" && parsedAppUrl.protocol !== "https:")
  ) {
    throw new Error("APP_URL_INVALID");
  }

  return {
    clientId,
    clientSecret,
    appUrl: parsedAppUrl.origin,
    apiBaseUrl:
      environment === "production"
        ? "https://api.cashfree.com/pg"
        : "https://sandbox.cashfree.com/pg",
  };
}

export async function isCashfreeConfigured(): Promise<boolean> {
  try {
    await readCashfreeConfig();
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      [
        "CASHFREE_NOT_CONFIGURED",
        "CASHFREE_ENVIRONMENT_INVALID",
        "CASHFREE_CREDENTIALS_ENVIRONMENT_MISMATCH",
        "APP_URL_INVALID",
        "WEBSITE_URL_NOT_CONFIGURED",
        "WEBSITE_URL_INVALID",
      ].includes(error.message)
    ) {
      return false;
    }
    throw error;
  }
}

export async function assertCashfreeConfigured(): Promise<void> {
  await readCashfreeConfig();
}

export async function cashfreeReturnUrl(orderId: string): Promise<string> {
  const { appUrl } = await readCashfreeConfig();
  const returnUrl = new URL("/checkout/payment-return", appUrl);
  returnUrl.searchParams.set("order_id", orderId);
  return returnUrl.toString();
}

export async function getCashfreeMode(): Promise<CashfreeMode> {
  return (await getIntegrationValue("CASHFREE_ENVIRONMENT")) === "production"
    ? "production"
    : "sandbox";
}

async function cashfreeRequest<T>(
  path: string,
  method: "GET" | "POST",
  body?: unknown
): Promise<T> {
  const config = await readCashfreeConfig();
  const apiVersion = process.env.CASHFREE_API_VERSION?.trim() || "2023-08-01";
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-api-version": apiVersion,
      "x-client-id": config.clientId,
      "x-client-secret": config.clientSecret,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`CASHFREE_REQUEST_FAILED:${response.status}`);
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error("CASHFREE_RESPONSE_INVALID");
  }
}

export async function createCashfreeOrder(input: CashfreeOrderInput) {
  const phone = input.customerPhone.replace(/\D/g, "");
  const normalizedPhone =
    phone.length === 12 && phone.startsWith("91")
      ? phone.slice(2)
      : phone.length === 11 && phone.startsWith("0")
        ? phone.slice(1)
        : phone;
  if (!/^\d{10}$/.test(normalizedPhone)) {
    throw new Error("CASHFREE_PHONE_INVALID");
  }

  const result = await cashfreeRequest<{
    order_id?: string;
    payment_session_id?: string;
  }>("/orders", "POST", {
    order_id: input.orderId,
    order_amount: Number(input.amount),
    order_currency: "INR",
    customer_details: {
      customer_id: input.customerId,
      customer_name: input.customerName,
      customer_email: input.customerEmail,
      customer_phone: normalizedPhone,
    },
    order_meta: {
      return_url: input.returnUrl,
    },
  });

  if (
    result.order_id !== input.orderId ||
    typeof result.payment_session_id !== "string" ||
    !result.payment_session_id
  ) {
    throw new Error("CASHFREE_RESPONSE_INVALID");
  }
  return result.payment_session_id;
}

export async function fetchCashfreeOrder(orderId: string) {
  return cashfreeRequest<CashfreeOrder>(
    `/orders/${encodeURIComponent(orderId)}`,
    "GET"
  );
}

export async function verifyCashfreeWebhookSignature(
  rawBody: string,
  timestamp: string | null,
  signature: string | null
): Promise<boolean> {
  const { clientSecret } = await readCashfreeConfig();
  return verifyCashfreeSignatureWithSecret(
    rawBody,
    timestamp,
    signature,
    clientSecret
  );
}
