import Link from "next/link";
import PrintButton from "@/app/admin/orders/print-button";

export type OrderInvoiceData = {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  shippingAddress2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
  subtotal: number;
  couponCode: string | null;
  discount: number;
  shippingFee: number;
  codFee: number;
  tax: number;
  total: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  createdAt: Date;
  items: Array<{
    productName: string;
    sku: string | null;
    selectedColor: string | null;
    selectedSize: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
};

export type InvoiceBranding = {
  siteName: string;
  siteLogo: string;
  timeZone: string;
  invoiceTitle: string;
  invoiceTagline: string;
  invoiceSellerName: string;
  invoiceGstin: string;
  invoicePan: string;
  invoiceAddress: string;
  invoiceContact: string;
  invoiceReturnPolicy: string;
};

type OrderInvoiceProps = {
  order: OrderInvoiceData;
  settings: InvoiceBranding;
  backHref: string;
  backLabel: string;
  download?: boolean;
};

function formatPrice(value: number) {
  return `₹${value.toFixed(2)}`;
}

export default function OrderInvoice({
  order,
  settings,
  backHref,
  backLabel,
  download = false,
}: OrderInvoiceProps) {
  const sellerName = settings.invoiceSellerName.trim() || settings.siteName;
  const invoiceDate = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: settings.timeZone,
  }).format(order.createdAt);

  return (
    <main className="invoice-page">
      <div className="invoice-toolbar">
        <Link href={backHref} className="admin-secondary-button">
          {backLabel}
        </Link>
        <div className="invoice-download-actions">
          <PrintButton
            label={download ? "Download invoice / PDF" : "Print / Save as PDF"}
          />
          {download && (
            <span>Choose “Save as PDF” in the print dialog.</span>
          )}
        </div>
      </div>

      <article className="invoice-sheet">
        <header className="invoice-header">
          <div className="invoice-seller">
            {settings.siteLogo && (
              <span
                className="invoice-logo"
                role="img"
                aria-label={`${sellerName} logo`}
                style={{
                  backgroundImage: `url("${settings.siteLogo.replaceAll('"', "%22")}")`,
                }}
              />
            )}
            <p className="invoice-brand">{sellerName}</p>
            {settings.invoiceTagline && (
              <p className="invoice-tagline">{settings.invoiceTagline}</p>
            )}
            {settings.invoiceAddress && (
              <p className="invoice-seller-detail">{settings.invoiceAddress}</p>
            )}
            {settings.invoiceContact && (
              <p className="invoice-seller-detail">{settings.invoiceContact}</p>
            )}
            {settings.invoiceGstin && (
              <p className="invoice-seller-detail">
                GSTIN: {settings.invoiceGstin}
              </p>
            )}
            {settings.invoicePan && (
              <p className="invoice-seller-detail">PAN: {settings.invoicePan}</p>
            )}
          </div>
          <div className="invoice-title">
            <h1>{settings.invoiceTitle || "Tax Invoice"}</h1>
            <p>Invoice number: {order.orderNumber}</p>
          </div>
        </header>

        <div className="invoice-meta">
          <div>
            <span>Order ID</span>
            <strong>{order.orderNumber}</strong>
          </div>
          <div>
            <span>Order date</span>
            <strong>{invoiceDate}</strong>
          </div>
          <div>
            <span>Invoice date</span>
            <strong>{invoiceDate}</strong>
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
            <h2>Ship to</h2>
            <p>{order.shippingAddress}</p>
            {order.shippingAddress2 && <p>{order.shippingAddress2}</p>}
            <p>
              {[order.city, order.state, order.postalCode]
                .filter(Boolean)
                .join(", ")}
            </p>
            <p>{order.country}</p>
            <p>Phone: {order.customerPhone}</p>
          </div>
        </section>

        <table className="invoice-items-table">
          <thead>
            <tr>
              <th>Product</th>
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
                <td>{formatPrice(item.unitPrice)}</td>
                <td>{formatPrice(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="invoice-totals">
          <div>
            <dt>Subtotal</dt>
            <dd>{formatPrice(order.subtotal)}</dd>
          </div>
          {order.discount > 0 && (
            <div>
              <dt>Discount{order.couponCode ? ` (${order.couponCode})` : ""}</dt>
              <dd>−{formatPrice(order.discount)}</dd>
            </div>
          )}
          <div>
            <dt>Shipping</dt>
            <dd>{formatPrice(order.shippingFee)}</dd>
          </div>
          {order.codFee > 0 && (
            <div>
              <dt>Cash on Delivery fee</dt>
              <dd>{formatPrice(order.codFee)}</dd>
            </div>
          )}
          <div>
            <dt>Tax</dt>
            <dd>{formatPrice(order.tax)}</dd>
          </div>
          <div className="invoice-total">
            <dt>Grand total</dt>
            <dd>{formatPrice(order.total)}</dd>
          </div>
        </dl>

        <footer className="invoice-footer">
          {settings.invoiceReturnPolicy ? (
            <p className="invoice-return-policy">{settings.invoiceReturnPolicy}</p>
          ) : null}
          <p>
            This is a computer-generated invoice. Thank you for shopping with{" "}
            {sellerName}.
          </p>
        </footer>
      </article>
    </main>
  );
}
