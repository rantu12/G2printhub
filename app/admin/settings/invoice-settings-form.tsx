"use client";

import { useEffect, useState, type FormEvent } from "react";

type InvoiceSettings = {
  invoiceTitle: string;
  invoiceTagline: string;
  invoiceSellerName: string;
  invoiceGstin: string;
  invoicePan: string;
  invoiceAddress: string;
  invoiceContact: string;
  invoiceReturnPolicy: string;
};

const defaultSettings: InvoiceSettings = {
  invoiceTitle: "Tax Invoice",
  invoiceTagline: "",
  invoiceSellerName: "Sam Digine",
  invoiceGstin: "",
  invoicePan: "",
  invoiceAddress: "",
  invoiceContact: "",
  invoiceReturnPolicy: "",
};

export default function InvoiceSettingsForm() {
  const [form, setForm] = useState(defaultSettings);
  const [saved, setSaved] = useState(defaultSettings);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/settings/invoice", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success || !data.settings) {
          throw new Error(data.message || "Unable to load invoice settings.");
        }
        if (!active) return;
        const settings = { ...defaultSettings, ...data.settings };
        setForm(settings);
        setSaved(settings);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load invoice settings."
          );
        }
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function update<K extends keyof InvoiceSettings>(
    key: K,
    value: InvoiceSettings[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/settings/invoice", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.settings) {
        throw new Error(data.message || "Unable to save invoice settings.");
      }
      const settings = { ...defaultSettings, ...data.settings };
      setForm(settings);
      setSaved(settings);
      setMessage(data.message || "Invoice settings saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save invoice settings."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="admin-shipping-tax-card admin-store-settings" onSubmit={save}>
      <header>
        <span className="admin-coupon-form-eyebrow">CUSTOMER DOCUMENTS</span>
        <h2>Invoice details</h2>
        <p>
          These details appear on invoices customers can access after payment
          or delivery. Leave registration fields blank if they do not apply.
        </p>
      </header>

      {error && <div className="admin-error-box" role="alert">{error}</div>}
      {message && <div className="admin-coupon-success" role="status">{message}</div>}
      {dirty && (
        <p className="admin-integration-warning" role="status">
          You have unsaved invoice changes.
        </p>
      )}

      <section className="admin-integration-group" aria-labelledby="invoice-settings-heading">
        <h3 id="invoice-settings-heading">Invoice layout and seller details</h3>
        <div className="admin-settings-fields-grid">
          <label className="admin-coupon-field">
            <span>Invoice title</span>
            <input
              value={form.invoiceTitle}
              maxLength={50}
              onChange={(event) => update("invoiceTitle", event.target.value)}
              disabled={!loaded || saving}
            />
          </label>
          <label className="admin-coupon-field">
            <span>Seller name (blank uses website name)</span>
            <input
              value={form.invoiceSellerName}
              maxLength={160}
              onChange={(event) => update("invoiceSellerName", event.target.value)}
              disabled={!loaded || saving}
            />
          </label>
          <label className="admin-coupon-field">
            <span>Invoice tagline</span>
            <input
              value={form.invoiceTagline}
              maxLength={160}
              onChange={(event) => update("invoiceTagline", event.target.value)}
              disabled={!loaded || saving}
            />
          </label>
          <label className="admin-coupon-field">
            <span>GSTIN</span>
            <input
              value={form.invoiceGstin}
              maxLength={30}
              onChange={(event) => update("invoiceGstin", event.target.value)}
              disabled={!loaded || saving}
            />
          </label>
          <label className="admin-coupon-field">
            <span>PAN</span>
            <input
              value={form.invoicePan}
              maxLength={20}
              onChange={(event) => update("invoicePan", event.target.value)}
              disabled={!loaded || saving}
            />
          </label>
          <label className="admin-coupon-field">
            <span>Seller / ship-from address</span>
            <textarea
              value={form.invoiceAddress}
              maxLength={600}
              rows={3}
              onChange={(event) => update("invoiceAddress", event.target.value)}
              disabled={!loaded || saving}
            />
          </label>
          <label className="admin-coupon-field">
            <span>Invoice contact details</span>
            <input
              value={form.invoiceContact}
              maxLength={160}
              onChange={(event) => update("invoiceContact", event.target.value)}
              disabled={!loaded || saving}
            />
          </label>
          <label className="admin-coupon-field">
            <span>Returns policy / invoice footer</span>
            <textarea
              value={form.invoiceReturnPolicy}
              maxLength={2000}
              rows={5}
              onChange={(event) =>
                update("invoiceReturnPolicy", event.target.value)
              }
              disabled={!loaded || saving}
            />
          </label>
        </div>
      </section>

      <div className="admin-settings-actions">
        <button
          type="submit"
          className="admin-primary-button"
          disabled={!loaded || saving || !dirty}
        >
          {!loaded ? "Loading settings…" : saving ? "Saving…" : "Save invoice settings"}
        </button>
        <button
          type="button"
          className="admin-secondary-button"
          onClick={() => {
            setForm(saved);
            setError("");
            setMessage("");
          }}
          disabled={!loaded || saving || !dirty}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
