"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { SUPPORT_TICKET_STATUSES } from "@/lib/support";

type Reply = {
  id: string;
  authorName: string;
  authorRole: string;
  message: string;
  createdAt: string;
};

type Ticket = {
  id: string;
  ticketNumber: string;
  name: string;
  email: string;
  orderId: string | null;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
  replies: Reply[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function SupportPanel() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selectedTicket = tickets.find((ticket) => ticket.id === selectedId);

  const loadTickets = useCallback(
    async (search: string, status: string, pageToLoad: number) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set("q", search.trim());
        if (status) params.set("status", status);
        params.set("page", String(pageToLoad));
        const response = await fetch(`/api/admin/support?${params.toString()}`, {
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || "Unable to load support tickets.");
        }
        const nextTickets: Ticket[] = data.tickets;
        setTickets(nextTickets);
        setPage(data.page);
        setTotal(data.total);
        setSelectedId((current) =>
          nextTickets.some((ticket) => ticket.id === current)
            ? current
            : nextTickets[0]?.id ?? ""
        );
      } catch (loadError) {
        console.error("Admin support ticket load error:", loadError);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load support tickets."
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTickets("", "", 1);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadTickets]);

  async function updateTicket(
    update: { status?: string; message?: string },
    clearReply = false
  ) {
    if (!selectedTicket) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/support/${encodeURIComponent(selectedTicket.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(update),
        }
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to update the ticket.");
      }
      setTickets((current) =>
        current.map((ticket) =>
          ticket.id === data.ticket.id ? data.ticket : ticket
        )
      );
      if (clearReply) setReplyText("");
      if (
        update.status &&
        statusFilter &&
        statusFilter !== update.status
      ) {
        await loadTickets(query, statusFilter, page);
      }
    } catch (updateError) {
      console.error("Admin support ticket update error:", updateError);
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update the ticket."
      );
    } finally {
      setSaving(false);
    }
  }

  function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = replyText.trim();
    if (message) void updateTicket({ message }, true);
  }

  function sendReplyAndClose() {
    const message = replyText.trim();
    if (message) void updateTicket({ message, status: "CLOSED" }, true);
  }

  return (
    <section className="admin-support">
      <form
        className="admin-support-filters"
        onSubmit={(event) => {
          event.preventDefault();
          void loadTickets(query, statusFilter, 1);
        }}
      >
        <label>
          <span>Search tickets</span>
          <input
            value={query}
            maxLength={100}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ticket number, name, email, order ID..."
          />
        </label>
        <label>
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">All statuses</option>
            {SUPPORT_TICKET_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={loading}>
          Search
        </button>
      </form>

      {error && (
        <p className="support-error" role="alert">
          {error}
        </p>
      )}

      <div className="admin-support-layout">
        <div className="admin-support-ticket-list" aria-label="Support tickets">
          {loading ? (
            <p className="admin-support-empty">Loading support tickets...</p>
          ) : tickets.length === 0 ? (
            <p className="admin-support-empty">No support tickets found.</p>
          ) : (
            tickets.map((ticket) => (
              <button
                className={`admin-support-ticket ${
                  selectedId === ticket.id ? "is-selected" : ""
                }`}
                key={ticket.id}
                type="button"
                onClick={() => setSelectedId(ticket.id)}
              >
                <span className="admin-support-ticket-top">
                  <strong>{ticket.ticketNumber}</strong>
                  <span className={`support-status status-${ticket.status.toLowerCase()}`}>
                    {ticket.status.replaceAll("_", " ")}
                  </span>
                </span>
                <strong>{ticket.subject}</strong>
                <span>{ticket.name} · {ticket.email}</span>
                <time dateTime={ticket.createdAt}>
                  {formatDate(ticket.createdAt)}
                </time>
              </button>
            ))
          )}
          {total > 0 && (
            <div className="admin-support-pagination">
              <span>
                Page {page} of {Math.max(1, Math.ceil(total / 50))} · {total} tickets
              </span>
              <div>
                <button
                  type="button"
                  disabled={loading || page <= 1}
                  onClick={() => void loadTickets(query, statusFilter, page - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={loading || page >= Math.ceil(total / 50)}
                  onClick={() => void loadTickets(query, statusFilter, page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {selectedTicket && (
          <article className="admin-support-detail">
            <header>
              <div>
                <span className="customer-ticket-number">
                  {selectedTicket.ticketNumber}
                </span>
                <h2>{selectedTicket.subject}</h2>
                <p>
                  {selectedTicket.name} · {selectedTicket.email}
                  {selectedTicket.orderId && ` · Order ${selectedTicket.orderId}`}
                </p>
              </div>
              <label>
                <span>Ticket status</span>
                <select
                  value={selectedTicket.status}
                  disabled={saving}
                  onChange={(event) =>
                    void updateTicket({ status: event.target.value })
                  }
                >
                  {SUPPORT_TICKET_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
            </header>
            <div className="support-message support-message-customer">
              <strong>Original request</strong>
              <p>{selectedTicket.message}</p>
              <time dateTime={selectedTicket.createdAt}>
                {formatDate(selectedTicket.createdAt)}
              </time>
            </div>
            {selectedTicket.replies.map((reply) => (
              <div
                className={`support-message ${
                  reply.authorRole === "ADMIN"
                    ? "support-message-staff"
                    : "support-message-customer"
                }`}
                key={reply.id}
              >
                <strong>
                  {reply.authorRole === "ADMIN"
                    ? "PrintHub Support"
                    : reply.authorName}
                </strong>
                <p>{reply.message}</p>
                <time dateTime={reply.createdAt}>{formatDate(reply.createdAt)}</time>
              </div>
            ))}
            <form className="customer-ticket-reply" onSubmit={submitReply}>
              <label>
                <span>Reply to customer</span>
                <textarea
                  rows={4}
                  maxLength={5000}
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  required
                  disabled={saving || selectedTicket.status === "CLOSED"}
                />
              </label>
              {selectedTicket.status === "CLOSED" && (
                <p className="customer-ticket-closed">
                  Reopen this ticket using the status menu before replying.
                </p>
              )}
              <button
                type="submit"
                disabled={saving || selectedTicket.status === "CLOSED"}
              >
                {saving ? "Sending..." : "Send reply"}
              </button>
              <button
                type="button"
                className="admin-support-close-button"
                disabled={saving || selectedTicket.status === "CLOSED"}
                onClick={sendReplyAndClose}
              >
                {saving ? "Sending..." : "Send reply & close ticket"}
              </button>
            </form>
          </article>
        )}
      </div>
    </section>
  );
}
