"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ClearOrdersControl({
  orderCount,
  uploadCount,
}: {
  orderCount: number;
  uploadCount: number;
}) {
  const router = useRouter();
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");

  async function clearOrders() {
    if (confirmationText !== "DELETE ALL") return;

    try {
      setClearing(true);
      setError("");
      const response = await fetch("/api/admin/orders", {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to clear all orders.");
      }

      setConfirming(false);
      setConfirmationText("");
      router.refresh();
    } catch (clearError) {
      console.error("Clear all orders error:", clearError);
      setError(
        clearError instanceof Error
          ? clearError.message
          : "Unable to clear all orders."
      );
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="admin-order-clear-control">
      <button
        type="button"
        className="admin-order-clear-button"
        onClick={() => {
          setError("");
          setConfirming(true);
        }}
        disabled={clearing || (orderCount === 0 && uploadCount === 0)}
      >
        Clear all orders
      </button>
      {confirming && (
        <div className="admin-order-clear-confirmation" role="group" aria-label="Confirm clear all orders">
          <p>
            This permanently deletes {orderCount} orders and {uploadCount} customer
            uploads. Type <strong>DELETE ALL</strong> to continue.
          </p>
          <input
            aria-label="Type DELETE ALL to confirm"
            value={confirmationText}
            onChange={(event) => setConfirmationText(event.target.value)}
            autoComplete="off"
            disabled={clearing}
          />
          <div>
            <button
              type="button"
              className="admin-order-clear-cancel"
              onClick={() => {
                setConfirming(false);
                setConfirmationText("");
                setError("");
              }}
              disabled={clearing}
            >
              Cancel
            </button>
            <button
              type="button"
              className="admin-order-clear-button"
              onClick={clearOrders}
              disabled={clearing || confirmationText !== "DELETE ALL"}
            >
              {clearing ? "Clearing..." : "Permanently clear all"}
            </button>
          </div>
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
