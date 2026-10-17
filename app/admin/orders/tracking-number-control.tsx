"use client";

import { useState } from "react";
import { courierPartnerNames } from "@/lib/courier-partners";

export default function TrackingNumberControl({
  orderId,
  initialTrackingNumber,
  initialCourierPartnerName,
}: {
  orderId: string;
  initialTrackingNumber: string | null;
  initialCourierPartnerName: string | null;
}) {
  const [trackingNumber, setTrackingNumber] = useState(
    initialTrackingNumber ?? ""
  );
  const [courierPartnerName, setCourierPartnerName] = useState(
    initialCourierPartnerName ?? ""
  );
  const [savedTrackingNumber, setSavedTrackingNumber] = useState(
    initialTrackingNumber ?? ""
  );
  const [savedCourierPartnerName, setSavedCourierPartnerName] = useState(
    initialCourierPartnerName ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function saveShippingDetails() {
    try {
      setSaving(true);
      setMessage("");
      setError(false);

      const response = await fetch(
        `/api/admin/orders/${encodeURIComponent(orderId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackingNumber, courierPartnerName }),
        }
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to save shipping details.");
      }

      const savedTracking = data.order.trackingNumber ?? "";
      const savedCourier = data.order.courierPartnerName ?? "";
      setTrackingNumber(savedTracking);
      setCourierPartnerName(savedCourier);
      setSavedTrackingNumber(savedTracking);
      setSavedCourierPartnerName(savedCourier);
      setMessage("Shipping details saved.");
    } catch (saveError) {
      console.error("Save shipping details error:", saveError);
      setError(true);
      setMessage(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save shipping details."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-order-tracking-control">
      <label htmlFor={`courier-${orderId}`}>Courier partner name</label>
      <select
        id={`courier-${orderId}`}
        value={courierPartnerName}
        onChange={(event) => {
          setCourierPartnerName(event.target.value);
          setMessage("");
        }}
        disabled={saving}
      >
        <option value="">Select courier partner</option>
        {courierPartnerNames.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <label htmlFor={`tracking-${orderId}`}>Tracking number</label>
      <input
        id={`tracking-${orderId}`}
        value={trackingNumber}
        maxLength={100}
        onChange={(event) => {
          setTrackingNumber(event.target.value);
          setMessage("");
        }}
        placeholder="Enter tracking number"
        disabled={saving}
      />
      <button
        type="button"
        onClick={saveShippingDetails}
        disabled={
          saving ||
          (trackingNumber === savedTrackingNumber &&
            courierPartnerName === savedCourierPartnerName)
        }
      >
        {saving ? "Saving..." : "Save"}
      </button>
      {message && (
        <small
          className={
            error ? "tracking-message-error" : "tracking-message-success"
          }
          role={error ? "alert" : "status"}
        >
          {message}
        </small>
      )}
    </div>
  );
}