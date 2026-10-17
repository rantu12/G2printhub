export class CouponInputError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseCouponInput(value: unknown) {
  if (!isRecord(value)) {
    throw new CouponInputError("A valid coupon is required.");
  }

  const code =
    typeof value.code === "string" ? value.code.trim().toUpperCase() : "";
  const discountType = value.discountType;
  const amount = Number(value.value);
  const minimumSubtotal = Number(value.minimumSubtotal ?? 0);
  const maximumDiscount =
    value.maximumDiscount === "" ||
    value.maximumDiscount === null ||
    value.maximumDiscount === undefined
      ? null
      : Number(value.maximumDiscount);
  const usageLimit =
    value.usageLimit === "" ||
    value.usageLimit === null ||
    value.usageLimit === undefined
      ? null
      : Number(value.usageLimit);
  const startsAt =
    value.startsAt === "" || value.startsAt === null || value.startsAt === undefined
      ? null
      : new Date(String(value.startsAt));
  const endsAt =
    value.endsAt === "" || value.endsAt === null || value.endsAt === undefined
      ? null
      : new Date(String(value.endsAt));

  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
    throw new CouponInputError(
      "Coupon code must be 3–32 letters, numbers, hyphens or underscores."
    );
  }
  if (discountType !== "PERCENTAGE" && discountType !== "FIXED") {
    throw new CouponInputError("Choose a valid discount type.");
  }
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > (discountType === "PERCENTAGE" ? 100 : 1000000)
  ) {
    throw new CouponInputError(
      discountType === "PERCENTAGE"
        ? "Percentage must be greater than 0 and no more than 100."
        : "Fixed discount must be greater than 0."
    );
  }
  if (!Number.isFinite(minimumSubtotal) || minimumSubtotal < 0) {
    throw new CouponInputError("Minimum subtotal must be zero or greater.");
  }
  if (
    maximumDiscount !== null &&
    (!Number.isFinite(maximumDiscount) || maximumDiscount <= 0)
  ) {
    throw new CouponInputError("Maximum discount must be greater than zero.");
  }
  if (
    usageLimit !== null &&
    (!Number.isInteger(usageLimit) || usageLimit < 1)
  ) {
    throw new CouponInputError("Usage limit must be a positive whole number.");
  }
  if (
    (startsAt && !Number.isFinite(startsAt.getTime())) ||
    (endsAt && !Number.isFinite(endsAt.getTime()))
  ) {
    throw new CouponInputError("Enter valid coupon start and end dates.");
  }
  if (startsAt && endsAt && endsAt <= startsAt) {
    throw new CouponInputError("The end date must be after the start date.");
  }

  return {
    code,
    discountType,
    value: amount.toFixed(2),
    minimumSubtotal: minimumSubtotal.toFixed(2),
    maximumDiscount: maximumDiscount?.toFixed(2) ?? null,
    usageLimit,
    startsAt,
    endsAt,
    isActive: typeof value.isActive === "boolean" ? value.isActive : true,
  };
}
