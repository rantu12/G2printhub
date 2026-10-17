export const courierPartnerNames = [
  "Blue Dart",
  "Delhivery",
  "DTDC",
  "India Post",
  "DHL Express",
  "FedEx",
  "Ecom Express",
] as const;

export function isCourierPartnerName(
  value: string
): value is (typeof courierPartnerNames)[number] {
  return courierPartnerNames.some((name) => name === value);
}
