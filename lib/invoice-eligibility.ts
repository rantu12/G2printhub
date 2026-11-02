export function isInvoiceDownloadAvailable(
  paymentStatus: string,
  orderStatus: string
) {
  return paymentStatus === "PAID" || orderStatus === "DELIVERED";
}
