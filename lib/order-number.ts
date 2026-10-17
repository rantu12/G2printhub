export function formatOrderNumber(sequenceValue: string): string {
  if (!/^[1-9]\d*$/.test(sequenceValue)) {
    throw new Error("Order number sequence must be a positive integer.");
  }

  return `G2-PH-${sequenceValue.padStart(4, "0")}`;
}
