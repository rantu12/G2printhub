"use client";

import { useEffect, useState, type FormEvent } from "react";

type SettingsForm = {
  shippingFee: string;
  taxRate: string;
  codEnabled: boolean;
  codMinimumAmount: string;
  codMaximumAmount: string;
  codFee: string;
  cashfreeEnabled: boolean;
};

const defaultSettings: SettingsForm = {
  shippingFee: "0.00",
  taxRate: "0.00",
  codEnabled: true,
  codMinimumAmount: "0.00",
  codMaximumAmount: "",
  codFee: "0.00",
  cashfreeEnabled: false,
};

export default function ShippingTaxSettingsForm() {
  const [form, setForm] = useState<SettingsForm>(defaultSettings);
  const [saved, setSaved] = useState<SettingsForm>(defaultSettings);
  const [cashfreeConfigured, setCashfreeConfigured] = useState(false);
  const [cashfreeMode, setCashfreeMode] = useState("sandbox");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const shippingFee = Number(form.shippingFee) || 0;
  const taxRate = Number(form.taxRate) || 0;
  const sampleSubtotal = 1500;
  const sampleCodFee = form.codEnabled ? Number(form.codFee) || 0 : 0;
  const taxableAmount = sampleSubtotal + shippingFee + sampleCodFee;
  const sampleTax = (taxableAmount * taxRate) / 100;
  const sampleTotal = taxableAmount + sampleTax;
  const formatCurrency = (amount: number) =>
    `₹${amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/settings/shipping-tax", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || "Unable to load store settings.");
        }
        if (active) {
          setCashfreeConfigured(data.settings.cashfreeConfigured === true);
          setCashfreeMode(
            data.settings.cashfreeMode === "production" ? "production" : "sandbox"
          );
          setForm({
            shippingFee: String(data.settings.shippingFee),
            taxRate: String(data.settings.taxRate),
            codEnabled: data.settings.codEnabled === true,
            codMinimumAmount: String(data.settings.codMinimumAmount ?? "0.00"),
            codMaximumAmount: String(data.settings.codMaximumAmount ?? ""),
            codFee: String(data.settings.codFee ?? "0.00"),
            cashfreeEnabled: data.settings.cashfreeEnabled === true,
          });
          setSaved({
            shippingFee: String(data.settings.shippingFee),
            taxRate: String(data.settings.taxRate),
            codEnabled: data.settings.codEnabled === true,
            codMinimumAmount: String(data.settings.codMinimumAmount ?? "0.00"),
            codMaximumAmount: String(data.settings.codMaximumAmount ?? ""),
            codFee: String(data.settings.codFee ?? "0.00"),
            cashfreeEnabled: data.settings.cashfreeEnabled === true,
          });
        }
      })
      .catch((loadError: unknown) => {
        console.error("Load shipping and tax settings error:", loadError);
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load store settings."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      form.cashfreeEnabled &&
      cashfreeMode === "production" &&
      !window.confirm(
        "Enable LIVE Cashfree payments? Customers may be charged real money. Confirm only when live credentials have been verified."
      )
    ) {
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/settings/shipping-tax", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          confirmProduction:
            form.cashfreeEnabled && cashfreeMode === "production",
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to save store settings.");
      }
      setForm({
        shippingFee: String(data.settings.shippingFee),
        taxRate: String(data.settings.taxRate),
        codEnabled: data.settings.codEnabled === true,
        codMinimumAmount: String(data.settings.codMinimumAmount ?? "0.00"),
        codMaximumAmount: String(data.settings.codMaximumAmount ?? ""),
        codFee: String(data.settings.codFee ?? "0.00"),
        cashfreeEnabled: data.settings.cashfreeEnabled === true,
      });
      setSaved({
        shippingFee: String(data.settings.shippingFee),
        taxRate: String(data.settings.taxRate),
        codEnabled: data.settings.codEnabled === true,
        codMinimumAmount: String(data.settings.codMinimumAmount ?? "0.00"),
        codMaximumAmount: String(data.settings.codMaximumAmount ?? ""),
        codFee: String(data.settings.codFee ?? "0.00"),
        cashfreeEnabled: data.settings.cashfreeEnabled === true,
      });
      setCashfreeConfigured(data.settings.cashfreeConfigured === true);
      setCashfreeMode(
        data.settings.cashfreeMode === "production" ? "production" : "sandbox"
      );
      setMessage(data.message);
    } catch (saveError) {
      console.error("Save shipping and tax settings error:", saveError);
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save store settings."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-settings-layout">
      <section className="admin-shipping-tax-card">
        <header>
          <span className="admin-coupon-form-eyebrow">CHECKOUT PRICING</span>
          <h2>Shipping and tax</h2>
          <p>
            These store-wide amounts are shown at checkout and calculated again
            when an order is placed.
          </p>
        </header>

        {error && <div className="admin-error-box" role="alert">{error}</div>}
        {dirty && <p className="admin-integration-warning" role="status">You have unsaved changes.</p>}
        {message && (
          <div className="admin-coupon-success" role="status">
            {message}
          </div>
        )}

        <form onSubmit={saveSettings}>
          <label className="admin-coupon-field">
            <span>Flat shipping fee (₹)</span>
            <input
              type="number"
              min="0"
              max="1000000"
              step="0.01"
              value={form.shippingFee}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  shippingFee: event.target.value,
                }))
              }
              required
              disabled={loading || saving}
            />
            <small>Charged once per order, regardless of item quantity.</small>
          </label>

          <div style={{ display: "grid", gap: "1rem" }}>
            <label className="admin-coupon-field">
              <span>Cash on Delivery</span>
              <select
                value={form.codEnabled ? "enabled" : "disabled"}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    codEnabled: event.target.value === "enabled",
                  }))
                }
                disabled={loading || saving || !dirty}
              >
                <option value="enabled">Enabled</option>
                <option value="disabled">Disabled</option>
              </select>
              <small>When disabled, customers cannot place COD orders.</small>
            </label>
            <label className="admin-coupon-field">
              <span>COD minimum order amount (₹)</span>
              <input
                type="number"
                min="0"
                max="1000000"
                step="0.01"
                value={form.codMinimumAmount}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    codMinimumAmount: event.target.value,
                  }))
                }
                required
                disabled={loading || saving}
              />
              <small>Checked against the server-calculated final order total, including the COD fee.</small>
            </label>
            <label className="admin-coupon-field">
              <span>COD maximum order amount (₹)</span>
              <input
                type="number"
                min="0"
                max="1000000"
                step="0.01"
                value={form.codMaximumAmount}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    codMaximumAmount: event.target.value,
                  }))
                }
                disabled={loading || saving}
              />
              <small>Leave blank for no maximum.</small>
            </label>
            <label className="admin-coupon-field">
              <span>COD fee (₹)</span>
              <input
                type="number"
                min="0"
                max="1000000"
                step="0.01"
                value={form.codFee}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    codFee: event.target.value,
                  }))
                }
                required
                disabled={loading || saving}
              />
              <small>Added to shipping and included in server-calculated order totals.</small>
            </label>

            <label className="admin-coupon-field">
              <span>Cashfree Payments</span>
              <select
                value={form.cashfreeEnabled ? "enabled" : "disabled"}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    cashfreeEnabled: event.target.value === "enabled",
                  }))
                }
                disabled={loading || saving}
              >
                <option value="enabled">Enabled</option>
                <option value="disabled">Disabled</option>
              </select>
              <small>
                {cashfreeConfigured
                  ? `Server credentials are configured for ${cashfreeMode}.`
                  : "Add Cashfree credentials in Integration settings or the server environment before customers can pay online."}
              </small>
            </label>
          </div>

          <label className="admin-coupon-field">
            <span>Tax rate (%)</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.taxRate}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  taxRate: event.target.value,
                }))
              }
              required
              disabled={loading || saving}
            />
            <small>
              Tax is calculated on the discounted item subtotal plus shipping.
            </small>
          </label>

          <button
            className="admin-primary-button"
            type="submit"
            disabled={loading || saving || !dirty}
          >
            {loading ? "Loading settings..." : saving ? "Saving..." : "Save settings"}
          </button>
          <button
            type="button"
            className="admin-secondary-button"
            onClick={() => {
              setForm(saved);
              setError("");
              setMessage("");
            }}
            disabled={loading || saving || !dirty}
          >
            Cancel
          </button>
          <button
            type="button"
            className="admin-secondary-button"
            onClick={() => {
              if (window.confirm("Reset checkout pricing and COD settings to defaults? Save to apply.")) {
                setForm(defaultSettings);
                setError("");
                setMessage("");
              }
            }}
            disabled={loading || saving}
          >
            Reset to defaults
          </button>
        </form>
      </section>

      <aside className="admin-settings-checkout-preview" aria-label="Checkout total preview">
        <div className="admin-settings-preview-heading">
          <div>
            <span className="admin-coupon-form-eyebrow">SEE THE IMPACT</span>
            <h2>Checkout preview</h2>
          </div>
          <span className="admin-settings-live-badge">
            <span aria-hidden="true" />
            {loading ? "Loading" : "Live"}
          </span>
        </div>

        <p className="admin-settings-preview-caption">
          A sample order updates as you edit your rates.
        </p>

        <div className="admin-settings-sample-order">
          <div className="admin-settings-sample-order-icon" aria-hidden="true">
            P
          </div>
          <div>
            <strong>Sample order</strong>
            <span>Discounted items subtotal</span>
          </div>
          <strong>{formatCurrency(sampleSubtotal)}</strong>
        </div>

        <div className="admin-settings-breakdown">
          <div>
            <span>Items subtotal</span>
            <span>{formatCurrency(sampleSubtotal)}</span>
          </div>
          <div>
            <span>Shipping</span>
            <span>{formatCurrency(shippingFee)}</span>
          </div>
          {sampleCodFee > 0 && (
            <div>
              <span>Cash on Delivery fee</span>
              <span>{formatCurrency(sampleCodFee)}</span>
            </div>
          )}
          <div>
            <span>
              Tax <small>({taxRate.toFixed(2)}%)</small>
            </span>
            <span>{formatCurrency(sampleTax)}</span>
          </div>
        </div>

        <div className="admin-settings-total">
          <span>Estimated customer total</span>
          <strong>{formatCurrency(sampleTotal)}</strong>
        </div>

        <p className="admin-settings-preview-note">
          Tax applies to the discounted items subtotal plus shipping. This
          example is illustrative; actual totals use each customer&apos;s order.
        </p>
      </aside>
    </div>
  );
}
