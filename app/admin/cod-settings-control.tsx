"use client";

import { useEffect, useState, useTransition } from "react";

type CodSettingsControlProps = {
  initialCodEnabled?: boolean;
};

export default function CodSettingsControl({
  initialCodEnabled = true,
}: CodSettingsControlProps) {
  const [savedCodEnabled, setSavedCodEnabled] = useState(initialCodEnabled);
  const [selectedCodEnabled, setSelectedCodEnabled] = useState(initialCodEnabled);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [, startTransition] = useTransition();

  // Keep state synced with fresh data from server API on mount
  useEffect(() => {
    let active = true;
    fetch("/api/admin/settings/cod", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || "Failed to load COD setting.");
        }
        if (active && typeof data.codEnabled === "boolean") {
          setSavedCodEnabled(data.codEnabled);
          setSelectedCodEnabled(data.codEnabled);
        }
      })
      .catch((err: unknown) => {
        console.error("Fetch COD settings error:", err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const hasUnsavedChanges = selectedCodEnabled !== savedCodEnabled;

  async function handleSave() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/settings/cod", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codEnabled: selectedCodEnabled }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to update COD setting.");
      }

      const newStatus = Boolean(data.codEnabled);
      startTransition(() => {
        setSavedCodEnabled(newStatus);
        setSelectedCodEnabled(newStatus);
        setMessage(data.message || "Cash on Delivery setting updated successfully.");
      });
    } catch (err: unknown) {
      console.error("Save COD settings error:", err);
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred while saving."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-panel" style={{ marginBottom: "20px" }}>
      <div className="admin-panel-header">
        <div>
          <span className="admin-eyebrow">PAYMENT METHOD CONTROL</span>
          <h2>Cash on Delivery (COD) Settings</h2>
        </div>

        <div>
          {savedCodEnabled ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 12px",
                borderRadius: "9999px",
                fontSize: "12px",
                fontWeight: 700,
                backgroundColor: "#ecfdf5",
                color: "#047857",
                border: "1px solid #a7f3d0",
              }}
              title="COD is currently active for customers at checkout"
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: "#10b981",
                  display: "inline-block",
                }}
              />
              COD Enabled
            </span>
          ) : (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 12px",
                borderRadius: "9999px",
                fontSize: "12px",
                fontWeight: 700,
                backgroundColor: "#fef2f2",
                color: "#b91c1c",
                border: "1px solid #fecaca",
              }}
              title="COD is currently disabled at checkout"
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: "#ef4444",
                  display: "inline-block",
                }}
              />
              COD Disabled
            </span>
          )}
        </div>
      </div>

      <div style={{ padding: "20px 24px" }}>
        <p style={{ margin: "0 0 16px", color: "#4b5563", fontSize: "14px", lineHeight: "1.5" }}>
          Control whether customers can choose <strong>Cash on Delivery (COD)</strong> at checkout.
          When disabled, COD is hidden and customers must pay online using Cashfree.
          Existing COD orders in your store are preserved and remain fully manageable.
        </p>

        {error && (
          <div
            className="admin-error-box"
            role="alert"
            style={{ marginBottom: "16px" }}
          >
            {error}
          </div>
        )}

        {message && (
          <div
            className="admin-coupon-success"
            role="status"
            aria-live="polite"
            style={{ marginBottom: "16px" }}
          >
            ✓ {message}
          </div>
        )}

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            padding: "16px",
            backgroundColor: "#f9fafb",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "14px", fontWeight: 600, color: "#111827" }}>
              Cash on Delivery Toggle
            </span>
            <span style={{ fontSize: "13px", color: "#6b7280" }}>
              {selectedCodEnabled
                ? "Cash on Delivery will be available for customers at checkout."
                : "Cash on Delivery will be unavailable; online payment required."}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Toggle buttons group */}
            <div
              role="group"
              aria-label="Cash on Delivery ON/OFF toggle"
              style={{
                display: "inline-flex",
                backgroundColor: "#e5e7eb",
                borderRadius: "8px",
                padding: "3px",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setSelectedCodEnabled(true);
                  setMessage("");
                  setError("");
                }}
                disabled={loading || saving}
                style={{
                  padding: "6px 16px",
                  borderRadius: "6px",
                  border: "none",
                  fontSize: "13px",
                  fontWeight: selectedCodEnabled ? 700 : 500,
                  cursor: loading || saving ? "not-allowed" : "pointer",
                  transition: "all 0.15s ease",
                  backgroundColor: selectedCodEnabled ? "#10b981" : "transparent",
                  color: selectedCodEnabled ? "#ffffff" : "#4b5563",
                  boxShadow: selectedCodEnabled
                    ? "0 1px 3px rgba(0, 0, 0, 0.1)"
                    : "none",
                }}
              >
                ON
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedCodEnabled(false);
                  setMessage("");
                  setError("");
                }}
                disabled={loading || saving}
                style={{
                  padding: "6px 16px",
                  borderRadius: "6px",
                  border: "none",
                  fontSize: "13px",
                  fontWeight: !selectedCodEnabled ? 700 : 500,
                  cursor: loading || saving ? "not-allowed" : "pointer",
                  transition: "all 0.15s ease",
                  backgroundColor: !selectedCodEnabled ? "#ef4444" : "transparent",
                  color: !selectedCodEnabled ? "#ffffff" : "#4b5563",
                  boxShadow: !selectedCodEnabled
                    ? "0 1px 3px rgba(0, 0, 0, 0.1)"
                    : "none",
                }}
              >
                OFF
              </button>
            </div>

            {/* Save Changes button */}
            <button
              type="button"
              className="admin-primary-button"
              onClick={handleSave}
              disabled={loading || saving || !hasUnsavedChanges}
              style={{
                margin: 0,
                opacity: !hasUnsavedChanges && !saving ? 0.6 : 1,
                cursor: !hasUnsavedChanges || saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>
        </div>

        {hasUnsavedChanges && (
          <p
            style={{
              margin: "10px 0 0",
              fontSize: "13px",
              color: "#d97706",
              fontWeight: 500,
            }}
          >
            ⚠️ You have unsaved changes ({selectedCodEnabled ? "Enable" : "Disable"} COD). Click &ldquo;Save Changes&rdquo; to persist to PostgreSQL.
          </p>
        )}
      </div>
    </section>
  );
}
