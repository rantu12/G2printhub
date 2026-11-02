import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ReportRange = "7" | "30" | "90";

function getReportRange(value: string | string[] | undefined): ReportRange {
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

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string | string[] }>;
}) {
  const [{ range: requestedRange }, user] = await Promise.all([
    searchParams,
    getCurrentUser(),
  ]);
  const range = getReportRange(requestedRange);

  if (!user) redirect("/admin/login");
  if (user.role !== "ADMIN") redirect("/account");

  const endDate = new Date();
  endDate.setHours(0, 0, 0, 0);
  endDate.setDate(endDate.getDate() + 1);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - Number(range));

  const createdAt = { gte: startDate, lt: endDate };
  const [
    orderCount,
    paidOrderCount,
    paidRevenue,
    pendingOrderCount,
    shippedOrderCount,
    deliveredOrderCount,
    cancelledOrderCount,
    recentOrders,
  ] = await Promise.all([
    prisma.order.count({ where: { createdAt } }),
    prisma.order.count({ where: { createdAt, paymentStatus: "PAID" } }),
    prisma.order.aggregate({
      where: { createdAt, paymentStatus: "PAID" },
      _sum: { total: true },
    }),
    prisma.order.count({ where: { createdAt, status: "PENDING" } }),
    prisma.order.count({ where: { createdAt, status: "SHIPPED" } }),
    prisma.order.count({ where: { createdAt, status: "DELIVERED" } }),
    prisma.order.count({
      where: { createdAt, status: { in: ["CANCELLED", "REJECTED"] } },
    }),
    prisma.order.findMany({
      where: { createdAt },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        total: true,
        status: true,
        paymentStatus: true,
        createdAt: true,
      },
    }),
  ]);

  const revenue = Number(paidRevenue._sum.total ?? 0);
  const averageOrderValue = paidOrderCount === 0 ? 0 : revenue / paidOrderCount;

  return (
    <main className="admin-products-page">
      <div className="admin-page-shell">
        <header className="admin-page-header">
          <div>
            <div className="admin-breadcrumb">
              <Link href="/admin">Dashboard</Link>
              <span>/</span>
              <span>Reports</span>
            </div>
            <h1>Reports</h1>
            <p>Review sales and order activity for the selected period.</p>
          </div>
          <div className="admin-header-actions">
            <Link href="/admin" className="admin-secondary-button">
              ← Dashboard
            </Link>
          </div>
        </header>

        <nav className="admin-header-actions" aria-label="Report date range">
          {(["7", "30", "90"] as const).map((days) => (
            <Link
              key={days}
              href={`/admin/reports?range=${days}`}
              className={
                range === days
                  ? "admin-primary-button"
                  : "admin-secondary-button"
              }
              aria-current={range === days ? "page" : undefined}
            >
              Last {days} days
            </Link>
          ))}
        </nav>

        <section className="admin-stats" aria-label="Sales summary">
          <article className="admin-stat-card">
            <span className="admin-stat-title">Orders</span>
            <strong>{orderCount}</strong>
            <small>Placed in the selected period</small>
          </article>
          <article className="admin-stat-card">
            <span className="admin-stat-title">Paid revenue</span>
            <strong>{formatCurrency(revenue)}</strong>
            <small>{paidOrderCount} paid orders</small>
          </article>
          <article className="admin-stat-card">
            <span className="admin-stat-title">Average paid order</span>
            <strong>{formatCurrency(averageOrderValue)}</strong>
            <small>Based on paid orders</small>
          </article>
          <article className="admin-stat-card">
            <span className="admin-stat-title">Pending fulfillment</span>
            <strong>{pendingOrderCount}</strong>
            <small>Orders awaiting processing</small>
          </article>
        </section>

        <section className="admin-products-card admin-customers-card">
          <div className="admin-customer-metrics">
            <div className="admin-customer-metric">
              <div>
                <span>Shipped</span>
                <strong>{shippedOrderCount}</strong>
              </div>
            </div>
            <div className="admin-customer-metric">
              <div>
                <span>Delivered</span>
                <strong>{deliveredOrderCount}</strong>
              </div>
            </div>
            <div className="admin-customer-metric">
              <div>
                <span>Cancelled / rejected</span>
                <strong>{cancelledOrderCount}</strong>
              </div>
            </div>
          </div>

          <div className="admin-products-toolbar">
            <div>
              <strong>Recent orders</strong>
              <div className="admin-products-count">
                Latest 10 orders in the selected period
              </div>
            </div>
            <Link href="/admin/orders" className="admin-secondary-button">
              View all orders
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className="admin-empty-state">
              <h3>No orders in this period</h3>
              <p>Orders will appear here when customers place them.</p>
            </div>
          ) : (
            <div className="admin-table-wrapper">
              <table className="admin-products-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Payment</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id}>
                      <td>{order.orderNumber}</td>
                      <td>{order.customerName}</td>
                      <td>{formatDate(order.createdAt)}</td>
                      <td>{order.status}</td>
                      <td>{order.paymentStatus}</td>
                      <td>{formatCurrency(Number(order.total))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
