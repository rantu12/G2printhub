"use client";

import { useState } from "react";

const nextActions: Record<string, { label: string; status: string; kind: string }[]> = {
  PENDING: [
    { label: "Accept order", status: "ACCEPTED", kind: "accept" },
    { label: "Reject order", status: "REJECTED", kind: "reject" },
  ],
  ACCEPTED: [
    { label: "Mark as shipped", status: "SHIPPED", kind: "advance" },
  ],
  SHIPPED: [
    { label: "Mark as delivered", status: "DELIVERED", kind: "advance" },
  ],
};

export default function OrderStatusControl({
  orderId,
  initialStatus,
}: {
  orderId: string;
  initialStatus: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const actions = nextActions[status] ?? [];

  async function updateStatus(nextStatus: string) {
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
          body: JSON.stringify({ status: nextStatus }),
        }
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to update order status.");
      }

      setStatus(data.order.status);
    } catch (error) {
      console.error("Update order status error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Unable to update order status."
      );
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="admin-order-status-control">
      <span
        className={`status-badge ${
          status === "REJECTED" || status === "CANCELLED"
            ? "status-inactive"
            : "status-active"
        }`}
      >
        {status}
      </span>
      {actions.length > 0 && (
        <div className="admin-order-actions">
          {actions.map((action) => (
            <button
              key={action.status}
              type="button"
              className={`admin-order-action admin-order-action-${action.kind}`}
              onClick={() => updateStatus(action.status)}
              disabled={updating}
            >
              {updating ? "Updating..." : action.label}
            </button>
          ))}
        </div>
      )}
      {error && (
        <p className="admin-order-action-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
