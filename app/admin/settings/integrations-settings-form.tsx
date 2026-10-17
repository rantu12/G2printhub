"use client";

import { useEffect, useState, type FormEvent } from "react";

const credentialFields = [
  {
    key: "GOOGLE_CLIENT_ID",
    label: "Google OAuth client ID",
    kind: "text",
    group: "Google sign-in",
  },
  {
    key: "GOOGLE_CLIENT_SECRET",
    label: "Google OAuth client secret",
    kind: "secret",
    group: "Google sign-in",
  },
  {
    key: "RESEND_API_KEY",
    label: "Resend API key",
    kind: "secret",
    group: "Email delivery",
  },
  {
    key: "EMAIL_FROM",
    label: "Sender address",
    kind: "text",
    group: "Email delivery",
  },
  {
    key: "CASHFREE_CLIENT_ID",
    label: "Cashfree client ID",
    kind: "text",
    group: "Cashfree Payments",
  },
  {
    key: "CASHFREE_CLIENT_SECRET",
    label: "Cashfree client secret",
    kind: "secret",
    group: "Cashfree Payments",
  },
  {
    key: "CASHFREE_ENVIRONMENT",
    label: "Cashfree environment",
    kind: "environment",
    group: "Cashfree Payments",
  },
] as const;

type FieldKey = (typeof credentialFields)[number]["key"];
type FieldStatus = {
  hasOverride: boolean;
  configured: boolean;
  source: "admin" | "environment" | "missing";
};
type SettingsResponse = {
  fields: Record<FieldKey, FieldStatus>;
  integrations: {
    google: { configured: boolean; enabled: boolean };
    resend: { configured: boolean };
    cashfree: {
      configured: boolean;
      enabled: boolean;
      mode: "sandbox" | "production";
    };
  };
  unsupported: {
    smtp: "not_implemented";
    sms: "not_implemented";
    shipping: "not_implemented";
  };
};

const emptyValues = (): Partial<Record<FieldKey, string>> => ({});

export default function IntegrationsSettingsForm() {
  const [values, setValues] = useState<Partial<Record<FieldKey, string>>>(
    emptyValues
  );
  const [cleared, setCleared] = useState<FieldKey[]>([]);
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const dirty =
    Object.values(values).some((value) => Boolean(value?.trim())) ||
    cleared.length > 0;

  useEffect(() => {
    let active = true;
    fetch("/api/admin/settings/integrations", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Unable to load integration settings."
          );
        }
        if (active) setSettings(data as SettingsResponse);
      })
      .catch((loadError: unknown) => {
        console.error("Load integration settings error:", loadError);
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load integration settings."
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

  function updateValue(key: FieldKey, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setCleared((current) => current.filter((item) => item !== key));
  }

  function toggleClear(key: FieldKey, shouldClear: boolean) {
    setCleared((current) =>
      shouldClear
        ? [...current.filter((item) => item !== key), key]
        : current.filter((item) => item !== key)
    );
    if (shouldClear) {
      setValues((current) => ({ ...current, [key]: "" }));
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedCashfreeMode =
      values.CASHFREE_ENVIRONMENT ??
      settings?.integrations.cashfree.mode ??
      "sandbox";
    if (
      selectedCashfreeMode === "production" &&
      !window.confirm(
        "You are saving LIVE Cashfree settings. Real payments may be processed. Confirm only after verifying the live credentials."
      )
    ) {
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const submittedValues = Object.fromEntries(
        Object.entries(values).filter(
          ([key, value]) =>
            value?.trim() &&
            !cleared.includes(key as FieldKey)
        )
      );
      const response = await fetch("/api/admin/settings/integrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          values: submittedValues,
          clearKeys: cleared,
          confirmProduction: selectedCashfreeMode === "production",
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to save integration settings.");
      }
      setSettings(data as SettingsResponse);
      setValues(emptyValues());
      setCleared([]);
      setMessage(data.message);
    } catch (saveError) {
      console.error("Save integration settings error:", saveError);
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save integration settings."
      );
    } finally {
      setSaving(false);
    }
  }

  function fieldStatus(key: FieldKey) {
    const status = settings?.fields[key];
    if (!status) return "Status unavailable";
    if (status.hasOverride) return "Encrypted admin override active";
    if (status.source === "environment") return "Using server environment value";
    return "Not configured";
  }

  const groups = [...new Set(credentialFields.map((field) => field.group))];

  return (
    <form className="admin-integration-settings" onSubmit={save}>
      <div className="admin-shipping-tax-card">
        <header>
          <span className="admin-coupon-form-eyebrow">PRIVATE CREDENTIALS</span>
          <h2>Integration settings</h2>
          <p>
            Credentials saved here are encrypted in the database and never
            returned to this page. Leave a field blank to keep its current
            value. When no admin override exists, the app uses its server
            environment value.
          </p>
        </header>
        {error && (
          <div className="admin-error-box" role="alert">
            {error}
          </div>
        )}
        {message && (
          <div className="admin-coupon-success" role="status">
            {message}
          </div>
        )}
        {dirty && (
          <p className="admin-integration-warning" role="status">
            You have unsaved credential changes.
          </p>
        )}
        {groups.map((group) => (
          <section className="admin-integration-group" key={group}>
            <h3>{group}</h3>
            {credentialFields
              .filter((field) => field.group === group)
              .map((field) => {
                const status = settings?.fields[field.key];
                const shouldClear = cleared.includes(field.key);
                return (
                  <label className="admin-coupon-field" key={field.key}>
                    <span>{field.label}</span>
                    {field.kind === "environment" ? (
                      <select
                        value={values[field.key] ?? ""}
                        onChange={(event) =>
                          updateValue(field.key, event.target.value)
                        }
                        disabled={loading || saving || shouldClear}
                      >
                        <option value="">Keep current environment</option>
                        <option value="sandbox">Sandbox</option>
                        <option value="production">Production</option>
                      </select>
                    ) : (
                      <>
                        <input
                          type={
                            field.kind === "secret" &&
                            !revealedSecrets.includes(field.key)
                              ? "password"
                              : "text"
                          }
                          value={values[field.key] ?? ""}
                          onChange={(event) =>
                            updateValue(field.key, event.target.value)
                          }
                          placeholder={
                            status?.configured
                              ? "Leave blank to keep the current value"
                              : "Enter value"
                          }
                          autoComplete="new-password"
                          maxLength={4096}
                          disabled={loading || saving || shouldClear}
                        />
                        {field.kind === "secret" && (
                          <button
                            type="button"
                            className="admin-secondary-button"
                            onClick={() =>
                              setRevealedSecrets((current) =>
                                current.includes(field.key)
                                  ? current.filter((key) => key !== field.key)
                                  : [...current, field.key]
                              )
                            }
                            disabled={loading || saving || shouldClear}
                          >
                            {revealedSecrets.includes(field.key)
                              ? "Hide"
                              : "Show"}{" "}
                            {field.label}
                          </button>
                        )}
                      </>
                    )}
                    <small>{fieldStatus(field.key)}</small>
                    {status?.hasOverride && (
                      <span className="admin-integration-clear">
                        <input
                          type="checkbox"
                          checked={shouldClear}
                          onChange={(event) =>
                            toggleClear(field.key, event.target.checked)
                          }
                          disabled={loading || saving}
                        />
                        Remove encrypted override and fall back to .env
                      </span>
                    )}
                  </label>
                );
              })}
            {group === "Cashfree Payments" && settings && (
                  <>
                    <p className="admin-integration-summary" role="status">
                      Cashfree credentials are{" "}
                      {settings.integrations.cashfree.configured
                        ? `configured for ${settings.integrations.cashfree.mode}.`
                        : `missing or incompatible with the selected ${settings.integrations.cashfree.mode} environment.`}
                      {" "}Online Cashfree checkout is{" "}
                      {settings.integrations.cashfree.enabled ? "enabled" : "disabled"}.
                    </p>
                    <p className="admin-integration-summary">
                      Status checks configured values and the test/live App ID
                      prefix only; no provider connection test has been run.
                    </p>
                    {settings.integrations.cashfree.mode === "production" && (
                      <p className="admin-integration-warning">
                        Live payments are selected. Saving requires an explicit
                        confirmation; use verified live credentials only.
                      </p>
                    )}
                    <p className="admin-integration-summary">
                      Webhook endpoint: <code>/api/payments/cashfree/webhook</code>.
                      Register this URL in Cashfree; provider-side webhook setup
                      cannot be tested from this dashboard.
                    </p>
                  </>
                )}
            {group === "Google sign-in" && settings && (
              <p className="admin-integration-summary" role="status">
                Google sign-in is{" "}
                {settings.integrations.google.configured ? "configured" : "not configured"} and{" "}
                {settings.integrations.google.enabled ? "enabled." : "disabled."}
              </p>
            )}
            {group === "Email delivery" && settings && (
              <p className="admin-integration-summary" role="status">
                Email delivery is{" "}
                {settings.integrations.resend.configured
                  ? "configured."
                  : "not fully configured."}
              </p>
            )}
          </section>
        ))}
        <p className="admin-integration-warning">
          Set <code>INTEGRATION_SECRETS_KEY</code> to a secure 32-byte
          hexadecimal key in the server environment before saving credentials.
          Keep <code>DATABASE_URL</code> in the server environment; do not enter
          it here.
        </p>
        <section className="admin-integration-group">
          <h3>Other provider support</h3>
          <p className="admin-integration-summary">
            SMTP, SMS, and third-party shipping providers are not implemented
            in this application. Email notifications use the configured Resend
            integration; no credentials for unsupported services are accepted.
          </p>
          <p className="admin-integration-summary" role="status">
            SMTP: Not implemented · SMS: Not implemented · Shipping API: Not implemented
          </p>
        </section>
        <button
          type="submit"
          className="admin-primary-button"
          disabled={loading || saving}
        >
          {saving ? "Saving securely…" : "Save integration settings"}
        </button>
        <button
          type="button"
          className="admin-secondary-button"
          onClick={() => {
            setValues(emptyValues());
            setCleared([]);
            setError("");
            setMessage("");
          }}
          disabled={loading || saving || !dirty}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
