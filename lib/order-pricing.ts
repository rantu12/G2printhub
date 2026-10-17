export function calculateOrderCharges(
  subtotalCents: number,
  discountCents: number,
  shippingFee: number | string,
  taxRate: number | string,
  additionalFee: number | string = 0
) {
  if (
    !Number.isSafeInteger(subtotalCents) ||
    !Number.isSafeInteger(discountCents) ||
    subtotalCents < 0 ||
    discountCents < 0 ||
    discountCents > subtotalCents
  ) {
    throw new Error("INVALID_ORDER_TOTAL");
  }

  const shippingFeeCents = Math.round(Number(shippingFee) * 100);
  const additionalFeeCents = Math.round(Number(additionalFee) * 100);
  const rateBasisPoints = Math.round(Number(taxRate) * 100);
  if (
    !Number.isSafeInteger(shippingFeeCents) ||
    shippingFeeCents < 0 ||
    !Number.isSafeInteger(additionalFeeCents) ||
    additionalFeeCents < 0 ||
    !Number.isSafeInteger(rateBasisPoints) ||
    rateBasisPoints < 0 ||
    rateBasisPoints > 10_000
  ) {
    throw new Error("INVALID_ORDER_TOTAL");
  }

  const taxableCents =
    subtotalCents - discountCents + shippingFeeCents + additionalFeeCents;
  const taxCents = Math.round(
    taxableCents * (rateBasisPoints / 10_000)
  );
  const totalCents = taxableCents + taxCents;
  if (
    !Number.isSafeInteger(taxCents) ||
    !Number.isSafeInteger(totalCents)
  ) {
    throw new Error("INVALID_ORDER_TOTAL");
  }

  return { shippingFeeCents, taxCents, totalCents };
}
