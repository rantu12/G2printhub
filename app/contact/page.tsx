import Link from "next/link";

export default function ContactPage() {
  return (
    <main className="info-page">
      <div className="info-page-shell">
        <header className="info-page-header">
          <span className="info-page-eyebrow">PRINT HUB SUPPORT</span>
          <h1>Contact us</h1>
          <p>
            Need help with an order or choosing a product? Find the details you
            need below.
          </p>
        </header>

        <div className="info-page-content">
          <section className="info-page-section">
            <h2>Questions about an order?</h2>
            <p>
              Visit your orders to review order details and have your order
              number ready when requesting help.
            </p>
            <Link href="/orders" className="help-button">
              View my orders
            </Link>
          </section>

          <section className="info-page-section">
            <h2>Product questions?</h2>
            <p>
              Browse the available products and their details before placing
              your order.
            </p>
            <Link href="/products" className="help-button">
              Browse products
            </Link>
          </section>

          <section className="info-page-section">
            <h2>Direct support</h2>
            <p>
              Support contact details have not been published yet. Please
              contact the store administrator for help.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
