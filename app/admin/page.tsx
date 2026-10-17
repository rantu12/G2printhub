import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStoreSettings } from "@/lib/store-settings";
import CodSettingsControl from "./cod-settings-control";
import OrderNotifications from "./order-notifications";
import ClearSupportTicketsButton from "./support/clear-tickets-button";

type SalesRange = "7" | "30" | "90";

function getSalesRange(value: string | string[] | undefined): SalesRange {
  const range = Array.isArray(value) ? value[0] : value;
  return range === "7" || range === "90" ? range : "30";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getSalesBuckets(range: SalesRange) {
  const totalDays = Number(range);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const startDate = new Date(now);
  startDate.setDate(now.getDate() - totalDays + 1);

  const bucketCount = 4;
  const bucketSize = Math.max(1, Math.ceil(totalDays / bucketCount));

  return Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = new Date(startDate);
    bucketStart.setDate(startDate.getDate() + index * bucketSize);

    const bucketEnd = new Date(bucketStart);
    bucketEnd.setDate(bucketStart.getDate() + bucketSize);

    return {
      label: `Week ${index + 1}`,
      start: bucketStart,
      end: bucketEnd,
    };
  });
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const range = getSalesRange(params.range);
  const user = await getCurrentUser();

  if (!user) {
    redirect("/admin/login");
  }

  if (user.role !== "ADMIN") {
    redirect("/account");
  }

  const [
    productCount,
    categoryCount,
    customerCount,
    orderCount,
    recentSupportTickets,
    openSupportTicketCount,
    supportTicketCount,
    storeSettings,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.category.count(),
    prisma.user.count({
      where: {
        role: "CUSTOMER",
      },
    }),
    prisma.order.count(),
    prisma.supportTicket.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        ticketNumber: true,
        name: true,
        email: true,
        subject: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.supportTicket.count({
      where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_FOR_CUSTOMER"] } },
    }),
    prisma.supportTicket.count(),
    getStoreSettings(),
  ]);

  const dayWindow = Number(range);
  const currentStart = new Date();
  currentStart.setHours(0, 0, 0, 0);
  currentStart.setDate(currentStart.getDate() - dayWindow + 1);

  const previousStart = new Date(currentStart);
  previousStart.setDate(previousStart.getDate() - dayWindow);

  const [currentSales, previousSales] = await Promise.all([
    prisma.order.findMany({
      where: {
        createdAt: {
          gte: currentStart,
        },
      },
      select: {
        total: true,
        createdAt: true,
      },
    }),
    prisma.order.findMany({
      where: {
        createdAt: {
          gte: previousStart,
          lt: currentStart,
        },
      },
      select: {
        total: true,
      },
    }),
  ]);

  const totalSales = currentSales.reduce(
    (sum, order) => sum + Number(order.total),
    0,
  );
  const previousTotalSales = previousSales.reduce(
    (sum, order) => sum + Number(order.total),
    0,
  );

  const growthRate =
    previousTotalSales === 0
      ? totalSales > 0
        ? 100
        : 0
      : ((totalSales - previousTotalSales) / previousTotalSales) * 100;

  const salesBuckets = getSalesBuckets(range).map((bucket) => {
    const bucketValue = currentSales
      .filter(
        (order) =>
          order.createdAt >= bucket.start && order.createdAt < bucket.end,
      )
      .reduce((sum, order) => sum + Number(order.total), 0);

    return {
      ...bucket,
      value: bucketValue,
    };
  });

  const maxBucketValue = Math.max(...salesBuckets.map((bucket) => bucket.value), 1);
  const chartHeights = salesBuckets.map((bucket) => ({
    ...bucket,
    height:
      bucket.value === 0
        ? 0
        : Math.max(8, (bucket.value / maxBucketValue) * 100),
  }));

  const initials = user.name
    .split(" ")
    .map((word) => word.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <main className="admin-page">
      {/* ================= SIDEBAR ================= */}
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <Link href="/" className="admin-logo">
            <span className="admin-logo-icon">G2</span>
            <span>
              Print<span>Hub</span>
            </span>
          </Link>

          <span className="admin-label">ADMIN PANEL</span>
        </div>

        <nav className="admin-nav">
          <Link
            href="/admin"
            className="admin-nav-link active"
          >
            <span>⌂</span>
            <strong>Dashboard</strong>
          </Link>

          <Link
            href="/admin/categories"
            className="admin-nav-link"
          >
            <span>◫</span>
            <strong>Categories</strong>
          </Link>

          <Link
            href="/admin/products"
            className="admin-nav-link"
          >
            <span>▣</span>
            <strong>Products</strong>
          </Link>

          <Link
            href="/admin/orders"
            className="admin-nav-link"
          >
            <span>◈</span>
            <strong>Orders</strong>
          </Link>

          <Link
            href="/admin/support"
            className="admin-nav-link"
          >
            <span>?</span>
            <strong>Help &amp; Support</strong>
          </Link>

          <Link
            href="/admin/customers"
            className="admin-nav-link"
          >
            <span>♙</span>
            <strong>Customers</strong>
          </Link>

          <Link
            href="/admin/designs"
            className="admin-nav-link"
          >
            <span>◇</span>
            <strong>Designs</strong>
          </Link>

          <Link
            href="/admin/inventory"
            className="admin-nav-link"
          >
            <span>▤</span>
            <strong>Inventory</strong>
          </Link>

          <Link
            href="/admin/coupons"
            className="admin-nav-link"
          >
            <span>%</span>
            <strong>Coupons</strong>
          </Link>

          <Link
            href="/admin/reports"
            className="admin-nav-link"
          >
            <span>⌁</span>
            <strong>Reports</strong>
          </Link>

          <Link
            href="/admin/settings"
            className="admin-nav-link"
          >
            <span>⚙</span>
            <strong>Settings</strong>
          </Link>

          <Link
            href="/admin/footer-menu"
            className="admin-nav-link"
          >
            <span>☷</span>
            <strong>Footer Menu</strong>
          </Link>
        </nav>

        <div className="admin-sidebar-bottom">
          <Link
            href="/"
            className="admin-store-link"
          >
            ← <span>View Store</span>
          </Link>

          <form
            action="/api/auth/logout?redirectTo=admin"
            method="POST"
          >
            <button
              type="submit"
              className="admin-logout"
            >
              ⇥ <span>Logout</span>
            </button>
          </form>
        </div>
      </aside>

      {/* ================= MAIN ================= */}
      <section className="admin-main">
        {/* TOP BAR */}
        <header className="admin-topbar">
          <div>
            <span className="admin-eyebrow">
              ADMINISTRATION
            </span>

            <h1>
              Good evening,{" "}
              {user.name.split(" ")[0]} 👋
            </h1>

            <p>
              Here&apos;s what&apos;s happening with your
              PrintHub store.
            </p>
          </div>

          <div className="admin-topbar-actions">
            <div className="admin-user">
              <div className="admin-avatar">
                {initials}
              </div>

              <div>
                <strong>{user.name}</strong>
                <span>Administrator</span>
              </div>
            </div>

            <form action="/api/auth/logout?redirectTo=admin" method="POST">
              <button type="submit" className="admin-topbar-logout">
                Logout
              </button>
            </form>
          </div>
        </header>

        <OrderNotifications />

        <section className="admin-panel admin-notifications">
          <div className="admin-panel-header">
            <div>
              <span className="admin-eyebrow">CUSTOMER SUPPORT</span>
              <h2>Recent support tickets</h2>
            </div>
            <div className="admin-support-dashboard-actions">
              <span className="admin-notification-count">
                {openSupportTicketCount} open
              </span>
              <ClearSupportTicketsButton ticketCount={supportTicketCount} />
            </div>
          </div>
          {recentSupportTickets.length === 0 ? (
            <p className="admin-notifications-empty">
              New customer support tickets will appear here.
            </p>
          ) : (
            <ul className="admin-notification-list">
              {recentSupportTickets.map((ticket) => (
                <li className="admin-notification" key={ticket.ticketNumber}>
                  <Link
                    href="/admin/support"
                    className="admin-notification-link"
                  >
                    <span
                      className="admin-notification-dot"
                      aria-hidden="true"
                    />
                    <span className="admin-notification-copy">
                      <strong>
                        {ticket.ticketNumber} · {ticket.subject}
                      </strong>
                      <span>
                        Created by {ticket.name} ({ticket.email}) ·{" "}
                        {ticket.status.replaceAll("_", " ")}
                      </span>
                    </span>
                    <time dateTime={ticket.createdAt.toISOString()}>
                      {new Intl.DateTimeFormat("en-IN", {
                        dateStyle: "medium",
                      }).format(ticket.createdAt)}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ================= STATS ================= */}
        <section className="admin-stats">
          <div className="admin-stat-card">
            <div className="admin-stat-top">
              <div className="admin-stat-icon">
                ▣
              </div>

              <span className="stat-badge">
                Live
              </span>
            </div>

            <span className="admin-stat-title">
              Total Products
            </span>

            <strong>{productCount}</strong>

            <small>
              Products in your catalog
            </small>
          </div>

          <div className="admin-stat-card">
            <div className="admin-stat-top">
              <div className="admin-stat-icon">
                ◫
              </div>

              <span className="stat-badge">
                Active
              </span>
            </div>

            <span className="admin-stat-title">
              Categories
            </span>

            <strong>{categoryCount}</strong>

            <small>
              Product categories
            </small>
          </div>

          <div className="admin-stat-card">
            <div className="admin-stat-top">
              <div className="admin-stat-icon">
                ♙
              </div>

              <span className="stat-badge">
                Users
              </span>
            </div>

            <span className="admin-stat-title">
              Customers
            </span>

            <strong>{customerCount}</strong>

            <small>
              Registered customers
            </small>
          </div>

          <div className="admin-stat-card">
            <div className="admin-stat-top">
              <div className="admin-stat-icon">
                ◈
              </div>

              <span className="stat-badge">
                Store
              </span>
            </div>

            <span className="admin-stat-title">
              Total Orders
            </span>

            <strong>{orderCount}</strong>

            <small>
              Orders received
            </small>
          </div>
        </section>

        {/* ================= COD SETTINGS ================= */}
        <CodSettingsControl initialCodEnabled={storeSettings.codEnabled} />

        {/* ================= MAIN GRID ================= */}
        <div className="admin-content-grid">
          {/* SALES */}
          <section className="admin-panel">
            <div className="admin-panel-header">
              <div>
                <span className="admin-eyebrow">
                  STORE OVERVIEW
                </span>

                <h2>Sales overview</h2>
              </div>

              <form method="GET" className="admin-range-form">
                <select
                  name="range"
                  className="admin-select"
                  defaultValue={range}
                >
                  <option value="7">
                    Last 7 days
                  </option>

                  <option value="30">
                    Last 30 days
                  </option>

                  <option value="90">
                    Last 90 days
                  </option>
                </select>

                <button type="submit" className="admin-range-submit">
                  Apply
                </button>
              </form>
            </div>

            <div className="sales-area">
              <div className="sales-summary">
                <div>
                  <span>Total sales</span>

                  <strong>{formatCurrency(totalSales)}</strong>
                </div>

                <div className="sales-growth">
                  {growthRate >= 0 ? "+" : "-"}
                  {Math.abs(growthRate).toFixed(1)}%
                  <small>this period</small>
                </div>
              </div>

              <div className="sales-chart">
                <div
                  className="chart-grid"
                  aria-hidden="true"
                >
                  <span />
                  <span />
                  <span />
                  <span />
                </div>

                <div className="chart-bars">
                  {chartHeights.map((bucket) => (
                    <i
                      key={bucket.label}
                      style={{ height: `${bucket.height}%` }}
                    />
                  ))}
                </div>
              </div>

              <div className="chart-labels">
                {chartHeights.map((bucket) => (
                  <span key={bucket.label}>{bucket.label}</span>
                ))}
              </div>

              <p className="chart-note">
                {totalSales > 0
                  ? `Sales for the last ${range} days are being tracked in real time.`
                  : "Sales analytics will become active when your first orders are received."}
              </p>
            </div>
          </section>

          {/* QUICK ACTIONS */}
          <section className="admin-panel">
            <div className="admin-panel-header">
              <div>
                <span className="admin-eyebrow">
                  QUICK ACTIONS
                </span>

                <h2>Manage store</h2>
              </div>
            </div>

            <div className="quick-actions">
              <Link
                href="/admin/products/new"
                className="quick-action"
              >
                <span className="quick-action-icon">
                  ＋
                </span>

                <div>
                  <strong>
                    Add Product
                  </strong>

                  <small>
                    Create a new product
                  </small>
                </div>

                <b>→</b>
              </Link>

              <Link
                href="/admin/categories"
                className="quick-action"
              >
                <span className="quick-action-icon">
                  ＋
                </span>

                <div>
                  <strong>
                    Add Category
                  </strong>

                  <small>
                    Organize your catalog
                  </small>
                </div>

                <b>→</b>
              </Link>

              <Link
                href="/admin/orders"
                className="quick-action"
              >
                <span className="quick-action-icon">
                  ◈
                </span>

                <div>
                  <strong>
                    Manage Orders
                  </strong>

                  <small>
                    View customer orders
                  </small>
                </div>

                <b>→</b>
              </Link>

              <Link
                href="/products"
                className="quick-action"
              >
                <span className="quick-action-icon">
                  ↗
                </span>

                <div>
                  <strong>
                    View Store
                  </strong>

                  <small>
                    Open customer storefront
                  </small>
                </div>

                <b>→</b>
              </Link>
            </div>
          </section>
        </div>

        {/* ================= RECENT ORDERS ================= */}
        <section className="admin-panel recent-panel">
          <div className="admin-panel-header">
            <div>
              <span className="admin-eyebrow">
                ORDERS
              </span>

              <h2>Recent orders</h2>
            </div>

            <Link
              href="/admin/orders"
              className="admin-view-all"
            >
              View all →
            </Link>
          </div>

          <div className="admin-empty">
            <div className="admin-empty-icon">
              ◈
            </div>

            <h3>
              No orders yet
            </h3>

            <p>
              Customer orders will appear here
              once your PrintHub store starts
              receiving orders.
            </p>

            <Link href="/products">
              View storefront →
            </Link>
          </div>
        </section>

        {/* ================= STORE MANAGEMENT ================= */}
        <section className="admin-panel management-panel">
          <div className="admin-panel-header">
            <div>
              <span className="admin-eyebrow">
                STORE MANAGEMENT
              </span>

              <h2>
                Manage your PrintHub store
              </h2>
            </div>
          </div>

          <div className="management-grid">
            <Link
              href="/admin/products"
              className="management-card"
            >
              <span>▣</span>

              <div>
                <strong>
                  Products
                </strong>

                <small>
                  Add, edit and manage products
                </small>
              </div>

              <b>→</b>
            </Link>

            <Link
              href="/admin/categories"
              className="management-card"
            >
              <span>◫</span>

              <div>
                <strong>
                  Categories
                </strong>

                <small>
                  Organize your products
                </small>
              </div>

              <b>→</b>
            </Link>

            <Link
              href="/admin/customers"
              className="management-card"
            >
              <span>♙</span>

              <div>
                <strong>
                  Customers
                </strong>

                <small>
                  Manage customer accounts
                </small>
              </div>

              <b>→</b>
            </Link>

            <Link
              href="/admin/inventory"
              className="management-card"
            >
              <span>▤</span>

              <div>
                <strong>
                  Inventory
                </strong>

                <small>
                  Monitor stock levels
                </small>
              </div>

              <b>→</b>
            </Link>
          </div>
        </section>

        <footer className="admin-footer">
          <span>
            PrintHub Admin Panel
          </span>

          <span>
            Secure administrator session
          </span>
        </footer>
      </section>
    </main>
  );
}