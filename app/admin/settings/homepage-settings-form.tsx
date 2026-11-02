"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

type HomepageSettings = {
  homepageEyebrow: string;
  homepageTitle: string;
  homepageDescription: string;
  homepageSaleEnabled: boolean;
  homepageOffer: string;
  homepageImage: string;
};

const defaultSettings: HomepageSettings = {
  homepageEyebrow: "THE PRINT SHOP",
  homepageTitle: "Find your next favourite print.",
  homepageDescription:
    "Custom cards, T-shirts, mugs and more. Explore our collection and make every print personal.",
  homepageSaleEnabled: true,
  homepageOffer: "",
  homepageImage: "",
};

export default function HomepageSettingsForm() {
  const [form, setForm] = useState(defaultSettings);
  const [previewImage, setPreviewImage] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const previewUrl = useRef("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/admin/settings/homepage", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || "Unable to load homepage settings.");
        }
        if (active) {
          setForm(data.settings);
          setPreviewImage(data.settings.homepageImage);
        }
      })
      .catch((loadError: unknown) => {
        console.error("Load homepage settings error:", loadError);
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load homepage settings."
          );
        }
      })
      .finally(() => {
        if (active) setLoaded(true);
      });

    return () => {
      active = false;
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    };
  }, []);

  function updateTextField(
    field: "homepageEyebrow" | "homepageTitle" | "homepageDescription" | "homepageOffer",
    value: string
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function clearSelectedImage() {
    if (previewUrl.current) {
      URL.revokeObjectURL(previewUrl.current);
      previewUrl.current = "";
    }
    setSelectedImage(null);
    setPreviewImage("");
    setForm((current) => ({ ...current, homepageImage: "" }));
    if (fileInput.current) fileInput.current.value = "";
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      let homepageImage = form.homepageImage;

      if (selectedImage) {
        const uploadData = new FormData();
        uploadData.append("image", selectedImage);
        const uploadResponse = await fetch(
          "/api/admin/settings/homepage/upload-image",
          { method: "POST", body: uploadData }
        );
        const uploaded = await uploadResponse.json();
        if (!uploadResponse.ok || !uploaded.success) {
          throw new Error(uploaded.message || "Unable to upload homepage image.");
        }
        homepageImage = uploaded.image;
      }

      const response = await fetch("/api/admin/settings/homepage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, homepageImage }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to save homepage settings.");
      }

      setForm(data.settings);
      setPreviewImage(data.settings.homepageImage);
      setSelectedImage(null);
      if (previewUrl.current) {
        URL.revokeObjectURL(previewUrl.current);
        previewUrl.current = "";
      }
      if (fileInput.current) fileInput.current.value = "";
      setMessage(data.message);
    } catch (saveError) {
      console.error("Save homepage settings error:", saveError);
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save homepage settings."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-shipping-tax-card admin-homepage-settings">
      <header>
        <span className="admin-coupon-form-eyebrow">STOREFRONT CONTENT</span>
        <h2>Homepage hero banner</h2>
        <p>
          Upload the banner image and control the heading, description, and
          optional sale or offer message customers see on the homepage.
        </p>
      </header>

      {error && <div className="admin-error-box" role="alert">{error}</div>}
      {message && (
        <div className="admin-coupon-success" role="status">{message}</div>
      )}

      <form onSubmit={saveSettings}>
        <label className="admin-coupon-field">
          <span>Small heading</span>
          <input
            value={form.homepageEyebrow}
            maxLength={60}
            onChange={(event) => updateTextField("homepageEyebrow", event.target.value)}
            disabled={!loaded || saving}
          />
          <small>Short label shown above the main heading.</small>
        </label>

        <label className="admin-coupon-field">
          <span>Main heading</span>
          <input
            value={form.homepageTitle}
            maxLength={120}
            onChange={(event) => updateTextField("homepageTitle", event.target.value)}
            required
            disabled={!loaded || saving}
          />
          <small>Maximum 120 characters.</small>
        </label>

        <label className="admin-coupon-field admin-homepage-wide-field">
          <span>Description</span>
          <textarea
            value={form.homepageDescription}
            maxLength={400}
            rows={3}
            onChange={(event) =>
              updateTextField("homepageDescription", event.target.value)
            }
            disabled={!loaded || saving}
          />
          <small>Supporting text below the heading.</small>
        </label>

        <label className="admin-coupon-field admin-homepage-wide-field">
          <span>Sale offer details (optional)</span>
          <input
            value={form.homepageOffer}
            maxLength={120}
            placeholder="Example: 20% OFF or Festive savings"
            onChange={(event) => updateTextField("homepageOffer", event.target.value)}
            disabled={!loaded || saving}
          />
          <small>
            Shown beside the red SALE badge when sales are enabled.
          </small>
        </label>

        <label className="admin-coupon-active-toggle admin-homepage-wide-field">
          <input
            type="checkbox"
            checked={form.homepageSaleEnabled}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                homepageSaleEnabled: event.target.checked,
              }))
            }
            disabled={!loaded || saving}
          />
          <span>
            <strong>{form.homepageSaleEnabled ? "Sale is ON" : "Sale is OFF"}</strong>
            <small>Show or hide the SALE badge and offer details on the homepage.</small>
          </span>
        </label>

        <label className="admin-coupon-field admin-homepage-wide-field">
          <span>Hero image</span>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              if (!file) return;

              if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
                setError("Choose a JPG, PNG, or WebP image.");
                event.target.value = "";
                return;
              }
              if (file.size > 5 * 1024 * 1024) {
                setError("Image must be 5 MB or smaller.");
                event.target.value = "";
                return;
              }

              if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
              previewUrl.current = URL.createObjectURL(file);
              setError("");
              setSelectedImage(file);
              setPreviewImage(previewUrl.current);
            }}
            disabled={!loaded || saving}
          />
          <small>
            JPG, PNG, or WebP. Maximum size: 5 MB.
            {selectedImage ? ` Selected: ${selectedImage.name}` : ""}
          </small>
          {previewImage && (
            <button
              type="button"
              className="admin-homepage-remove-image"
              onClick={clearSelectedImage}
              disabled={!loaded || saving}
            >
              Remove current image
            </button>
          )}
        </label>

        <div
          className="admin-homepage-preview admin-homepage-wide-field"
          style={{
            backgroundImage: previewImage
              ? `linear-gradient(90deg, rgb(15 23 42 / 94%), rgb(15 23 42 / 52%)), url("${previewImage}")`
              : undefined,
          }}
          aria-label="Homepage hero preview"
        >
          <div>
            {form.homepageSaleEnabled && form.homepageOffer && (
              <span className="shop-offer">
                <strong>SALE</strong>
                {form.homepageOffer.trim().toLowerCase() !== "sale" && (
                  <span>{form.homepageOffer}</span>
                )}
              </span>
            )}
            {form.homepageEyebrow && (
              <span className="shop-eyebrow">{form.homepageEyebrow}</span>
            )}
            <strong>{form.homepageTitle || "Your homepage heading"}</strong>
            {form.homepageDescription && <p>{form.homepageDescription}</p>}
          </div>
        </div>

        <button
          className="admin-primary-button admin-homepage-save"
          type="submit"
          disabled={!loaded || saving}
        >
          {!loaded ? "Loading settings..." : saving ? "Saving..." : "Save homepage banner"}
        </button>
      </form>
    </section>
  );
}
