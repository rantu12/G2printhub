"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

type Coupon = {
  id: string;
  code: string;
  discountType: "PERCENTAGE" | "FIXED";
  value: string | number;
  minimumSubtotal: string | number;
  maximumDiscount: string | number | null;
  usageLimit: number | null;
  usageCount: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { orders: number };
};

type CouponForm = {
  code: string;
  discountType: "PERCENTAGE" | "FIXED";
  value: string;
  minimumSubtotal: string;
  maximumDiscount: string;
  usageLimit: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

const emptyForm: CouponForm = {
  code: "",
  discountType: "PERCENTAGE",
  value: "",
  minimumSubtotal: "0",
  maximumDiscount: "",
  usageLimit: "",
  startsAt: "",
  endsAt: "",
  isActive: true,
};

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatDate(value: string | null) {
  if (!value) return "No end date";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
    new Date(value)
  );
}

function isCurrentlyAvailable(coupon: Coupon, now: number) {
  return (
    coupon.isActive &&
    (!coupon.startsAt || new Date(coupon.startsAt).getTime() <= now) &&
    (!coupon.endsAt || new Date(coupon.endsAt).getTime() >= now) &&
    (coupon.usageLimit === null || coupon.usageCount < coupon.usageLimit)
  );
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [form, setForm] = useState<CouponForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(0);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const fetchCoupons = useCallback(async (): Promise<Coupon[]> => {
    const response = await fetch("/api/admin/coupons", {
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to load coupons.");
    }
    return data.coupons;
  }, []);

  async function loadCoupons() {
    try {
      setCoupons(await fetchCoupons());
    } catch (loadError) {
      console.error("Load coupons error:", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load coupons."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetchCoupons()
      .then((nextCoupons) => {
        if (active) setCoupons(nextCoupons);
      })
      .catch((loadError: unknown) => {
        console.error("Load coupons error:", loadError);
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load coupons."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const clockTimeout = window.setTimeout(() => setNow(Date.now()), 0);
    const clockInterval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      active = false;
      window.clearTimeout(clockTimeout);
      window.clearInterval(clockInterval);
    };
  }, [fetchCoupons]);

  const filteredCoupons = useMemo(() => {
    const query = search.trim().toLowerCase();
    return coupons.filter((coupon) => {
      const matchesSearch = !query || coupon.code.toLowerCase().includes(query);
      const available = isCurrentlyAvailable(coupon, now);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "available" && available) ||
        (statusFilter === "inactive" && !coupon.isActive) ||
        (statusFilter === "expired" &&
          coupon.isActive &&
          Boolean(coupon.endsAt) &&
          new Date(coupon.endsAt!).getTime() < now) ||
        (statusFilter === "used" &&
          coupon.usageLimit !== null &&
          coupon.usageCount >= coupon.usageLimit);
      return matchesSearch && matchesStatus;
    });
  }, [coupons, search, statusFilter, now]);

  const availableCount = coupons.filter((coupon) =>
    isCurrentlyAvailable(coupon, now)
  ).length;
  const redeemedCount = coupons.reduce(
    (total, coupon) => total + coupon.usageCount,
    0
  );

  function updateField<K extends keyof CouponForm>(
    field: K,
    value: CouponForm[K]
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startEdit(coupon: Coupon) {
    setEditingId(coupon.id);
    setForm({
      code: coupon.code,
      discountType: coupon.discountType,
      value: String(coupon.value),
      minimumSubtotal: String(coupon.minimumSubtotal),
      maximumDiscount:
        coupon.maximumDiscount === null ? "" : String(coupon.maximumDiscount),
      usageLimit: coupon.usageLimit === null ? "" : String(coupon.usageLimit),
      startsAt: toLocalInput(coupon.startsAt),
      endsAt: toLocalInput(coupon.endsAt),
      isActive: coupon.isActive,
    });
    setMessage("");
    setError("");
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setMessage("");
  }

  async function saveCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        editingId ? `/api/admin/coupons/${editingId}` : "/api/admin/coupons",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to save coupon.");
      }
      setMessage(data.message);
      resetForm();
      await loadCoupons();
    } catch (saveError) {
      console.error("Save coupon error:", saveError);
      setError(
        saveError instanceof Error ? saveError.message : "Unable to save coupon."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteCoupon(coupon: Coupon) {
    if (
      !window.confirm(
        `Delete coupon ${coupon.code}? Previously placed orders will keep their recorded discount.`
      )
    ) {
      return;
    }
    setDeletingId(coupon.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/coupons/${coupon.id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to delete coupon.");
      }
      setMessage(data.message);
      setCoupons((current) => current.filter((item) => item.id !== coupon.id));
      if (editingId === coupon.id) resetForm();
    } catch (deleteError) {
      console.error("Delete coupon error:", deleteError);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete coupon."
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="admin-products-page">
      <div className="admin-page-shell">
        <header className="admin-page-header">
          <div>
            <div className="admin-breadcrumb">
              <Link href="/admin">Dashboard</Link>
              <span>/</span>
              <span>Coupons</span>
            </div>
            <h1>Coupons</h1>
            <p>Create and manage discount codes for your customers.</p>
          </div>
          <Link href="/admin" className="admin-secondary-button">
            ← Dashboard
          </Link>
        </header>

        <section className="admin-coupon-metrics" aria-label="Coupon overview">
          <article>
            <span className="admin-coupon-metric-icon">%</span>
            <div><span>Total coupons</span><strong>{coupons.length}</strong></div>
          </article>
          <article>
            <span className="admin-coupon-metric-icon is-active">✓</span>
            <div><span>Available now</span><strong>{availableCount}</strong></div>
          </article>
          <article>
            <span className="admin-coupon-metric-icon is-used">↗</span>
            <div><span>Redemptions</span><strong>{redeemedCount}</strong></div>
          </article>
        </section>

        {error && <div className="admin-error-box" role="alert">{error}</div>}
        {message && <div className="admin-coupon-success" role="status">{message}</div>}

        <div className="admin-coupon-layout">
          <section className="admin-coupon-form-card">
            <header>
              <span className="admin-coupon-form-eyebrow">
                {editingId ? "UPDATE PROMOTION" : "NEW PROMOTION"}
              </span>
              <h2>{editingId ? "Edit coupon" : "Create a coupon"}</h2>
              <p>Configure the discount and when customers can use it.</p>
            </header>
            <form onSubmit={saveCoupon}>
              <label className="admin-coupon-field">
                <span>Coupon code</span>
                <input
                  value={form.code}
                  onChange={(event) =>
                    updateField(
                      "code",
                      event.target.value.toUpperCase().replace(/\s/g, "")
                    )
                  }
                  maxLength={32}
                  placeholder="e.g. WELCOME10"
                  required
                />
                <small>3–32 letters, numbers, hyphens or underscores.</small>
              </label>

              <div className="admin-coupon-form-row">
                <label className="admin-coupon-field">
                  <span>Discount type</span>
                  <select
                    value={form.discountType}
                    onChange={(event) =>
                      updateField(
                        "discountType",
                        event.target.value as CouponForm["discountType"]
                      )
                    }
                  >
                    <option value="PERCENTAGE">Percentage</option>
                    <option value="FIXED">Fixed amount</option>
                  </select>
                </label>
                <label className="admin-coupon-field">
                  <span>
                    {form.discountType === "PERCENTAGE"
                      ? "Discount (%)"
                      : "Discount amount (₹)"}
                  </span>
                  <input
                    type="number"
                    min="0.01"
                    max={form.discountType === "PERCENTAGE" ? 100 : undefined}
                    step="0.01"
                    value={form.value}
                    onChange={(event) => updateField("value", event.target.value)}
                    required
                  />
                </label>
              </div>

              <label className="admin-coupon-field">
                <span>Minimum order subtotal (₹)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.minimumSubtotal}
                  onChange={(event) =>
                    updateField("minimumSubtotal", event.target.value)
                  }
                />
              </label>

              <div className="admin-coupon-form-row">
                <label className="admin-coupon-field">
                  <span>Maximum discount (₹)</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.maximumDiscount}
                    onChange={(event) =>
                      updateField("maximumDiscount", event.target.value)
                    }
                    placeholder="No cap"
                  />
                </label>
                <label className="admin-coupon-field">
                  <span>Usage limit</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.usageLimit}
                    onChange={(event) =>
                      updateField("usageLimit", event.target.value)
                    }
                    placeholder="Unlimited"
                  />
                </label>
              </div>

              <div className="admin-coupon-form-row">
                <label className="admin-coupon-field">
                  <span>Starts at</span>
                  <input
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(event) => updateField("startsAt", event.target.value)}
                  />
                </label>
                <label className="admin-coupon-field">
                  <span>Ends at</span>
                  <input
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={(event) => updateField("endsAt", event.target.value)}
                  />
                </label>
              </div>

              <label className="admin-coupon-active-toggle">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => updateField("isActive", event.target.checked)}
                />
                <span><strong>Coupon is active</strong><small>Customers can use it while it is within its date and usage limits.</small></span>
              </label>

              <div className="admin-coupon-form-actions">
                {editingId && (
                  <button type="button" className="admin-secondary-button" onClick={resetForm} disabled={saving}>
                    Cancel
                  </button>
                )}
                <button type="submit" className="admin-primary-button" disabled={saving}>
                  {saving ? "Saving..." : editingId ? "Save changes" : "Create coupon"}
                </button>
              </div>
            </form>
          </section>

          <section className="admin-coupon-list-card">
            <header className="admin-coupon-list-header">
              <div>
                <h2>Coupon directory</h2>
                <span>Showing {filteredCoupons.length} of {coupons.length}</span>
              </div>
              <div className="admin-coupon-list-controls">
                <label className="admin-coupon-search">
                  <span aria-hidden="true">⌕</span>
                  <input
                    type="search"
                    aria-label="Search coupons"
                    placeholder="Search code..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <select
                  aria-label="Filter coupons by status"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="all">All coupons</option>
                  <option value="available">Available</option>
                  <option value="inactive">Inactive</option>
                  <option value="expired">Expired</option>
                  <option value="used">Limit reached</option>
                </select>
              </div>
            </header>

            {loading ? (
              <div className="admin-coupon-empty">
                <span className="category-loading-spinner" aria-hidden="true" />
                <strong>Loading coupons</strong>
              </div>
            ) : filteredCoupons.length === 0 ? (
              <div className="admin-coupon-empty">
                <span className="admin-coupon-empty-icon">%</span>
                <strong>{coupons.length ? "No matching coupons" : "No coupons yet"}</strong>
                <p>
                  {coupons.length
                    ? "Try another code or status filter."
                    : "Create your first coupon to offer a discount at checkout."}
                </p>
              </div>
            ) : (
              <div className="admin-coupon-table-wrap">
                <table className="admin-coupon-table">
                  <thead>
                    <tr>
                      <th>Coupon</th>
                      <th>Discount</th>
                      <th>Usage</th>
                      <th>Ends</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCoupons.map((coupon) => {
                      const available = isCurrentlyAvailable(coupon, now);
                      const statusLabel = !coupon.isActive
                        ? "Inactive"
                        : coupon.usageLimit !== null &&
                            coupon.usageCount >= coupon.usageLimit
                          ? "Limit reached"
                          : coupon.endsAt &&
                              new Date(coupon.endsAt).getTime() < now
                            ? "Expired"
                            : coupon.startsAt &&
                                new Date(coupon.startsAt).getTime() > now
                              ? "Scheduled"
                              : "Available";
                      return (
                        <tr key={coupon.id}>
                          <td>
                            <div className="admin-coupon-code">
                              <strong>{coupon.code}</strong>
                              <span>Min. order ₹{Number(coupon.minimumSubtotal).toFixed(2)}</span>
                            </div>
                          </td>
                          <td>
                            <strong className="admin-coupon-discount">
                              {coupon.discountType === "PERCENTAGE"
                                ? `${Number(coupon.value)}%`
                                : `₹${Number(coupon.value).toFixed(2)}`}
                            </strong>
                            {coupon.maximumDiscount !== null && (
                              <small className="admin-coupon-cap">
                                Up to ₹{Number(coupon.maximumDiscount).toFixed(2)}
                              </small>
                            )}
                          </td>
                          <td>
                            {coupon.usageCount}
                            <span className="admin-coupon-usage-limit">
                              {coupon.usageLimit === null ? " / ∞" : ` / ${coupon.usageLimit}`}
                            </span>
                          </td>
                          <td>{formatDate(coupon.endsAt)}</td>
                          <td>
                            <span className={`admin-coupon-status ${available ? "is-available" : "is-muted"}`}>
                              {statusLabel}
                            </span>
                          </td>
                          <td>
                            <div className="admin-coupon-actions">
                              <button type="button" onClick={() => startEdit(coupon)}>
                                Edit
                              </button>
                              <button
                                type="button"
                                className="is-delete"
                                onClick={() => deleteCoupon(coupon)}
                                disabled={deletingId !== null}
                              >
                                {deletingId === coupon.id ? "Deleting..." : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
