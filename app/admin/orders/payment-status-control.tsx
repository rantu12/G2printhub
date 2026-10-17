"use client";

import { useState } from "react";

export default function PaymentStatusControl({
  orderId,
  initialPaymentStatus,
}: {
  orderId: string;
  initialPaymentStatus: string;
}) {
  const [paymentStatus, setPaymentStatus] = useState(initialPaymentStatus);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const nextPaymentStatus = paymentStatus === "PAID" ? "UNPAID" : "PAID";

  async function updatePaymentStatus() {
    try {
      setUpdating(true);
      setError("");

      const response = await fetch(
        `/api/admin/orders/${encodeURIComponent(orderId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ paymentStatus: nextPaymentStatus }),
        }
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to update payment status.");
      }

      setPaymentStatus(data.order.paymentStatus);
    } catch (error) {
      console.error("Update payment status error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Unable to update payment status."
      );
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="admin-order-payment-control">
      <span
        className={`admin-order-payment-badge ${
          paymentStatus === "PAID" ? "admin-order-payment-paid" : ""
        }`}
      >
        {paymentStatus}
      </span>
      <button
        type="button"
        className="admin-order-action admin-order-action-advance"
        onClick={updatePaymentStatus}
        disabled={updating}
      >
        {updating
          ? "Updating..."
          : paymentStatus === "PAID"
            ? "Mark as unpaid"
            : "Mark as paid"}
      </button>
      {error && (
        <p className="admin-order-action-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
