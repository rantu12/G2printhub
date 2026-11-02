"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

type StoreSettingsForm = {
  siteName: string;
  siteLogo: string;
  siteFavicon: string;
  storeAddress: string;
  supportEmail: string;
  supportPhone: string;
  whatsappNumber: string;
  currency: "INR";
  timeZone: string;
  defaultOrderStatus: "PENDING" | "ACCEPTED";
  websiteUrl: string;
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  passwordLoginEnabled: boolean;
  googleSignInEnabled: boolean;
  emailVerificationRequired: boolean | null;
};

const defaultSettings: StoreSettingsForm = {
  siteName: "G2 PrintHub",
  siteLogo: "",
  siteFavicon: "",
  storeAddress: "",
  supportEmail: "",
  supportPhone: "",
  whatsappNumber: "",
  currency: "INR",
  timeZone: "Asia/Kolkata",
  defaultOrderStatus: "PENDING",
  websiteUrl: "",
  maintenanceMode: false,
  registrationEnabled: true,
  passwordLoginEnabled: true,
  googleSignInEnabled: true,
  emailVerificationRequired: null,
};

type SettingsResponse = {
  settings: StoreSettingsForm;
  emailConfigured: boolean;
  effectiveEmailVerificationRequired: boolean;
  forgotPasswordImplemented: false;
};

export default function StoreSettingsForm() {
  const [form, setForm] = useState<StoreSettingsForm>(defaultSettings);
  const [saved, setSaved] = useState<StoreSettingsForm>(defaultSettings);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [effectiveVerification, setEffectiveVerification] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedLogo, setSelectedLogo] = useState<File | null>(null);
  const [selectedFavicon, setSelectedFavicon] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const logoPreviewUrl = useRef("");
  const logoInput = useRef<HTMLInputElement>(null);
  const faviconInput = useRef<HTMLInputElement>(null);
  const dirty =
    JSON.stringify(form) !== JSON.stringify(saved) ||
    selectedLogo !== null ||
    selectedFavicon !== null;

  useEffect(() => {
    let active = true;
    fetch("/api/admin/settings/store", { cache: "no-store" })
      .then(async (response) => {
        const data: SettingsResponse & { success?: boolean; message?: string } =
          await response.json();
        if (!response.ok || !data.success || !data.settings) {
          throw new Error(data.message || "Unable to load store settings.");
        }
        if (!active) return;
        const loaded = { ...defaultSettings, ...data.settings };
        setForm(loaded);
        setSaved(loaded);
        setLogoPreview(loaded.siteLogo);
        setEmailConfigured(data.emailConfigured);
        setEffectiveVerification(data.effectiveEmailVerificationRequired);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load store settings."
          );
        }
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
      if (logoPreviewUrl.current) URL.revokeObjectURL(logoPreviewUrl.current);
    };
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function update<K extends keyof StoreSettingsForm>(
    key: K,
    value: StoreSettingsForm[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage("");
  }

  function cancel() {
    if (logoPreviewUrl.current) {
      URL.revokeObjectURL(logoPreviewUrl.current);
      logoPreviewUrl.current = "";
    }
    setSelectedLogo(null);
    setSelectedFavicon(null);
    setLogoPreview(saved.siteLogo);
    if (logoInput.current) logoInput.current.value = "";
    if (faviconInput.current) faviconInput.current.value = "";
    setForm(saved);
    setError("");
    setMessage("");
  }

  function chooseLogo(file: File | null) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPG, PNG, or WebP logo.");
      if (logoInput.current) logoInput.current.value = "";
      return;
    }
    if (file.size === 0 || file.size > 5 * 1024 * 1024) {
      setError("Logo must be between 1 byte and 5 MB.");
      if (logoInput.current) logoInput.current.value = "";
      return;
    }

    if (logoPreviewUrl.current) URL.revokeObjectURL(logoPreviewUrl.current);
    logoPreviewUrl.current = URL.createObjectURL(file);
    setSelectedLogo(file);
    setLogoPreview(logoPreviewUrl.current);
    setError("");
    setMessage("");
  }

  function chooseFavicon(file: File | null) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPG, PNG, or WebP favicon.");
      if (faviconInput.current) faviconInput.current.value = "";
      return;
    }
    if (file.size === 0 || file.size > 5 * 1024 * 1024) {
      setError("Favicon must be between 1 byte and 5 MB.");
      if (faviconInput.current) faviconInput.current.value = "";
      return;
    }

    setSelectedFavicon(file);
    setError("");
    setMessage("");
  }

  function removeLogo() {
    if (logoPreviewUrl.current) {
      URL.revokeObjectURL(logoPreviewUrl.current);
      logoPreviewUrl.current = "";
    }
    setSelectedLogo(null);
    setLogoPreview("");
    update("siteLogo", "");
    if (logoInput.current) logoInput.current.value = "";
  }

  function removeFavicon() {
    setSelectedFavicon(null);
    update("siteFavicon", "");
    if (faviconInput.current) faviconInput.current.value = "";
  }

  async function uploadIdentityImage(file: File, label: string) {
    const uploadData = new FormData();
    uploadData.append("image", file);
    const uploadResponse = await fetch(
      "/api/admin/settings/store/upload-image",
      { method: "POST", body: uploadData }
    );
    const uploaded: { success?: boolean; message?: string; image?: string } =
      await uploadResponse.json();
    if (!uploadResponse.ok || !uploaded.success || !uploaded.image) {
      throw new Error(uploaded.message || `Unable to upload the ${label}.`);
    }
    return uploaded.image;
  }

  async function saveIdentityField(
    field: "siteName" | "siteLogo" | "siteFavicon" | "whatsappNumber"
  ) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      let value: string;
      if (field === "siteLogo") {
        value = selectedLogo
          ? await uploadIdentityImage(selectedLogo, "site logo")
          : form.siteLogo;
      } else if (field === "siteFavicon") {
        value = selectedFavicon
          ? await uploadIdentityImage(selectedFavicon, "favicon")
          : form.siteFavicon;
      } else {
        value = form[field];
      }

      const response = await fetch("/api/admin/settings/store", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...saved, [field]: value }),
      });
      const data: SettingsResponse & {
        success?: boolean;
        message?: string;
      } = await response.json();
      if (!response.ok || !data.success || !data.settings) {
        throw new Error(data.message || `Unable to save ${field}.`);
      }

      const savedSettings = { ...defaultSettings, ...data.settings };
      setSaved(savedSettings);
      setForm((current) => ({ ...current, [field]: savedSettings[field] }));
      if (field === "siteLogo") {
        if (logoPreviewUrl.current) {
          URL.revokeObjectURL(logoPreviewUrl.current);
          logoPreviewUrl.current = "";
        }
        setSelectedLogo(null);
        setLogoPreview(savedSettings.siteLogo);
        if (logoInput.current) logoInput.current.value = "";
      }
      if (field === "siteFavicon") {
        setSelectedFavicon(null);
        if (faviconInput.current) faviconInput.current.value = "";
      }
      setMessage(data.message || "Setting saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : `Unable to save ${field}.`
      );
    } finally {
      setSaving(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      let siteLogo = form.siteLogo;
      let siteFavicon = form.siteFavicon;
      if (selectedLogo) {
        siteLogo = await uploadIdentityImage(selectedLogo, "site logo");
      }
      if (selectedFavicon) {
        siteFavicon = await uploadIdentityImage(selectedFavicon, "favicon");
      }

      const response = await fetch("/api/admin/settings/store", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, siteLogo, siteFavicon }),
      });
      const data: SettingsResponse & {
        success?: boolean;
        message?: string;
      } = await response.json();
      if (!response.ok || !data.success || !data.settings) {
        throw new Error(data.message || "Unable to save store settings.");
      }
      const savedSettings = { ...defaultSettings, ...data.settings };
      if (logoPreviewUrl.current) {
        URL.revokeObjectURL(logoPreviewUrl.current);
        logoPreviewUrl.current = "";
      }
      setSelectedLogo(null);
      setSelectedFavicon(null);
      if (logoInput.current) logoInput.current.value = "";
      if (faviconInput.current) faviconInput.current.value = "";
      setForm(savedSettings);
      setSaved(savedSettings);
      setLogoPreview(savedSettings.siteLogo);
      setEmailConfigured(data.emailConfigured);
      setEffectiveVerification(data.effectiveEmailVerificationRequired);
      setMessage(data.message || "Settings saved.");
    } catch (saveError) {
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
    <form className="admin-shipping-tax-card admin-store-settings" onSubmit={save}>
      <header>
        <span className="admin-coupon-form-eyebrow">STORE &amp; ACCESS</span>
        <h2>General and customer access</h2>
        <p>
          These settings are stored in the database. Login and registration
          policies are checked by the server on every authentication request.
        </p>
      </header>

      {error && <div className="admin-error-box" role="alert">{error}</div>}
      {message && <div className="admin-coupon-success" role="status">{message}</div>}
      {dirty && (
        <p className="admin-integration-warning" role="status">
          You have unsaved changes.
        </p>
      )}

      <section className="admin-integration-group" aria-labelledby="identity-settings-heading">
        <h3 id="identity-settings-heading">Site identity</h3>
        <div className="admin-settings-fields-grid">
          <div className="admin-coupon-field">
            <label htmlFor="admin-site-name">Website name</label>
            <input
              id="admin-site-name"
              value={form.siteName}
              maxLength={100}
              required
              onChange={(event) => update("siteName", event.target.value)}
              disabled={!loaded || saving}
            />
            <button
              type="button"
              className="admin-primary-button"
              onClick={() => saveIdentityField("siteName")}
              disabled={!loaded || saving || form.siteName === saved.siteName}
            >
              Save website name
            </button>
          </div>
          <div className="admin-coupon-field">
            <span>Upload logo image</span>
            <input
              ref={logoInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => chooseLogo(event.target.files?.[0] ?? null)}
              disabled={!loaded || saving}
              aria-label="Upload website logo"
            />
            <small>JPG, PNG, or WebP. Maximum size: 5 MB.</small>
            {logoPreview && (
              <span
                role="img"
                aria-label="Website logo preview"
                style={{
                  display: "block",
                  width: "12rem",
                  height: "4rem",
                  backgroundImage: `url("${logoPreview.replaceAll('"', "%22")}")`,
                  backgroundPosition: "left center",
                  backgroundSize: "contain",
                  backgroundRepeat: "no-repeat",
                  marginTop: ".5rem",
                }}
              />
            )}
            {(logoPreview || form.siteLogo) && (
              <button
                type="button"
                className="admin-secondary-button"
                onClick={removeLogo}
                disabled={!loaded || saving}
              >
                Remove logo
              </button>
            )}
            <button
              type="button"
              className="admin-primary-button"
              onClick={() => saveIdentityField("siteLogo")}
              disabled={
                !loaded ||
                saving ||
                (!selectedLogo && form.siteLogo === saved.siteLogo)
              }
            >
              Save logo
            </button>
          </div>
          <div className="admin-coupon-field">
            <span>Upload favicon</span>
            <input
              ref={faviconInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) =>
                chooseFavicon(event.target.files?.[0] ?? null)
              }
              disabled={!loaded || saving}
              aria-label="Upload favicon"
            />
            <small>JPG, PNG, or WebP. Maximum size: 5 MB.</small>
            {(selectedFavicon || form.siteFavicon) && (
              <button
                type="button"
                className="admin-secondary-button"
                onClick={removeFavicon}
                disabled={!loaded || saving}
              >
                Remove favicon
              </button>
            )}
            <button
              type="button"
              className="admin-primary-button"
              onClick={() => saveIdentityField("siteFavicon")}
              disabled={
                !loaded ||
                saving ||
                (!selectedFavicon && form.siteFavicon === saved.siteFavicon)
              }
            >
              Save favicon
            </button>
          </div>
          <div className="admin-coupon-field">
            <label htmlFor="admin-whatsapp-number">WhatsApp chat number</label>
            <input
              id="admin-whatsapp-number"
              type="tel"
              value={form.whatsappNumber}
              maxLength={30}
              placeholder="+91 98765 43210"
              onChange={(event) => update("whatsappNumber", event.target.value)}
              disabled={!loaded || saving}
            />
            <small>
              Include the country code. Leave blank to hide the floating WhatsApp button.
            </small>
            <button
              type="button"
              className="admin-primary-button"
              onClick={() => saveIdentityField("whatsappNumber")}
              disabled={
                !loaded || saving || form.whatsappNumber === saved.whatsappNumber
              }
            >
              Save WhatsApp number
            </button>
          </div>
          <label className="admin-coupon-field">
            <span>Website URL</span>
            <input
              type="url"
              value={form.websiteUrl}
              maxLength={2048}
              placeholder="https://shop.example.com"
              onChange={(event) => update("websiteUrl", event.target.value)}
              disabled={!loaded || saving}
            />
            <small>
              Used for Google OAuth and payment/email redirects. Leave blank to
              use the server APP_URL setting.
            </small>
          </label>
          <label className="admin-coupon-field">
            <span>Time zone</span>
            <select
              value={form.timeZone}
              onChange={(event) => update("timeZone", event.target.value)}
              disabled={!loaded || saving}
            >
              <option value="Asia/Kolkata">Asia/Kolkata</option>
              <option value="UTC">UTC</option>
              <option value="America/New_York">America/New_York</option>
              <option value="Europe/London">Europe/London</option>
              <option value="Asia/Singapore">Asia/Singapore</option>
            </select>
          </label>
          <label className="admin-coupon-field">
            <span>Store currency</span>
            <select value={form.currency} disabled>
              <option value="INR">INR — Indian Rupee</option>
            </select>
            <small>Only INR is supported by current pricing and Cashfree checkout.</small>
          </label>
        </div>
      </section>

      <section className="admin-integration-group" aria-labelledby="maintenance-settings-heading">
        <h3 id="maintenance-settings-heading">Maintenance mode</h3>
        <p>
          Customers will see a maintenance notice instead of the storefront.
          Administrator pages and administrator sign-in remain available.
        </p>
        <label className="admin-settings-toggle">
          <span>Enable storefront maintenance mode</span>
          <input
            type="checkbox"
            checked={form.maintenanceMode}
            onChange={(event) => {
              if (
                event.target.checked &&
                !window.confirm(
                  "Enable maintenance mode? Customers will no longer be able to browse or place orders."
                )
              ) {
                return;
              }
              update("maintenanceMode", event.target.checked);
            }}
            disabled={!loaded || saving}
          />
        </label>
      </section>

      <section className="admin-integration-group" aria-labelledby="auth-policy-heading">
        <h3 id="auth-policy-heading">Customer login and registration</h3>
        {(
          [
            ["registrationEnabled", "Customer registration"],
            ["passwordLoginEnabled", "Customer email/password login"],
            ["googleSignInEnabled", "Google Sign-In"],
          ] as const
        ).map(([key, label]) => (
          <label className="admin-settings-toggle" key={key}>
            <span>{label}</span>
            <input
              type="checkbox"
              checked={form[key]}
              onChange={(event) => update(key, event.target.checked)}
              disabled={!loaded || saving}
            />
          </label>
        ))}
        <label className="admin-coupon-field">
          <span>Email verification requirement</span>
          <select
            value={
              form.emailVerificationRequired === null
                ? "automatic"
                : form.emailVerificationRequired
                  ? "required"
                  : "optional"
            }
            onChange={(event) =>
              update(
                "emailVerificationRequired",
                event.target.value === "automatic"
                  ? null
                  : event.target.value === "required"
              )
            }
            disabled={!loaded || saving}
          >
            <option value="automatic">Automatic (require when email delivery is configured)</option>
            <option value="required">Required</option>
            <option value="optional">Optional</option>
          </select>
          <small>
            Email delivery is {emailConfigured ? "configured" : "not configured"}.
            Effective verification is {effectiveVerification ? "required" : "not required"}.
          </small>
        </label>
        <p className="admin-integration-summary">
          Forgot-password recovery is not implemented in this project and is
          unavailable; no inactive toggle is presented.
        </p>
      </section>

      <div className="admin-settings-actions">
        <button type="submit" className="admin-primary-button" disabled={!loaded || saving || !dirty}>
          {!loaded ? "Loading settings…" : saving ? "Saving…" : "Save changes"}
        </button>
        <button type="button" className="admin-secondary-button" onClick={cancel} disabled={!loaded || saving || !dirty}>
          Cancel
        </button>
        <button
          type="button"
          className="admin-secondary-button"
          onClick={() => {
            if (window.confirm("Reset the site and access settings to defaults? Save to apply the reset.")) {
              setForm(defaultSettings);
              setMessage("");
              setError("");
            }
          }}
          disabled={!loaded || saving}
        >
          Reset to defaults
        </button>
      </div>
    </form>
  );
}
