export function isCodAvailableForProducts(
  storeCodEnabled: boolean,
  productCodSettings: boolean[],
  expectedProductCount = productCodSettings.length
): boolean {
  return (
    storeCodEnabled &&
    productCodSettings.length === expectedProductCount &&
    productCodSettings.every(Boolean)
  );
}

export function isCodAvailableForAmount(
  totalCents: number,
  minimumCents: number,
  maximumCents: number | null
): boolean {
  return (
    Number.isSafeInteger(totalCents) &&
    Number.isSafeInteger(minimumCents) &&
    minimumCents >= 0 &&
    (maximumCents === null || Number.isSafeInteger(maximumCents)) &&
    (maximumCents === null ||
      (maximumCents >= minimumCents && maximumCents >= 0)) &&
    totalCents >= minimumCents &&
    (maximumCents === null || totalCents <= maximumCents)
  );
}
