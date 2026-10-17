"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type OrderNotification = {
  id: string;
  createdAt: string;
  readAt: string | null;
  order: {
    orderNumber: string;
    customerName: string;
    total: string;
  };
};

type NotificationsResponse = {
  success: boolean;
  message?: string;
  notifications: OrderNotification[];
  unreadCount: number;
};

export default function OrderNotifications() {
  const [notifications, setNotifications] = useState<OrderNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/notifications", {
        cache: "no-store",
      });
      const result = (await response.json()) as NotificationsResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to load order notifications.");
      }
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
      setError("");
    } catch (loadError) {
      console.error("Admin order notifications refresh failed:", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load order notifications.",
      );
    }
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => {
      void loadNotifications();
    }, 0);
    const interval = window.setInterval(() => {
      void loadNotifications();
    }, 30_000);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
    };
  }, [loadNotifications]);

  async function markAsRead(notificationId: string) {
    setUpdatingId(notificationId);
    setError("");
    try {
      const response = await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      });
      const result = (await response.json()) as {
        success: boolean;
        message?: string;
      };
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to update the notification.");
      }
      await loadNotifications();
    } catch (updateError) {
      console.error("Admin order notification update failed:", updateError);
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update the notification.",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <section className="admin-panel admin-notifications">
      <div className="admin-panel-header">
        <div>
          <span className="admin-eyebrow">ORDERS</span>
          <h2>Order notifications</h2>
        </div>
        <span className="admin-notification-count" aria-live="polite">
          {unreadCount} unread
        </span>
      </div>

      {error ? (
        <p className="admin-notification-error" role="alert">
          {error}
        </p>
      ) : null}

      {notifications.length === 0 ? (
        <p className="admin-notifications-empty">New orders will appear here.</p>
      ) : (
        <ul className="admin-notification-list">
          {notifications.map((notification) => (
            <li
              className={`admin-notification${notification.readAt ? "" : " is-unread"}`}
              key={notification.id}
            >
              <Link
                href={`/admin/orders?search=${encodeURIComponent(notification.order.orderNumber)}`}
                className="admin-notification-link"
              >
                <span className="admin-notification-dot" aria-hidden="true" />
                <span className="admin-notification-copy">
                  <strong>Order {notification.order.orderNumber}</strong>
                  <span>
                    {notification.order.customerName} · INR{" "}
                    {Number(notification.order.total).toFixed(2)}
                  </span>
                </span>
                <time dateTime={notification.createdAt}>
                  {new Date(notification.createdAt).toLocaleString("en-IN")}
                </time>
              </Link>
              {!notification.readAt ? (
                <button
                  type="button"
                  className="admin-notification-read"
                  disabled={updatingId === notification.id}
                  onClick={() => void markAsRead(notification.id)}
                >
                  {updatingId === notification.id ? "Saving…" : "Mark read"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
