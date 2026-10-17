"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Profile = {
  name: string;
  email: string;
  phone: string | null;
};

export default function ProfileForm({
  initialProfile,
  role,
}: {
  initialProfile: Profile;
  role: string;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [savedProfile, setSavedProfile] = useState(initialProfile);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError(false);

    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to save your profile.");
      }

      setProfile(data.user);
      setSavedProfile(data.user);
      setEditing(false);
      setMessage("Profile updated successfully.");
      router.refresh();
    } catch (saveError) {
      console.error("Save account profile error:", saveError);
      setError(true);
      setMessage(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save your profile."
      );
    } finally {
      setSaving(false);
    }
  }

  function cancelEditing() {
    setProfile(savedProfile);
    setEditing(false);
    setMessage("");
    setError(false);
  }

  return (
    <section className="account-profile">
      <div className="profile-heading">
        <div>
          <span className="account-eyebrow">PROFILE</span>
          <h2>Account information</h2>
        </div>
        {!editing ? (
          <button
            className="profile-edit"
            type="button"
            onClick={() => {
              setEditing(true);
              setMessage("");
            }}
          >
            Edit profile
          </button>
        ) : (
          <button
            className="profile-edit"
            type="button"
            onClick={cancelEditing}
            disabled={saving}
          >
            Cancel
          </button>
        )}
      </div>

      {editing ? (
        <form className="profile-edit-form" onSubmit={saveProfile}>
          <label>
            Full name
            <input
              name="name"
              autoComplete="name"
              minLength={2}
              maxLength={100}
              required
              value={profile.name}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              disabled={saving}
            />
          </label>
          <label>
            Email address
            <input
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
              value={profile.email}
              readOnly
              aria-describedby="profile-email-help"
            />
            <small id="profile-email-help">
              Verified email addresses can’t be changed here.
            </small>
          </label>
          <label>
            Phone number
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              maxLength={30}
              value={profile.phone ?? ""}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
              disabled={saving}
            />
          </label>
          <div className="profile-edit-actions">
            <button
              type="submit"
              className="profile-edit profile-save"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save profile"}
            </button>
            {message && (
              <p
                className={
                  error ? "profile-message-error" : "profile-message-success"
                }
                role={error ? "alert" : "status"}
              >
                {message}
              </p>
            )}
          </div>
        </form>
      ) : (
        <>
          <div className="profile-details">
            <div>
              <span>Full name</span>
              <strong>{profile.name}</strong>
            </div>
            <div>
              <span>Email address</span>
              <strong>{profile.email}</strong>
            </div>
            <div>
              <span>Phone number</span>
              <strong>{profile.phone || "Not added"}</strong>
            </div>
            <div>
              <span>Account type</span>
              <strong>{role === "ADMIN" ? "Administrator" : "Customer"}</strong>
            </div>
          </div>
          {message && (
            <p className="profile-message-success" role="status">
              {message}
            </p>
          )}
        </>
      )}
    </section>
  );
}
