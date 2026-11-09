import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PrintButton from "../../print-button";

type InvoicePageProps = {
  params: Promise<{ id: string }>;
};

function formatPrice(value: number) {
  return `₹${value.toFixed(2)}`;
}

export default async function AdminOrderInvoicePage({
  params,
}: InvoicePageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/admin/login");
  }

  if (user.role !== "ADMIN") {
    redirect("/account");
  }

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
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
        },
      },
    },
  });

  if (!order) {
    notFound();
  }

  return (
    <main className="invoice-page">
      <div className="invoice-toolbar">
        <Link href="/admin/orders" className="admin-secondary-button">
          ← Back to orders
        </Link>
        <PrintButton />
      </div>

      <article className="invoice-sheet">
        <header className="invoice-header">
          <div>
            <p className="invoice-brand">PrintHub</p>
            <p className="invoice-tagline">Made personal. Printed with care.</p>
          </div>
          <div className="invoice-title">
            <h1>INVOICE</h1>
            <p>{order.orderNumber}</p>
          </div>
        </header>

        <div className="invoice-meta">
          <div>
            <span>Invoice date</span>
            <strong>
              {new Intl.DateTimeFormat("en", {
                dateStyle: "medium",
              }).format(order.createdAt)}
            </strong>
          </div>
          <div>
            <span>Order status</span>
            <strong>{order.status}</strong>
          </div>
          <div>
            <span>Payment</span>
            <strong>
              {order.paymentMethod} · {order.paymentStatus}
            </strong>
          </div>
        </div>

        <section className="invoice-customer">
          <div>
            <h2>Bill to</h2>
            <strong>{order.customerName}</strong>
            <p>{order.customerEmail}</p>
            <p>{order.customerPhone}</p>
          </div>
          <div>
            <h2>Deliver to</h2>
            <p>{order.shippingAddress}</p>
            {order.shippingAddress2 && <p>{order.shippingAddress2}</p>}
            <p>
              {[order.city, order.state, order.postalCode]
                .filter(Boolean)
                .join(", ")}
            </p>
            <p>{order.country}</p>
          </div>
        </section>

        <table className="invoice-items-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>SKU</th>
              <th>Variant</th>
              <th>Qty</th>
              <th>Unit price</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, index) => (
              <tr key={`${order.orderNumber}-${item.sku ?? item.productName}-${index}`}>
                <td>{item.productName}</td>
                <td>{item.sku ?? "—"}</td>
                <td>
                  {[item.selectedColor, item.selectedSize]
                    .filter(Boolean)
                    .join(" / ") || "—"}
                </td>
                <td>{item.quantity}</td>
                <td>{formatPrice(Number(item.unitPrice))}</td>
                <td>{formatPrice(Number(item.lineTotal))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="invoice-totals">
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
          <div className="invoice-total">
            <dt>Total</dt>
            <dd>{formatPrice(Number(order.total))}</dd>
          </div>
        </dl>

        <footer className="invoice-footer">
          Thank you for choosing PrintHub.
        </footer>
      </article>
    </main>
  );
}
