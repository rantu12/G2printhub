"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import {
  INDIAN_STATES,
  INDIAN_STATES_AND_UNION_TERRITORIES,
  INDIAN_UNION_TERRITORIES,
} from "@/lib/india-states";

type Address = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  shippingAddress2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

const emptyAddress: Address = {
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  shippingAddress: "",
  shippingAddress2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "India",
};

export default function AddressForm({
  initialName,
  initialEmail,
}: {
  initialName: string;
  initialEmail: string;
}) {
  const [address, setAddress] = useState<Address>({
    ...emptyAddress,
    customerName: initialName,
    customerEmail: initialEmail,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savedAddress, setSavedAddress] = useState<Address | null>(null);
  const [editing, setEditing] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    async function loadAddress() {
      try {
        const response = await fetch("/api/account/delivery-information", {
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || "Unable to load your saved address.");
        }
        if (data.deliveryInformation) {
          const saved: Address = {
            ...emptyAddress,
            customerName: initialName,
            customerEmail: initialEmail,
            ...data.deliveryInformation,
            shippingAddress2: data.deliveryInformation.shippingAddress2 ?? "",
            state: data.deliveryInformation.state ?? "",
            country: data.deliveryInformation.country || "India",
          };
          setAddress(saved);
          setSavedAddress(saved);
          setEditing(false);
        }
      } catch (loadError) {
        console.error("Load saved address error:", loadError);
        setError(true);
        setMessage(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load your saved address."
        );
      } finally {
        setLoading(false);
      }
    }

    void loadAddress();
  }, [initialEmail, initialName]);

  function handleChange(
    event: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    const { name, value } = event.target;
    setAddress((current) => ({ ...current, [name]: value }));
    setMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError(false);

    try {
      const response = await fetch("/api/account/delivery-information", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(address),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to save your address.");
      }

      const saved: Address = {
        ...emptyAddress,
        ...data.deliveryInformation,
        shippingAddress2: data.deliveryInformation.shippingAddress2 ?? "",
        state: data.deliveryInformation.state ?? "",
        country: data.deliveryInformation.country || "India",
      };
      setAddress(saved);
      setSavedAddress(saved);
      setEditing(false);
      setConfirmDelete(false);
      setMessage(data.message || "Address saved to your account.");
    } catch (saveError) {
      console.error("Save address error:", saveError);
      setError(true);
      setMessage(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save your address."
      );
    } finally {
      setSaving(false);
    }
  }

  function cancelEditing() {
    if (savedAddress) {
      setAddress(savedAddress);
      setEditing(false);
    }
    setConfirmDelete(false);
    setMessage("");
    setError(false);
  }

  async function deleteAddress() {
    setDeleting(true);
    setMessage("");
    setError(false);

    try {
      const response = await fetch("/api/account/delivery-information", {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to delete the saved address.");
      }

      setAddress({
        ...emptyAddress,
        customerName: initialName,
        customerEmail: initialEmail,
      });
      setSavedAddress(null);
      setEditing(true);
      setConfirmDelete(false);
      setMessage(data.message || "Saved address deleted.");
    } catch (deleteError) {
      console.error("Delete saved address error:", deleteError);
      setError(true);
      setMessage(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete the saved address."
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form className="account-address-form" onSubmit={handleSubmit}>
      <div className="account-address-form-heading">
        <div>
          <span className="account-eyebrow">SAVED ADDRESS</span>
          <h2>Contact and delivery information</h2>
        </div>
        {loading && <span className="account-address-loading">Loading...</span>}
        {savedAddress && !editing && (
          <button
            type="button"
            className="account-address-edit-button"
            onClick={() => {
              setEditing(true);
              setMessage("");
            }}
          >
            Edit address
          </button>
        )}
      </div>

      <div className="account-address-fields">
        <label>
          Full name *
          <input
            name="customerName"
            autoComplete="name"
            value={address.customerName}
            onChange={handleChange}
            maxLength={120}
            required
            disabled={loading || saving || deleting || !editing}
          />
        </label>
        <label>
          Email *
          <input
            name="customerEmail"
            type="email"
            autoComplete="email"
            value={address.customerEmail}
            onChange={handleChange}
            maxLength={254}
            required
            disabled={loading || saving || deleting || !editing}
          />
        </label>
        <label>
          Phone number *
          <input
            name="customerPhone"
            type="tel"
            autoComplete="tel"
            value={address.customerPhone}
            onChange={handleChange}
            maxLength={30}
            required
            disabled={loading || saving || deleting || !editing}
          />
        </label>
        <label className="account-address-field-wide">
          Address *
          <textarea
            name="shippingAddress"
            autoComplete="street-address"
            value={address.shippingAddress}
            onChange={handleChange}
            maxLength={500}
            rows={3}
            required
            disabled={loading || saving || deleting || !editing}
          />
        </label>
        <label className="account-address-field-wide">
          Address line 2
          <input
            name="shippingAddress2"
            value={address.shippingAddress2}
            onChange={handleChange}
            maxLength={250}
            disabled={loading || saving || deleting || !editing}
          />
        </label>
        <label>
          City *
          <input
            name="city"
            autoComplete="address-level2"
            value={address.city}
            onChange={handleChange}
            maxLength={100}
            required
            disabled={loading || saving || deleting || !editing}
          />
        </label>
        <label>
          State / UT
          <select
            name="state"
            autoComplete="address-level1"
            value={address.state}
            onChange={handleChange}
            disabled={loading || saving || deleting || !editing}
          >
            <option value="">Select state or UT</option>
            {address.state &&
              !INDIAN_STATES_AND_UNION_TERRITORIES.includes(address.state) && (
                <option value={address.state}>{address.state}</option>
              )}
            <optgroup label="States">
              {INDIAN_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </optgroup>
            <optgroup label="Union territories">
              {INDIAN_UNION_TERRITORIES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <label>
          Postal / ZIP code *
          <input
            name="postalCode"
            autoComplete="postal-code"
            value={address.postalCode}
            onChange={handleChange}
            maxLength={20}
            required
            disabled={loading || saving || deleting || !editing}
          />
        </label>
        <label>
          Country *
          <input
            name="country"
            autoComplete="country-name"
            value={address.country}
            onChange={handleChange}
            maxLength={100}
            required
            disabled={loading || saving || deleting || !editing}
          />
        </label>
      </div>

      <div className="account-address-form-footer">
        {editing && (
          <>
            <button
              type="submit"
              className="help-button"
              disabled={loading || saving || deleting}
            >
              {saving
                ? "Saving..."
                : savedAddress
                  ? "Save changes"
                  : "Save address"}
            </button>
            {savedAddress && (
              <button
                type="button"
                className="account-address-cancel-button"
                onClick={cancelEditing}
                disabled={saving || deleting}
              >
                Cancel
              </button>
            )}
          </>
        )}
        {savedAddress && !editing && (
          <button
            type="button"
            className="account-address-delete-button"
            onClick={() => {
              setConfirmDelete((current) => !current);
              setMessage("");
              setError(false);
            }}
            disabled={saving || deleting}
          >
            Delete address
          </button>
        )}
        {confirmDelete && savedAddress && (
          <div className="account-address-delete-confirm">
            <span>
              Delete this saved address? Existing orders will not be changed.
            </span>
            <button
              type="button"
              onClick={deleteAddress}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Confirm delete"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
            >
              Keep address
            </button>
          </div>
        )}
        {message && (
          <p
            className={error ? "account-address-error" : "account-address-success"}
            role={error ? "alert" : "status"}
          >
            {message}
          </p>
        )}
      </div>
    </form>
  );
}
