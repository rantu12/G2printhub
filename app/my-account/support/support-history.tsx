"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

type TicketReply = {
  id: string;
  authorName: string;
  authorRole: string;
  message: string;
  createdAt: string;
};

type Ticket = {
  id: string;
  ticketNumber: string;
  orderId: string | null;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  replies: TicketReply[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

export default function SupportHistory({
  initialTickets,
}: {
  initialTickets: Ticket[];
}) {
  const [tickets, setTickets] = useState(initialTickets);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<string | null>(null);

  async function reply(event: FormEvent<HTMLFormElement>, ticket: Ticket) {
    event.preventDefault();
    const message = (drafts[ticket.id] ?? "").trim();
    if (!message) return;

    setSending(ticket.id);
    setErrors((current) => ({ ...current, [ticket.id]: "" }));
    try {
      const response = await fetch(
        `/api/support/tickets/${encodeURIComponent(ticket.id)}/replies`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        }
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to send your reply.");
      }
      setTickets((current) =>
        current.map((item) =>
          item.id === ticket.id
            ? {
                ...item,
                status: data.status,
                replies: [...item.replies, data.reply],
              }
            : item
        )
      );
      setDrafts((current) => ({ ...current, [ticket.id]: "" }));
    } catch (replyError) {
      console.error("Customer support history reply error:", replyError);
      setErrors((current) => ({
        ...current,
        [ticket.id]:
          replyError instanceof Error
            ? replyError.message
            : "Unable to send your reply.",
      }));
    } finally {
      setSending(null);
    }
  }

  return (
    <section className="customer-support-list" aria-label="Your support tickets">
      {tickets.length === 0 ? (
        <div className="customer-support-empty">
          <h2>No support requests yet</h2>
          <p>Your submitted support requests will appear here.</p>
          <Link href="/support">Contact support</Link>
        </div>
      ) : (
        tickets.map((ticket) => (
          <article className="customer-ticket" key={ticket.id}>
            <header className="customer-ticket-header">
              <div>
                <span className="customer-ticket-number">
                  {ticket.ticketNumber}
                </span>
                <h2>{ticket.subject}</h2>
              </div>
              <span className={`support-status status-${ticket.status.toLowerCase()}`}>
                {ticket.status.replaceAll("_", " ")}
              </span>
            </header>
            <div className="customer-ticket-meta">
              <span>Submitted {formatDate(ticket.createdAt)}</span>
              {ticket.orderId && <span>Order: {ticket.orderId}</span>}
            </div>
            <div className="support-message support-message-customer">
              <strong>Your request</strong>
              <p>{ticket.message}</p>
              <time dateTime={ticket.createdAt}>{formatDate(ticket.createdAt)}</time>
            </div>
            {ticket.replies.map((item) => (
              <div
                className={`support-message ${
                  item.authorRole === "ADMIN"
                    ? "support-message-staff"
                    : "support-message-customer"
                }`}
                key={item.id}
              >
                <strong>
                  {item.authorRole === "ADMIN" ? "G2 PrintHub Support" : item.authorName}
                </strong>
                <p>{item.message}</p>
                <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
              </div>
            ))}
            {ticket.status === "CLOSED" ? (
              <p className="customer-ticket-closed">
                This ticket is closed. <Link href="/support">Submit a new request</Link> if you
                need more help.
              </p>
            ) : (
              <form
                className="customer-ticket-reply"
                onSubmit={(event) => void reply(event, ticket)}
              >
                <label>
                  <span>Reply to this ticket</span>
                  <textarea
                    rows={3}
                    maxLength={5000}
                    value={drafts[ticket.id] ?? ""}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [ticket.id]: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                {errors[ticket.id] && (
                  <p className="support-error" role="alert">
                    {errors[ticket.id]}
                  </p>
                )}
                <button type="submit" disabled={sending === ticket.id}>
                  {sending === ticket.id ? "Sending..." : "Send reply"}
                </button>
              </form>
            )}
          </article>
        ))
      )}
    </section>
  );
}
