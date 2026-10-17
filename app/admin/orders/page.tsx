import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { decryptArtworkSecret } from "@/lib/artwork-secrets";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";
import ArtworkControls from "./artwork-controls";
import ClearOrdersControl from "./clear-orders-control";
import DeleteOrderControl from "./delete-order-control";
import OrderStatusControl from "./order-status-control";
import PaymentStatusControl from "./payment-status-control";
import TrackingNumberControl from "./tracking-number-control";

function formatPrice(value: number) {
  return `₹${value.toFixed(2)}`;
}

const PAGE_SIZE = 25;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[];
    status?: string | string[];
    payment?: string | string[];
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const requestedSearch = typeof params.q === "string" ? params.q.trim() : "";
  const search = requestedSearch.length <= 100
    ? requestedSearch
    : requestedSearch.slice(0, 100);
  const requestedStatus =
    typeof params.status === "string" ? params.status : "all";
  const requestedPayment =
    typeof params.payment === "string" ? params.payment : "all";
  const allowedStatuses = [
    "PENDING",
    "ACCEPTED",
    "SHIPPED",
    "DELIVERED",
    "REJECTED",
    "CANCELLED",
  ];
  const statusFilter = allowedStatuses.includes(requestedStatus)
    ? requestedStatus
    : "all";
  const paymentFilter = ["PAID", "UNPAID"].includes(requestedPayment)
    ? requestedPayment
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

  const orderWhere: Prisma.OrderWhereInput = {
    ...(search
      ? {
          OR: [
            { orderNumber: { contains: search, mode: "insensitive" } },
            { customerName: { contains: search, mode: "insensitive" } },
            { customerEmail: { contains: search, mode: "insensitive" } },
            { customerPhone: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    ...(paymentFilter !== "all" ? { paymentStatus: paymentFilter } : {}),
  };
  const [
    matchingOrderCount,
    orderCount,
    pendingOrders,
    unpaidOrders,
    deliveredOrders,
  ] =
    await Promise.all([
      prisma.order.count({ where: orderWhere }),
      prisma.order.count(),
      prisma.order.count({ where: { status: "PENDING" } }),
      prisma.order.count({ where: { paymentStatus: { not: "PAID" } } }),
      prisma.order.count({ where: { status: "DELIVERED" } }),
    ]);
  const pageCount = Math.max(1, Math.ceil(matchingOrderCount / PAGE_SIZE));
  const page = Math.min(requestedPageNumber, pageCount);
  const orders = await prisma.order.findMany({
    where: orderWhere,
    select: {
      id: true,
      userId: true,
      orderNumber: true,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      shippingAddress: true,
      shippingAddress2: true,
      city: true,
      state: true,
      postalCode: true,
      country: true,
      subtotal: true,
      couponCode: true,
      discount: true,
      shippingFee: true,
      codFee: true,
      tax: true,
      total: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      trackingNumber: true,
      courierPartnerName: true,
      customerNote: true,
      createdAt: true,
      items: {
        select: {
          productId: true,
          productName: true,
          productImage: true,
          sku: true,
          selectedColor: true,
          selectedSize: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
          artwork: {
            select: {
              id: true,
              fileName: true,
              contentType: true,
              pdfPasswordEncrypted: true,
            },
          },
          product: {
            select: {
              image: true,
              category: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const unassignedArtwork = await prisma.customerArtwork.findMany({
    where: { orderItemId: null },
    select: {
      id: true,
      userId: true,
      productId: true,
      fileName: true,
      contentType: true,
      fileSize: true,
      pdfPasswordEncrypted: true,
      createdAt: true,
      product: { select: { name: true, sku: true } },
      user: { select: { name: true, email: true, phone: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const unassignedArtworkWithSecrets = await Promise.all(
    unassignedArtwork.map(async (artwork) => ({
      ...artwork,
      pdfPassword: await decryptArtworkSecret(artwork.pdfPasswordEncrypted),
    }))
  );

  const uploadsByOrder = new Map<
    string,
    (typeof unassignedArtworkWithSecrets)[number][]
  >();
  const matchedUploadIds = new Set<string>();

  for (const artwork of unassignedArtworkWithSecrets) {
    const matchingOrder = orders
      .filter(
        (order) =>
          order.userId === artwork.userId &&
          order.createdAt >= artwork.createdAt &&
          order.items.some((item) => item.productId === artwork.productId)
      )
      .sort((first, second) =>
        first.createdAt.getTime() - second.createdAt.getTime()
      )[0];

    if (!matchingOrder) continue;

    const orderUploads = uploadsByOrder.get(matchingOrder.id) ?? [];
    orderUploads.push(artwork);
    uploadsByOrder.set(matchingOrder.id, orderUploads);
    matchedUploadIds.add(artwork.id);
  }

  const unmatchedArtwork = unassignedArtworkWithSecrets.filter(
    (artwork) => !matchedUploadIds.has(artwork.id)
  );

  const ordersWithArtworkSecrets = await Promise.all(
    orders.map(async (order) => ({
      ...order,
      items: await Promise.all(
        order.items.map(async (item) => ({
          ...item,
          artwork: item.artwork
            ? {
                id: item.artwork.id,
                fileName: item.artwork.fileName,
                contentType: item.artwork.contentType,
                pdfPassword: await decryptArtworkSecret(
                  item.artwork.pdfPasswordEncrypted
                ),
              }
            : null,
        }))
      ),
    }))
  );

  return (
    <main className="admin-products-page">
      <div className="admin-page-shell">
        <header className="admin-page-header">
          <div>
            <div className="admin-breadcrumb">
              <Link href="/admin">Dashboard</Link>
              <span>/</span>
              <span>Orders</span>
            </div>
            <h1>Orders</h1>
            <p>
              Review each order&apos;s items, delivery details, payment, and status.
            </p>
          </div>

          <div className="admin-header-actions">
            <ClearOrdersControl
              orderCount={orderCount}
              uploadCount={unassignedArtwork.length}
            />
            <Link href="/admin" className="admin-secondary-button">
              ← Dashboard
            </Link>
          </div>
        </header>

        <section className="admin-order-metrics" aria-label="Order overview">
          <article className="admin-order-metric">
            <span className="admin-order-metric-icon">◈</span>
            <div>
              <span>Total orders</span>
              <strong>{orderCount}</strong>
            </div>
          </article>
          <article className="admin-order-metric">
            <span className="admin-order-metric-icon is-pending">◷</span>
            <div>
              <span>Awaiting review</span>
              <strong>{pendingOrders}</strong>
            </div>
          </article>
          <article className="admin-order-metric">
            <span className="admin-order-metric-icon is-unpaid">₹</span>
            <div>
              <span>Payment due</span>
              <strong>{unpaidOrders}</strong>
            </div>
          </article>
          <article className="admin-order-metric">
            <span className="admin-order-metric-icon is-delivered">✓</span>
            <div>
              <span>Delivered</span>
              <strong>{deliveredOrders}</strong>
            </div>
          </article>
        </section>

        <form className="admin-orders-toolbar" method="GET">
          <label className="admin-orders-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              name="q"
              defaultValue={search}
              placeholder="Search order, customer, email or phone..."
              aria-label="Search orders"
            />
          </label>
          <label className="admin-orders-filter-field">
            <span>Order status</span>
            <select name="status" defaultValue={statusFilter}>
              <option value="all">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="SHIPPED">Shipped</option>
              <option value="DELIVERED">Delivered</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </label>
          <label className="admin-orders-filter-field">
            <span>Payment</span>
            <select name="payment" defaultValue={paymentFilter}>
              <option value="all">All payments</option>
              <option value="PAID">Paid</option>
              <option value="UNPAID">Unpaid</option>
            </select>
          </label>
          <button type="submit" className="admin-primary-button">
            Apply filters
          </button>
          {(search || statusFilter !== "all" || paymentFilter !== "all") && (
            <Link href="/admin/orders" className="admin-secondary-button">
              Clear
            </Link>
          )}
          <span className="admin-orders-result-count" aria-live="polite">
            Showing {orders.length} of {matchingOrderCount} matching orders
          </span>
        </form>
        {pageCount > 1 && (
          <nav className="admin-header-actions" aria-label="Order pages">
            <span>Page {page} of {pageCount}</span>
            {page > 1 && (
              <Link
                href={`/admin/orders?${new URLSearchParams({
                  q: search,
                  status: statusFilter,
                  payment: paymentFilter,
                  page: String(page - 1),
                })}`}
                className="admin-secondary-button"
              >
                Previous
              </Link>
            )}
            {page < pageCount && (
              <Link
                href={`/admin/orders?${new URLSearchParams({
                  q: search,
                  status: statusFilter,
                  payment: paymentFilter,
                  page: String(page + 1),
                })}`}
                className="admin-secondary-button"
              >
                Next
              </Link>
            )}
          </nav>
        )}

        {unmatchedArtwork.length > 0 && (
          <section className="admin-products-card admin-unassigned-artwork">
            <header className="admin-unassigned-artwork-header">
              <div>
                <h2>
                  <span className="admin-unassigned-artwork-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <path
                        d="M7 3.75h7l5 5v11.5H7a2 2 0 0 1-2-2v-12.5a2 2 0 0 1 2-2Z"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M14 4v5h5M8.5 13h7M8.5 16.5h7"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  Customer uploads
                </h2>
                <p>
                  Saved JPG/PDF files that have not yet been attached to an
                  order. The latest saved upload for a product is attached
                  automatically when that customer places an order for it.
                </p>
              </div>
              <span>{unmatchedArtwork.length}</span>
            </header>
            <div className="admin-unassigned-artwork-list">
              {unmatchedArtwork.map((artwork) => (
                <article
                  className="admin-unassigned-artwork-item"
                  key={artwork.id}
                >
                  <div className="admin-unassigned-artwork-details">
                    <div className="admin-unassigned-artwork-heading">
                      <div>
                        <strong>
                          <span aria-hidden="true" className="admin-upload-file-icon">
                            {artwork.contentType === "application/pdf"
                              ? "PDF"
                              : "JPG"}
                          </span>
                          {artwork.product.name}
                        </strong>
                        <small>SKU: {artwork.product.sku}</small>
                      </div>
                      <span>Awaiting order</span>
                    </div>
                    <dl className="admin-unassigned-artwork-metadata">
                      <div>
                        <dt>Customer</dt>
                        <dd>{artwork.user.name || "Name not provided"}</dd>
                      </div>
                      <div>
                        <dt>Email</dt>
                        <dd>{artwork.user.email}</dd>
                      </div>
                      <div>
                        <dt>Phone</dt>
                        <dd>{artwork.user.phone || "Not provided"}</dd>
                      </div>
                      <div>
                        <dt>File name</dt>
                        <dd>{artwork.fileName || "No file attached"}</dd>
                      </div>
                      <div>
                        <dt>File type</dt>
                        <dd>
                          {artwork.contentType === "application/pdf"
                            ? "PDF document"
                            : artwork.contentType === "image/jpeg"
                              ? "JPG image"
                              : "Unknown"}
                        </dd>
                      </div>
                      <div>
                        <dt>File size</dt>
                        <dd>
                          {artwork.fileSize === null
                            ? "Unavailable"
                            : artwork.fileSize >= 1024 * 1024
                              ? `${(artwork.fileSize / (1024 * 1024)).toFixed(2)} MB`
                              : `${(artwork.fileSize / 1024).toFixed(1)} KB`}
                        </dd>
                      </div>
                      <div>
                        <dt>Uploaded</dt>
                        <dd>
                          {new Intl.DateTimeFormat("en", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(artwork.createdAt)}
                        </dd>
                      </div>
                    </dl>
                    <ArtworkControls
                      artworkId={artwork.id}
                      fileName={artwork.fileName}
                      contentType={artwork.contentType}
                      pdfPassword={artwork.pdfPassword}
                    />
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="admin-products-card admin-orders-card">
          {orderCount === 0 ? (
            <div className="admin-empty-state">
              <div className="admin-empty-icon">◈</div>
              <h3>No orders yet</h3>
              <p>Customer orders will appear here when they are placed.</p>
            </div>
          ) : ordersWithArtworkSecrets.length === 0 ? (
            <div className="admin-empty-state">
              <div className="admin-empty-icon">⌕</div>
              <h3>No matching orders</h3>
              <p>Try a different search or adjust the order and payment filters.</p>
              <Link href="/admin/orders" className="admin-secondary-button">
                Clear filters
              </Link>
            </div>
          ) : (
            <div className="admin-order-list">
              {ordersWithArtworkSecrets.map((order) => (
                <article className="admin-order-card" key={order.id}>
                  <header className="admin-order-header">
                    <div>
                      <span className="admin-order-eyebrow">ORDER</span>
                      <h2>{order.orderNumber}</h2>
                      <p>
                        Placed{" "}
                        {new Intl.DateTimeFormat("en", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(order.createdAt)}
                      </p>
                      {uploadsByOrder.get(order.id)?.map((artwork) => (
                        <section
                          className="admin-order-customer-upload"
                          key={artwork.id}
                        >
                          <h3>Customer upload</h3>
                          <p>
                            {artwork.fileName || "No file attached"} ·{" "}
                            {artwork.contentType === "application/pdf"
                              ? "PDF"
                              : artwork.contentType === "image/jpeg"
                                ? "JPG"
                                : "Unknown file type"}
                            {artwork.fileSize !== null &&
                              ` · ${
                                artwork.fileSize >= 1024 * 1024
                                  ? `${(artwork.fileSize / (1024 * 1024)).toFixed(2)} MB`
                                  : `${(artwork.fileSize / 1024).toFixed(1)} KB`
                              }`}
                          </p>
                          <ArtworkControls
                            artworkId={artwork.id}
                            fileName={artwork.fileName}
                            contentType={artwork.contentType}
                            pdfPassword={artwork.pdfPassword}
                          />
                        </section>
                      ))}
                    </div>
                    <div className="admin-order-badges">
                      <Link
                        href={`/admin/orders/${order.id}/invoice`}
                        className="admin-secondary-button"
                      >
                        Invoice
                      </Link>
                      <OrderStatusControl
                        orderId={order.id}
                        initialStatus={order.status}
                      />
                      <PaymentStatusControl
                        orderId={order.id}
                        initialPaymentStatus={order.paymentStatus}
                      />
                      <TrackingNumberControl
                        orderId={order.id}
                        initialTrackingNumber={order.trackingNumber}
                        initialCourierPartnerName={order.courierPartnerName}
                      />
                      <DeleteOrderControl
                        orderId={order.id}
                        orderNumber={order.orderNumber}
                      />
                    </div>
                  </header>

                  <div className="admin-order-details">
                    <section className="admin-order-section">
                      <h3>Customer</h3>
                      <p><strong>{order.customerName}</strong></p>
                      <p>{order.customerEmail}</p>
                      <p>{order.customerPhone}</p>
                    </section>

                    <section className="admin-order-section">
                      <h3>Delivery address</h3>
                      <p>{order.shippingAddress}</p>
                      {order.shippingAddress2 && <p>{order.shippingAddress2}</p>}
                      <p>
                        {[order.city, order.state, order.postalCode]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                      <p>{order.country}</p>
                    </section>

                    <section className="admin-order-section">
                      <h3>Payment</h3>
                      <p>Method: {order.paymentMethod}</p>
                      <p>
                        Use the payment status control above to mark this order
                        paid or unpaid.
                      </p>
                    </section>
                  </div>

                  <section className="admin-order-items">
                    <h3>Items ({order.items.reduce(
                      (count, item) => count + item.quantity,
                      0
                    )})</h3>
                    {order.items.map((item, index) => (
                      <div
                        className="admin-order-item"
                        key={`${order.id}-${item.sku ?? item.productName}-${index}`}
                      >
                        <div className="admin-order-item-image">
                          {(item.product?.image ?? item.productImage) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.product?.image ?? item.productImage ?? ""}
                              alt={item.productName}
                            />
                          ) : (
                            <span aria-hidden="true">📦</span>
                          )}
                        </div>
                        <div>
                          <strong>{item.productName}</strong>
                          <small>
                            Category: {item.product?.category.name ?? "Unavailable"}
                          </small>
                          {item.sku && <small>SKU: {item.sku}</small>}
                          {(item.selectedColor || item.selectedSize) && (
                            <small>
                              {[item.selectedColor, item.selectedSize]
                                .filter(Boolean)
                                .join(" / ")}
                            </small>
                          )}
                          <small>
                            {item.quantity} × {formatPrice(Number(item.unitPrice))}
                          </small>
                          {item.artwork && (
                            <ArtworkControls
                              artworkId={item.artwork.id}
                              fileName={item.artwork.fileName}
                              contentType={item.artwork.contentType}
                              pdfPassword={item.artwork.pdfPassword}
                            />
                          )}
                        </div>
                        <strong>{formatPrice(Number(item.lineTotal))}</strong>
                      </div>
                    ))}
                  </section>

                  <div className="admin-order-footer">
                    {order.customerNote && (
                      <section className="admin-order-note">
                        <h3>Customer note</h3>
                        <p>{order.customerNote}</p>
                      </section>
                    )}
                    <dl className="admin-order-totals">
                      <div><dt>Subtotal</dt><dd>{formatPrice(Number(order.subtotal))}</dd></div>
                      <div><dt>Shipping</dt><dd>{formatPrice(Number(order.shippingFee))}</dd></div>
                      {order.codFee.greaterThan(0) && (
                        <div><dt>Cash on Delivery fee</dt><dd>{formatPrice(Number(order.codFee))}</dd></div>
                      )}
                      <div><dt>Tax</dt><dd>{formatPrice(Number(order.tax))}</dd></div>
                      {order.discount.greaterThan(0) && (
                        <div>
                          <dt>Discount{order.couponCode ? ` (${order.couponCode})` : ""}</dt>
                          <dd>−{formatPrice(Number(order.discount))}</dd>
                        </div>
                      )}
                      <div className="admin-order-grand-total">
                        <dt>Total</dt>
                        <dd>{formatPrice(Number(order.total))}</dd>
                      </div>
                    </dl>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
