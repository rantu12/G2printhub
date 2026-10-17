import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureStoreSettings, getStoreSettings } from "@/lib/store-settings";
import { getCashfreeMode, isCashfreeConfigured } from "@/lib/cashfree";

function authError(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json(
      { success: false, message: "Authentication required." },
      { status: 401 }
    );
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return NextResponse.json(
      { success: false, message: "Admin access required." },
      { status: 403 }
    );
  }
  return null;
}

export async function GET() {
  try {
    await requireAdmin();
    const settings = await getStoreSettings();
    return NextResponse.json({
      success: true,
      settings: {
        shippingFee: settings.shippingFee.toString(),
        taxRate: settings.taxRate.toString(),
        codEnabled: settings.codEnabled,
        codMinimumAmount: settings.codMinimumAmount.toString(),
        codMaximumAmount: settings.codMaximumAmount?.toString() ?? "",
        codFee: settings.codFee.toString(),
        cashfreeEnabled: settings.cashfreeEnabled,
        cashfreeConfigured: await isCashfreeConfigured(),
        cashfreeMode: await getCashfreeMode(),
      },
    });
  } catch (error) {
    const auth = authError(error);
    if (auth) return auth;
    console.error("Shipping/tax settings GET error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load shipping and tax settings." },
      { status: 500 }
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
      return NextResponse.json(
        { success: false, message: "Provide valid shipping and tax settings." },
        { status: 400 }
      );
    }

    const payload = body as Record<string, unknown>;
    const allowedKeys = new Set([
      "shippingFee",
      "taxRate",
      "codEnabled",
      "cashfreeEnabled",
      "codMinimumAmount",
      "codMaximumAmount",
      "codFee",
      "confirmProduction",
    ]);
    if (Object.keys(payload).some((key) => !allowedKeys.has(key))) {
      return NextResponse.json(
        { success: false, message: "Unsupported store setting." },
        { status: 400 }
      );
    }
    if (
      payload.codEnabled !== undefined &&
      typeof payload.codEnabled !== "boolean"
    ) {
      return NextResponse.json(
        { success: false, message: "Choose whether Cash on Delivery is enabled." },
        { status: 400 }
      );
    }
    if (
      payload.cashfreeEnabled !== undefined &&
      typeof payload.cashfreeEnabled !== "boolean"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Choose whether Cashfree Payments is enabled.",
        },
        { status: 400 }
      );
    }
    if (
      payload.confirmProduction !== undefined &&
      typeof payload.confirmProduction !== "boolean"
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid production confirmation." },
        { status: 400 }
      );
    }
    if (
      !["number", "string"].includes(typeof payload.shippingFee) ||
      !["number", "string"].includes(typeof payload.taxRate) ||
      String(payload.shippingFee).trim() === "" ||
      String(payload.taxRate).trim() === ""
    ) {
      return NextResponse.json(
        { success: false, message: "Shipping fee and tax rate are required." },
        { status: 400 }
      );
    }
    if (
      !["number", "string"].includes(typeof payload.codMinimumAmount) ||
      !["number", "string"].includes(typeof payload.codFee) ||
      (payload.codMaximumAmount !== undefined &&
        payload.codMaximumAmount !== null &&
        typeof payload.codMaximumAmount !== "string" &&
        typeof payload.codMaximumAmount !== "number")
    ) {
      return NextResponse.json(
        { success: false, message: "Provide valid COD amount limits and fee." },
        { status: 400 }
      );
    }
    const shippingFee = Number(payload.shippingFee);
    const taxRate = Number(payload.taxRate);
    const codMinimumAmount = Number(payload.codMinimumAmount);
    const codFee = Number(payload.codFee);
    const codMaximumRaw = payload.codMaximumAmount;
    const codMaximumAmount =
      codMaximumRaw === undefined ||
      codMaximumRaw === null ||
      String(codMaximumRaw).trim() === ""
        ? null
        : Number(codMaximumRaw);
    if (
      !Number.isFinite(shippingFee) ||
      shippingFee < 0 ||
      shippingFee > 1_000_000 ||
      Math.round(shippingFee * 100) !== shippingFee * 100
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Shipping fee must be a valid amount from ₹0 to ₹10,00,000.",
        },
        { status: 400 }
      );
    }
    if (
      !Number.isFinite(taxRate) ||
      taxRate < 0 ||
      taxRate > 100 ||
      Math.round(taxRate * 100) !== taxRate * 100
    ) {
      return NextResponse.json(
        { success: false, message: "Tax rate must be between 0% and 100%." },
        { status: 400 }
      );
    }
    if (
      !Number.isFinite(codMinimumAmount) ||
      codMinimumAmount < 0 ||
      codMinimumAmount > 1_000_000 ||
      Math.round(codMinimumAmount * 100) !== codMinimumAmount * 100 ||
      !Number.isFinite(codFee) ||
      codFee < 0 ||
      codFee > 1_000_000 ||
      Math.round(codFee * 100) !== codFee * 100 ||
      (codMaximumAmount !== null &&
        (!Number.isFinite(codMaximumAmount) ||
          codMaximumAmount < codMinimumAmount ||
          codMaximumAmount > 1_000_000 ||
          Math.round(codMaximumAmount * 100) !== codMaximumAmount * 100))
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "COD minimum, maximum, and fee must be valid amounts; maximum must be at least the minimum.",
        },
        { status: 400 }
      );
    }

    if (payload.cashfreeEnabled === true) {
      const [existingSettings, cashfreeConfigured, cashfreeMode] =
        await Promise.all([
          getStoreSettings(),
          isCashfreeConfigured(),
          getCashfreeMode(),
        ]);
      if (!cashfreeConfigured) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Cashfree cannot be enabled until credentials match the selected environment.",
          },
          { status: 409 }
        );
      }
      if (
        cashfreeMode === "production" &&
        !existingSettings.cashfreeEnabled &&
        payload.confirmProduction !== true
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Explicitly confirm live payments before enabling production Cashfree checkout.",
          },
          { status: 400 }
        );
      }
    }

    const settings = await ensureStoreSettings(prisma, {
      shippingFee: shippingFee.toFixed(2),
      taxRate: taxRate.toFixed(2),
      codMinimumAmount: codMinimumAmount.toFixed(2),
      codMaximumAmount:
        codMaximumAmount === null ? null : codMaximumAmount.toFixed(2),
      codFee: codFee.toFixed(2),
      ...(typeof payload.codEnabled === "boolean"
        ? { codEnabled: payload.codEnabled }
        : {}),
      ...(typeof payload.cashfreeEnabled === "boolean"
        ? { cashfreeEnabled: payload.cashfreeEnabled }
        : {}),
    });
    return NextResponse.json({
      success: true,
      message: "Shipping and tax settings saved.",
      settings: {
        shippingFee: settings.shippingFee.toString(),
        taxRate: settings.taxRate.toString(),
        codEnabled: settings.codEnabled,
        codMinimumAmount: settings.codMinimumAmount.toString(),
        codMaximumAmount: settings.codMaximumAmount?.toString() ?? "",
        codFee: settings.codFee.toString(),
        cashfreeEnabled: settings.cashfreeEnabled,
        cashfreeConfigured: await isCashfreeConfigured(),
        cashfreeMode: await getCashfreeMode(),
      },
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, message: "Invalid JSON request." },
        { status: 400 }
      );
    }
    const auth = authError(error);
    if (auth) return auth;
    console.error("Shipping/tax settings PUT error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to save shipping and tax settings." },
      { status: 500 }
    );
  }
}
