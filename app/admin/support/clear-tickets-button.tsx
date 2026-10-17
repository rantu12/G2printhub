"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ClearSupportTicketsButton({
  ticketCount,
}: {
  ticketCount: number;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState("");

  async function clearTickets() {
    if (confirmation !== "DELETE ALL") return;

    setClearing(true);
    setError("");
    try {
      const response = await fetch("/api/admin/support", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to clear support tickets.");
      }

      setConfirming(false);
      setConfirmation("");
      router.refresh();
    } catch (clearError) {
      console.error("Clear support tickets error:", clearError);
      setError(
        clearError instanceof Error
          ? clearError.message
          : "Unable to clear support tickets."
      );
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="admin-support-clear-control">
      <button
        type="button"
        className="admin-support-clear-button"
        onClick={() => {
          setError("");
          setConfirmation("");
          setConfirming(true);
        }}
        disabled={clearing || ticketCount === 0}
      >
        Clear tickets
      </button>
      {confirming && (
        <div className="admin-support-clear-backdrop">
          <div
            className="admin-support-clear-confirmation"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-support-clear-title"
          >
            <p>
              <strong id="admin-support-clear-title">
                Clear all support tickets?
              </strong>
              <br />
              Permanently delete all {ticketCount} tickets and their replies.
              Type <strong>DELETE ALL</strong> to continue.
            </p>
            <input
              aria-label="Type DELETE ALL to confirm"
              autoComplete="off"
              disabled={clearing}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
            {error && (
              <p className="admin-support-clear-error" role="alert">
                {error}
              </p>
            )}
            <div>
              <button
                type="button"
                className="admin-support-clear-cancel"
                onClick={() => {
                  setConfirming(false);
                  setConfirmation("");
                  setError("");
                }}
                disabled={clearing}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-support-clear-button"
                onClick={() => void clearTickets()}
                disabled={clearing || confirmation !== "DELETE ALL"}
              >
                {clearing ? "Clearing..." : "Permanently clear"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
