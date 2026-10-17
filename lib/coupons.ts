type CouponRules = {
  discountType: string;
  value: number | string | { toString(): string };
  minimumSubtotal: number | string | { toString(): string };
  maximumDiscount: number | string | { toString(): string } | null;
  usageLimit: number | null;
  usageCount: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
};

export function getCouponUnavailableReason(
  coupon: CouponRules,
  now = new Date()
) {
  if (!coupon.isActive) return "This coupon is inactive.";
  if (coupon.startsAt && coupon.startsAt > now) {
    return "This coupon is not available yet.";
  }
  if (coupon.endsAt && coupon.endsAt < now) {
    return "This coupon has expired.";
  }
  if (
    coupon.usageLimit !== null &&
    coupon.usageCount >= coupon.usageLimit
  ) {
    return "This coupon has reached its usage limit.";
  }
  return null;
}

export function calculateCouponDiscountCents(
  coupon: CouponRules,
  subtotalCents: number
) {
  const valueCents = Math.round(Number(coupon.value) * 100);

  if (!Number.isSafeInteger(subtotalCents) || subtotalCents < 0) {
    throw new Error("INVALID_ORDER_TOTAL");
  }

  const minimumSubtotalCents = Math.round(
    Number(coupon.minimumSubtotal) * 100
  );
  if (subtotalCents < minimumSubtotalCents) {
    throw new Error(
      `A minimum subtotal of ₹${(minimumSubtotalCents / 100).toFixed(2)} is required for this coupon.`
    );
  }

  let discountCents =
    coupon.discountType === "PERCENTAGE"
      ? Math.round((subtotalCents * Number(coupon.value)) / 100)
      : valueCents;

  if (coupon.maximumDiscount !== null) {
    discountCents = Math.min(
      discountCents,
      Math.round(Number(coupon.maximumDiscount) * 100)
    );
  }

  return Math.min(subtotalCents, Math.max(0, discountCents));
}
