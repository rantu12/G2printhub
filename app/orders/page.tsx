import Link from "next/link";
import { getStoreSettings } from "@/lib/store-settings";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCustomPrintArtworkDownloads } from "@/lib/custom-print-artwork-downloads";

function formatPrice(value: number) {
  return `₹${value.toFixed(2)}`;
}

function statusClass(status: string) {
  return status === "REJECTED" || status === "CANCELLED"
    ? "status-badge status-inactive"
    : "status-badge status-active";
}

export default async function OrdersPage() {
  const storeSettings = await getStoreSettings();
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const orders = await prisma.order.findMany({
    where: {
      userId: user.id,
    },
    select: {
      id: true,
      orderNumber: true,
      total: true,
      subtotal: true,
      couponCode: true,
      discount: true,
      shippingFee: true,
      codFee: true,
      tax: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      trackingNumber: true,
      courierPartnerName: true,
      createdAt: true,
      items: {
        select: {
          productName: true,
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
            },
          },
          CustomPrintArtwork: {
            select: {
              id: true,
              fileName: true,
              contentType: true,
              designConfiguration: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <main className="account-page">
      <section className="account-content">
        <div className="account-welcome">
          <div>
            <span className="account-eyebrow">ORDER HISTORY</span>
            <h1>My Orders</h1>
            <p>Track the status and details of your PrintHub orders.</p>
          </div>
        </div>

        {orders.length === 0 ? (
          <section className="account-profile account-orders-empty">
            <h2>No orders yet</h2>
            <p>Your orders will appear here after you place an order.</p>
            <Link href="/" className="help-button">
              Browse products →
            </Link>
          </section>
        ) : (
          <div className="account-orders-list">
            {orders.map((order) => (
              <article className="account-order-card" key={order.id}>
                <header className="account-order-header">
                  <div>
                    <span className="account-eyebrow">ORDER</span>
                    <h2>{order.orderNumber}</h2>
                    <p>
                      {new Intl.DateTimeFormat("en", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: storeSettings.timeZone,
                      }).format(order.createdAt)}
                    </p>
                  </div>
                  <div className="account-order-statuses">
                    <span className={statusClass(order.status)}>
                      {order.status}
                    </span>
                    <span className="account-order-payment">
                      {order.paymentMethod} · {order.paymentStatus}
                    </span>
                  </div>
                </header>

                {(order.courierPartnerName || order.trackingNumber) && (
                  <div className="account-order-tracking">
                    {order.courierPartnerName && (
                      <>
                        <span>Courier partner</span>
                        <strong>{order.courierPartnerName}</strong>
                      </>
                    )}
                    {order.trackingNumber && (
                      <>
                        <span>Tracking number</span>
                        <strong>{order.trackingNumber}</strong>
                      </>
                    )}
                  </div>
                )}

                <section className="account-order-items">
                  {order.items.map((item, index) => (
                    <div
                      className="account-order-item"
                      key={`${order.id}-${item.sku ?? item.productName}-${index}`}
                    >
                      <div>
                        <strong>{item.productName}</strong>
                        <span>
                          {item.quantity} ×{" "}
                          {formatPrice(Number(item.unitPrice))}
                        </span>
                        {(item.selectedColor || item.selectedSize) && (
                          <span>
                            {[item.selectedColor, item.selectedSize]
                              .filter(Boolean)
                              .join(" / ")}
                          </span>
                        )}
                        {item.artwork?.fileName && (
                          <a
                            href={`/api/customer/artwork/${encodeURIComponent(item.artwork.id)}`}
                            className="account-order-artwork-link"
                          >
                            Print file: {item.artwork.fileName}
                          </a>
                        )}
                        {item.CustomPrintArtwork?.fileName && (
                          <>
                            <a
                              href={`/api/customer/custom-print-artwork/${encodeURIComponent(item.CustomPrintArtwork.id)}`}
                              className="account-order-artwork-link"
                            >
                              Download finished design: {item.CustomPrintArtwork.fileName}
                            </a>
                            {(() => {
                              const downloads = getCustomPrintArtworkDownloads(
                                item.CustomPrintArtwork.designConfiguration
                              );
                              return (
                                <>
                                  {downloads.original && (
                                    <a
                                      href={`/api/customer/custom-print-artwork/${encodeURIComponent(item.CustomPrintArtwork.id)}?file=original`}
                                      className="account-order-artwork-link"
                                    >
                                      Download original image: {downloads.original.fileName}
                                    </a>
                                  )}
                                  {downloads.model && (
                                    <a
                                      href={`/api/customer/custom-print-artwork/${encodeURIComponent(item.CustomPrintArtwork.id)}?file=model`}
                                      className="account-order-artwork-link"
                                    >
                                      Download 3D model (GLB): {downloads.model.fileName}
                                    </a>
                                  )}
                                </>
                              );
                            })()}
                          </>
                        )}
                      </div>
                      <strong>{formatPrice(Number(item.lineTotal))}</strong>
                    </div>
                  ))}
                </section>

                <dl className="account-order-totals">
                  <div>
                    <dt>Subtotal</dt>
                    <dd>{formatPrice(Number(order.subtotal))}</dd>
                  </div>
                  <div>
                    <dt>Shipping</dt>
                    <dd>{formatPrice(Number(order.shippingFee))}</dd>
                  </div>
                  {order.codFee.greaterThan(0) && (
                    <div>
                      <dt>Cash on Delivery fee</dt>
                      <dd>{formatPrice(Number(order.codFee))}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Tax</dt>
                    <dd>{formatPrice(Number(order.tax))}</dd>
                  </div>
                  {order.discount.greaterThan(0) && (
                    <div>
                      <dt>Discount{order.couponCode ? ` (${order.couponCode})` : ""}</dt>
                      <dd>−{formatPrice(Number(order.discount))}</dd>
                    </div>
                  )}
                  <div className="account-order-total">
                    <dt>Total</dt>
                    <dd>{formatPrice(Number(order.total))}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
