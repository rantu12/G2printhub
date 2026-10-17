"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

type FormFields = {
  name: string;
  email: string;
  orderId: string;
  subject: string;
  message: string;
  website: string;
};

const initialFields: FormFields = {
  name: "",
  email: "",
  orderId: "",
  subject: "",
  message: "",
  website: "",
};

export default function SupportForm() {
  const [fields, setFields] = useState(initialFields);
  const [error, setError] = useState("");
  const [ticketNumber, setTicketNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function updateField(field: keyof FormFields, value: string) {
    setFields((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to submit your request.");
      }
      setTicketNumber(data.ticketNumber);
      setFields(initialFields);
    } catch (submitError) {
      console.error("Submit support ticket error:", submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to submit your request."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (ticketNumber) {
    return (
      <section className="support-success" role="status">
        <span className="support-success-icon" aria-hidden="true">
          ✓
        </span>
        <h2>We received your request</h2>
        <p>
          Your ticket number is <strong>{ticketNumber}</strong>. Keep it for
          your records.
        </p>
        <Link href="/my-account/support">View support history</Link>
      </section>
    );
  }

  return (
    <form className="support-form" onSubmit={submit}>
      <div className="support-form-grid">
        <label>
          <span>Name</span>
          <input
            required
            minLength={2}
            maxLength={100}
            autoComplete="name"
            value={fields.name}
            onChange={(event) => updateField("name", event.target.value)}
          />
        </label>
        <label>
          <span>Email</span>
          <input
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            value={fields.email}
            onChange={(event) => updateField("email", event.target.value)}
          />
        </label>
      </div>
      <label>
        <span>Order ID <small>(optional)</small></span>
        <input
          maxLength={100}
          value={fields.orderId}
          onChange={(event) => updateField("orderId", event.target.value)}
        />
      </label>
      <label>
        <span>Subject</span>
        <input
          required
          minLength={3}
          maxLength={150}
          value={fields.subject}
          onChange={(event) => updateField("subject", event.target.value)}
        />
      </label>
      <label>
        <span>Message</span>
        <textarea
          required
          minLength={10}
          maxLength={5000}
          rows={7}
          value={fields.message}
          onChange={(event) => updateField("message", event.target.value)}
        />
        <small>{fields.message.length}/5000</small>
      </label>
      <label className="support-honeypot" aria-hidden="true">
        Website
        <input
          tabIndex={-1}
          autoComplete="off"
          value={fields.website}
          onChange={(event) => updateField("website", event.target.value)}
        />
      </label>
      {error && (
        <p className="support-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={submitting}>
        {submitting ? "Sending request..." : "Submit support request"}
      </button>
      <p className="support-form-note">
        Already submitted a request? <Link href="/my-account/support">View your support history</Link>.
      </p>
    </form>
  );
}
