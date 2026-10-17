import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@/app/generated/prisma/client";

const DEFAULT_STORE_SETTINGS_ID = "default";
type StoreSettingsClient =
  | Pick<PrismaClient, "storeSettings">
  | Pick<Prisma.TransactionClient, "storeSettings">;

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export async function ensureStoreSettings(
  client: StoreSettingsClient,
  data: Partial<{
    shippingFee: string | number;
    taxRate: string | number;
    codEnabled: boolean;
    codMinimumAmount: string | number;
    codMaximumAmount: string | number | null;
    codFee: string | number;
    cashfreeEnabled: boolean;
    siteName: string;
    siteLogo: string;
    siteFavicon: string;
    storeAddress: string;
    supportEmail: string;
    supportPhone: string;
    currency: string;
    timeZone: string;
    defaultOrderStatus: string;
    websiteUrl: string;
    maintenanceMode: boolean;
    registrationEnabled: boolean;
    passwordLoginEnabled: boolean;
    googleSignInEnabled: boolean;
    emailVerificationRequired: boolean | null;
  }> = {}
) {
  const existing = await client.storeSettings.findUnique({
    where: { id: DEFAULT_STORE_SETTINGS_ID },
  });

  if (existing) {
    if (Object.keys(data).length > 0) {
      return client.storeSettings.update({
        where: { id: DEFAULT_STORE_SETTINGS_ID },
        data: {
          ...data,
          ...(data.shippingFee === undefined
            ? {}
            : { shippingFee: data.shippingFee.toString() }),
          ...(data.taxRate === undefined
            ? {}
            : { taxRate: data.taxRate.toString() }),
          ...(data.codMinimumAmount === undefined
            ? {}
            : { codMinimumAmount: data.codMinimumAmount.toString() }),
          ...(data.codMaximumAmount === undefined ||
          data.codMaximumAmount === null
            ? {}
            : { codMaximumAmount: data.codMaximumAmount.toString() }),
          ...(data.codFee === undefined
            ? {}
            : { codFee: data.codFee.toString() }),
          ...(data.codMaximumAmount === undefined
            ? {}
            : { codMaximumAmount: data.codMaximumAmount === null
              ? null
              : data.codMaximumAmount.toString() }),
        },
      });
    }

    return existing;
  }

  try {
    return await client.storeSettings.create({
      data: {
        id: DEFAULT_STORE_SETTINGS_ID,
        shippingFee: (data.shippingFee ?? "0").toString(),
        taxRate: (data.taxRate ?? "0").toString(),
        codEnabled: data.codEnabled ?? true,
        cashfreeEnabled: data.cashfreeEnabled ?? false,
        ...data,
        ...(data.codMaximumAmount === null
          ? { codMaximumAmount: null }
          : {}),
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    return (
      (await client.storeSettings.findUnique({
        where: { id: DEFAULT_STORE_SETTINGS_ID },
      })) ??
      (await client.storeSettings.create({
        data: {
          id: DEFAULT_STORE_SETTINGS_ID,
          shippingFee: (data.shippingFee ?? "0").toString(),
          taxRate: (data.taxRate ?? "0").toString(),
          codEnabled: data.codEnabled ?? true,
          cashfreeEnabled: data.cashfreeEnabled ?? false,
          ...data,
          ...(data.codMaximumAmount === null
            ? { codMaximumAmount: null }
            : {}),
        },
      }))
    );
  }
}

export async function getStoreSettings() {
  return ensureStoreSettings(prisma);
}

export async function getConfiguredSiteUrl(
  settings?: Awaited<ReturnType<typeof getStoreSettings>>
) {
  settings ??= await getStoreSettings();
  const configuredUrl = settings.websiteUrl.trim() || process.env.APP_URL?.trim();
  if (!configuredUrl) {
    throw new Error("WEBSITE_URL_NOT_CONFIGURED");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(configuredUrl);
  } catch {
    throw new Error("WEBSITE_URL_INVALID");
  }
  if (
    !["http:", "https:"].includes(parsedUrl.protocol) ||
    parsedUrl.username ||
    parsedUrl.password ||
    (process.env.NODE_ENV === "production" && parsedUrl.protocol !== "https:")
  ) {
    throw new Error("WEBSITE_URL_INVALID");
  }
  return parsedUrl.origin;
}
