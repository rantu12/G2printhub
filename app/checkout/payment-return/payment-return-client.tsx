"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useCart } from "@/lib/cart-context";

type PaymentResult = {
  orderNumber: string;
  paymentStatus: string;
  status: string;
  total: string;
};

function isPaymentResult(value: unknown): value is PaymentResult {
  if (!value || typeof value !== "object") return false;
  const order = value as Record<string, unknown>;
  return (
    typeof order.orderNumber === "string" &&
    typeof order.paymentStatus === "string" &&
    typeof order.status === "string" &&
    typeof order.total === "string"
  );
}

async function fetchPaymentResult(orderId: string): Promise<PaymentResult> {
  if (!orderId) {
    throw new Error("The Cashfree return URL did not include an order number.");
  }

  const response = await fetch(
    `/api/payments/cashfree/verify?order_id=${encodeURIComponent(orderId)}`,
    { cache: "no-store" }
  );
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || "Unable to verify the payment.");
  }
  if (!isPaymentResult(data.order)) {
    throw new Error("The server returned an invalid payment status.");
  }
  return data.order;
}

export default function CashfreePaymentReturn({
  orderId,
}: {
  orderId: string;
}) {
  const { clearCart } = useCart();
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [error, setError] = useState("");

  const verifyPayment = useCallback(async () => {
    setChecking(true);
    setError("");
    try {
      const payment = await fetchPaymentResult(orderId);
      setResult(payment);
      if (payment.paymentStatus === "PAID") {
        clearCart();
      }
    } catch (verificationError) {
      console.error("Cashfree return verification error:", verificationError);
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : "Unable to verify the payment."
      );
    } finally {
      setLoading(false);
      setChecking(false);
    }
  }, [clearCart, orderId]);

  useEffect(() => {
    let active = true;
    fetchPaymentResult(orderId)
      .then((payment) => {
        if (!active) return;
        setResult(payment);
        if (payment.paymentStatus === "PAID") {
          clearCart();
        }
      })
      .catch((verificationError: unknown) => {
        if (!active) return;
        console.error("Cashfree return verification error:", verificationError);
        setError(
          verificationError instanceof Error
            ? verificationError.message
            : "Unable to verify the payment."
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [clearCart, orderId]);

  const paid = result?.paymentStatus === "PAID";

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <div aria-hidden="true" style={iconStyle(paid)}>
          {loading ? "…" : paid ? "✓" : "!"}
        </div>
        <h1 style={{ margin: "0 0 10px", fontSize: "28px" }}>
          {loading
            ? "Verifying your payment"
            : paid
              ? "Payment confirmed"
              : "Payment not confirmed"}
        </h1>
        <p style={{ color: "#4b5563", lineHeight: 1.7 }}>
          {loading
            ? "Please wait while we verify the payment with Cashfree."
            : paid
              ? "Your Cashfree payment was received. Your order is being processed."
              : error ||
                "Cashfree has not confirmed payment yet. You can check again shortly; please do not place the same order again."}
        </p>

        {result && (
          <div style={orderBoxStyle}>
            <p style={{ margin: "0 0 8px", color: "#6b7280" }}>Order number</p>
            <strong>{result.orderNumber}</strong>
            <p style={{ margin: "12px 0 0" }}>
              Total: <strong>₹{Number(result.total).toFixed(2)}</strong>
            </p>
            <p style={{ margin: "8px 0 0", color: "#6b7280" }}>
              Payment: {result.paymentStatus}
            </p>
          </div>
        )}

        {error && result && (
          <p role="alert" style={{ color: "#b91c1c" }}>
            {error}
          </p>
        )}

        {!loading && !paid && (
          <button
            type="button"
            onClick={() => void verifyPayment()}
            disabled={checking}
            style={buttonStyle}
          >
            {checking ? "Checking..." : "Check payment again"}
          </button>
        )}
        <div style={{ marginTop: "16px" }}>
          <Link href="/orders" style={{ color: "#4f46e5" }}>
            View my orders
          </Link>
          {" · "}
          <Link href="/" style={{ color: "#4f46e5" }}>
            Continue shopping
          </Link>
        </div>
      </section>
    </main>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background: "#f9fafb",
  padding: "36px 20px",
  color: "#111827",
};

const cardStyle = {
  maxWidth: "560px",
  margin: "40px auto",
  padding: "32px 24px",
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: "16px",
  textAlign: "center" as const,
};

const iconStyle = (paid: boolean) => ({
  width: "52px",
  height: "52px",
  lineHeight: "52px",
  margin: "0 auto 18px",
  borderRadius: "50%",
  background: paid ? "#dcfce7" : "#fef3c7",
  color: paid ? "#047857" : "#92400e",
  fontSize: "30px",
  fontWeight: 700,
});

const orderBoxStyle = {
  margin: "24px 0",
  padding: "20px",
  borderRadius: "12px",
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
  lineHeight: 1.7,
};

const buttonStyle = {
  border: 0,
  borderRadius: "8px",
  padding: "12px 18px",
  background: "#4f46e5",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};
