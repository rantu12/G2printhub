import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CustomersTable from "./customers-table";
import type { Prisma } from "@/app/generated/prisma/client";

const PAGE_SIZE = 50;

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const rawSearch = typeof params.q === "string" ? params.q.trim() : "";
  const search = rawSearch.slice(0, 100);
  const status =
    params.status === "active" || params.status === "blocked"
      ? params.status
      : "all";
  const requestedPage = Number(params.page);
  const requestedPageNumber =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
  const user = await getCurrentUser();

  if (!user) {
    redirect("/admin/login");
  }

  if (user.role !== "ADMIN") {
    redirect("/account");
  }

  const customerWhere: Prisma.UserWhereInput = {
    role: "CUSTOMER",
    ...(status === "all" ? {} : { isBlocked: status === "blocked" }),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
            {
              orders: {
                some: {
                  customerPhone: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              },
            },
          ],
        }
      : {}),
  };
  const [
    customerCount,
    activeCount,
    blockedCount,
    customerOrderCount,
  ] = await Promise.all([
    prisma.user.count({ where: customerWhere }),
    prisma.user.count({ where: { role: "CUSTOMER", isBlocked: false } }),
    prisma.user.count({ where: { role: "CUSTOMER", isBlocked: true } }),
    prisma.order.count({ where: { user: { role: "CUSTOMER" } } }),
  ]);
  const pageCount = Math.max(1, Math.ceil(customerCount / PAGE_SIZE));
  const page = Math.min(requestedPageNumber, pageCount);
  const customers = await prisma.user.findMany({
    where: customerWhere,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      isBlocked: true,
      createdAt: true,
      orders: {
        select: {
          customerPhone: true,
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      _count: {
        select: {
          orders: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  return (
    <main className="admin-products-page">
      <div className="admin-page-shell">
        <header className="admin-page-header">
          <div>
            <div className="admin-breadcrumb">
              <Link href="/admin">Dashboard</Link>
              <span>/</span>
              <span>Customers</span>
            </div>
            <h1>Customers</h1>
            <p>
              View customer activity and manage account access in one place.
            </p>
          </div>

          <div className="admin-header-actions">
            <Link href="/admin" className="admin-secondary-button">
              ← Dashboard
            </Link>
          </div>
        </header>

        <section className="admin-products-card admin-customers-card">
          {customers.length === 0 ? (
            <div className="admin-empty-state">
              <div className="admin-empty-icon">♙</div>
              <h3>{search || status !== "all" ? "No matching customers" : "No customers yet"}</h3>
              <p>
                {search || status !== "all"
                  ? "Adjust your search or account-status filter."
                  : "Customer accounts will appear here when they register."}
              </p>
            </div>
          ) : (
            <CustomersTable
              search={search}
              statusFilter={status}
              summary={{
                total: activeCount + blockedCount,
                active: activeCount,
                blocked: blockedCount,
                orders: customerOrderCount,
              }}
              customers={customers.map((customer) => ({
                id: customer.id,
                name: customer.name,
                email: customer.email,
                isBlocked: customer.isBlocked,
                createdAt: customer.createdAt.toISOString(),
                phone:
                  customer.phone ??
                  customer.orders[0]?.customerPhone ??
                  null,
                orderCount: customer._count.orders,
              }))}
            />
          )}
        </section>
        <nav className="admin-header-actions" aria-label="Customer pages">
          <span>
            Page {page} of {pageCount} · {customerCount} matching customers
          </span>
          {page > 1 && (
            <Link
              href={`/admin/customers?${new URLSearchParams({
                q: search,
                status,
                page: String(page - 1),
              })}`}
              className="admin-secondary-button"
            >
              Previous
            </Link>
          )}
          {page < pageCount && (
            <Link
              href={`/admin/customers?${new URLSearchParams({
                q: search,
                status,
                page: String(page + 1),
              })}`}
              className="admin-secondary-button"
            >
              Next
            </Link>
          )}
        </nav>
      </div>
    </main>
  );
}
