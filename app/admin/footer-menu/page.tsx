"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type FooterMenuItem = {
  id?: string;
  label: string;
  href: string;
  isActive: boolean;
};

export default function AdminFooterMenuPage() {
  const router = useRouter();
  const [items, setItems] = useState<FooterMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);

  useEffect(() => {
    async function loadItems() {
      try {
        const response = await fetch("/api/admin/footer-menu", {
          cache: "no-store",
        });
        const data = await response.json();

        if (response.status === 401) {
          router.replace("/admin/login");
          return;
        }

        if (response.status === 403) {
          router.replace("/account");
          return;
        }

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Unable to load footer menu.");
        }

        setItems(data.items);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to load footer menu."
        );
        setMessageIsError(true);
      } finally {
        setLoading(false);
      }
    }

    loadItems();
  }, [router]);

  function updateItem(
    index: number,
    field: keyof FooterMenuItem,
    value: string | boolean
  ) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    );
    setMessage("");
  }

  function moveItem(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= items.length) return;

    setItems((current) => {
      const reordered = [...current];
      [reordered[index], reordered[nextIndex]] = [
        reordered[nextIndex],
        reordered[index],
      ];
      return reordered;
    });
    setMessage("");
  }

  async function saveMenu() {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/footer-menu", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to save footer menu.");
      }

      setItems(data.items);
      setMessage(data.message);
      setMessageIsError(false);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save footer menu."
      );
      setMessageIsError(true);
    } finally {
      setSaving(false);
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
              <span>Footer Menu</span>
            </div>
            <h1>Footer Menu</h1>
            <p>Choose which links appear in the customer-facing site footer.</p>
          </div>
          <Link href="/admin" className="admin-secondary-button">
            ← Dashboard
          </Link>
        </header>

        <section className="admin-products-card footer-menu-card">
          <div className="footer-menu-heading">
            <div>
              <h2>Menu links</h2>
              <p>Reorder links, edit their labels or destinations, and hide links you do not need.</p>
            </div>
            <button
              type="button"
              className="admin-secondary-button"
              onClick={() => {
                setItems((current) => [
                  ...current,
                  { label: "", href: "/", isActive: true },
                ]);
                setMessage("");
              }}
              disabled={loading || saving || items.length >= 20}
            >
              Add link
            </button>
          </div>

          {loading ? (
            <p className="footer-menu-feedback">Loading footer menu...</p>
          ) : items.length === 0 ? (
            <p className="footer-menu-feedback">
              No footer links yet. Add a link to get started.
            </p>
          ) : (
            <div className="footer-menu-items">
              {items.map((item, index) => (
                <div className="footer-menu-item" key={item.id ?? `new-${index}`}>
                  <div className="footer-menu-order">
                    <button
                      type="button"
                      aria-label={`Move ${item.label || "link"} up`}
                      onClick={() => moveItem(index, -1)}
                      disabled={index === 0 || saving}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${item.label || "link"} down`}
                      onClick={() => moveItem(index, 1)}
                      disabled={index === items.length - 1 || saving}
                    >
                      ↓
                    </button>
                  </div>

                  <label>
                    <span>Link label</span>
                    <input
                      value={item.label}
                      maxLength={40}
                      onChange={(event) =>
                        updateItem(index, "label", event.target.value)
                      }
                      placeholder="e.g. Contact"
                    />
                  </label>

                  <label>
                    <span>Destination</span>
                    <input
                      value={item.href}
                      onChange={(event) =>
                        updateItem(index, "href", event.target.value)
                      }
                      placeholder="/contact or https://example.com"
                    />
                  </label>

                  <label className="footer-menu-active">
                    <input
                      type="checkbox"
                      checked={item.isActive}
                      onChange={(event) =>
                        updateItem(index, "isActive", event.target.checked)
                      }
                    />
                    <span>Visible</span>
                  </label>

                  <button
                    type="button"
                    className="footer-menu-remove"
                    onClick={() =>
                      setItems((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index)
                      )
                    }
                    disabled={saving}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="footer-menu-actions">
            {message && (
              <p
                className={
                  messageIsError
                    ? "footer-menu-message footer-menu-message-error"
                    : "footer-menu-message"
                }
                role={messageIsError ? "alert" : "status"}
              >
                {message}
              </p>
            )}
            <button
              type="button"
              className="admin-primary-button"
              onClick={saveMenu}
              disabled={loading || saving}
            >
              {saving ? "Saving..." : "Save footer menu"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
