"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteOrderControl({
  orderId,
  orderNumber,
}: {
  orderId: string;
  orderNumber: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function deleteOrder() {
    if (
      !window.confirm(
        `Delete order ${orderNumber}?\n\nThis permanently deletes the order and its associated customer uploads. This cannot be undone.`
      )
    ) {
      return;
    }

    try {
      setDeleting(true);
      setError("");
      const response = await fetch(
        `/api/admin/orders/${encodeURIComponent(orderId)}`,
        { method: "DELETE" }
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to delete this order.");
      }

      router.refresh();
    } catch (deleteError) {
      console.error("Delete order error:", deleteError);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete this order."
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="admin-order-delete-control">
      <button
        type="button"
        className="admin-order-delete-button"
        onClick={deleteOrder}
        disabled={deleting}
      >
        {deleting ? "Deleting..." : "Delete order"}
      </button>
      {error && (
        <p className="admin-order-action-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
