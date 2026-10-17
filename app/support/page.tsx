import Link from "next/link";
import SupportForm from "./support-form";

export default function SupportPage() {
  return (
    <main className="support-page">
      <div className="support-page-shell">
        <header className="support-page-header">
          <span className="help-center-eyebrow">CUSTOMER SUPPORT</span>
          <h1>How can we help?</h1>
          <p>
            Tell us what you need help with. Include your order ID if your
            question is about an order.
          </p>
          <Link href="/help">Browse the Help Center</Link>
        </header>
        <SupportForm />
      </div>
    </main>
  );
}
