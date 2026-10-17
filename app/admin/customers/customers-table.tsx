"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type CustomerRow = {
  id: string;
  name: string;
  email: string;
  isBlocked: boolean;
  createdAt: string;
  phone: string | null;
  orderCount: number;
};

export default function CustomersTable({
  customers: initialCustomers,
  search,
  statusFilter,
  summary,
}: {
  customers: CustomerRow[];
  search: string;
  statusFilter: string;
  summary: {
    total: number;
    active: number;
    blocked: number;
    orders: number;
  };
}) {
  const router = useRouter();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    function refreshWhenVisible() {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }

    const intervalId = window.setInterval(refreshWhenVisible, 15000);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [router]);

  const filteredCustomers = initialCustomers;

  async function toggleBlocked(customer: CustomerRow) {
    const isBlocked = !customer.isBlocked;

    try {
      setUpdatingId(customer.id);
      setError("");

      const response = await fetch(
        `/api/admin/customers/${encodeURIComponent(customer.id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ isBlocked }),
        }
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to update customer status.");
      }

      router.refresh();
    } catch (error) {
      console.error("Update customer status error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Unable to update customer status."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="admin-customers">
      <section className="admin-customer-metrics" aria-label="Customer overview">
        <article className="admin-customer-metric">
          <span className="admin-customer-metric-icon" aria-hidden="true">♙</span>
          <div>
            <span className="admin-customer-metric-label">Total customers</span>
            <strong>{summary.total}</strong>
          </div>
        </article>
        <article className="admin-customer-metric">
          <span className="admin-customer-metric-icon is-active" aria-hidden="true">✓</span>
          <div>
            <span className="admin-customer-metric-label">Active</span>
            <strong>{summary.active}</strong>
          </div>
        </article>
        <article className="admin-customer-metric">
          <span className="admin-customer-metric-icon is-blocked" aria-hidden="true">!</span>
          <div>
            <span className="admin-customer-metric-label">Blocked</span>
            <strong>{summary.blocked}</strong>
          </div>
        </article>
        <article className="admin-customer-metric">
          <span className="admin-customer-metric-icon is-orders" aria-hidden="true">▤</span>
          <div>
            <span className="admin-customer-metric-label">Orders placed</span>
            <strong>{summary.orders}</strong>
          </div>
        </article>
      </section>

      {error && (
        <div className="admin-error-box" role="alert">
          <strong>Error:</strong> {error}
        </div>
      )}

      <form
        className="admin-customers-toolbar"
        aria-label="Customer filters"
        method="GET"
      >
        <label className="admin-customers-search">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            name="q"
            placeholder="Search name, email or phone..."
            defaultValue={search}
            maxLength={100}
          />
        </label>
        <div className="admin-customers-filter-wrap">
          <label className="admin-customers-filter-label" htmlFor="customer-status-filter">
            Account status
          </label>
          <select
            id="customer-status-filter"
            name="status"
            className="admin-customers-filter"
            defaultValue={statusFilter}
          >
            <option value="all">All customers</option>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>
        <button type="submit" className="admin-secondary-button">
          Apply filters
        </button>
        <span className="admin-customers-result-count" aria-live="polite">
          {filteredCustomers.length} {filteredCustomers.length === 1 ? "customer" : "customers"}
        </span>
      </form>

      <div className="admin-table-wrapper">
        <table className="admin-products-table admin-customers-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Phone</th>
              <th>Orders</th>
              <th>Joined</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.map((customer) => (
              <tr key={customer.id}>
                <td>
                  <div className="admin-customer-identity">
                    <span className="admin-customer-avatar" aria-hidden="true">
                      {customer.name
                        .split(/\s+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join("")
                        .toUpperCase()}
                    </span>
                    <span className="admin-customer-name">
                      <strong>{customer.name}</strong>
                      <span>{customer.email}</span>
                    </span>
                  </div>
                </td>
                <td>{customer.phone || <span className="admin-customer-muted">Not provided</span>}</td>
                <td><span className="admin-customer-order-count">{customer.orderCount}</span></td>
                <td>
                  {new Intl.DateTimeFormat("en", {
                    dateStyle: "medium",
                  }).format(new Date(customer.createdAt))}
                </td>
                <td>
                  <span
                    className={
                      customer.isBlocked
                        ? "status-badge status-inactive"
                        : "status-badge status-active"
                    }
                  >
                    {customer.isBlocked ? "Blocked" : "Active"}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className={`action-btn admin-customer-action${customer.isBlocked ? "" : " delete-action"}`}
                    onClick={() => toggleBlocked(customer)}
                    disabled={updatingId !== null}
                  >
                    {updatingId === customer.id
                      ? "Updating..."
                      : customer.isBlocked
                        ? "Unblock"
                        : "Block"}
                  </button>
                </td>
              </tr>
            ))}
            {filteredCustomers.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <div className="admin-customers-no-results">
                    <strong>No customers found</strong>
                    <span>Try another search or change the account status filter.</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
