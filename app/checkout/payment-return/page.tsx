import CashfreePaymentReturn from "./payment-return-client";

export default async function CashfreePaymentReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ order_id?: string | string[] }>;
}) {
  const params = await searchParams;
  const orderId = typeof params.order_id === "string" ? params.order_id : "";

  return <CashfreePaymentReturn orderId={orderId} />;
}
