"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const faqs = [
  {
    category: "Orders & Tracking",
    question: "Where can I find my order status?",
    answer:
      "Sign in and open Orders from the site navigation to see your order history and the latest status available.",
  },
  {
    category: "Orders & Tracking",
    question: "How do I find my tracking number?",
    answer:
      "When tracking information is added to your order, it appears in your order details. If it is not listed, submit a support request with your order ID.",
  },
  {
    category: "Orders & Tracking",
    question: "Can I change an order after placing it?",
    answer:
      "Contact support as soon as possible with your order ID. Changes may not be possible once an order is being prepared.",
  },
  {
    category: "Payments",
    question: "Which payment methods can I use?",
    answer:
      "Available payment methods are shown at checkout and depend on the store's current settings.",
  },
  {
    category: "Payments",
    question: "What should I do if an online payment fails?",
    answer:
      "Check your order status before trying again. If the payment or order status is unclear, contact support and include your order ID.",
  },
  {
    category: "Cash on Delivery",
    question: "Is Cash on Delivery available?",
    answer:
      "Cash on Delivery is available only when the option is displayed at checkout.",
  },
  {
    category: "Cash on Delivery",
    question: "When do I pay for a Cash on Delivery order?",
    answer:
      "If Cash on Delivery is offered and selected at checkout, payment is collected when the order is delivered.",
  },
  {
    category: "Delivery",
    question: "Where does G2 PrintHub deliver?",
    answer:
      "Delivery options and address requirements are shown during checkout. Enter your complete delivery address to place an order.",
  },
  {
    category: "Delivery",
    question: "My order is delayed. What should I do?",
    answer:
      "Check your order details for the latest status and tracking information. If you need more help, contact support with your order ID.",
  },
  {
    category: "Returns & Refunds",
    question: "How can I request help with a return or refund?",
    answer:
      "Submit a support request with your order ID and explain the issue. The support team can review your order and advise on next steps.",
  },
  {
    category: "Returns & Refunds",
    question: "How long does a refund take?",
    answer:
      "Refund handling depends on the order and payment provider. Contact support with your order ID for information about your case.",
  },
  {
    category: "Account & Login",
    question: "I cannot sign in. What can I do?",
    answer:
      "Check that you are using the email address associated with your account. If you still cannot sign in, submit a support request.",
  },
  {
    category: "Account & Login",
    question: "How do I update my account details?",
    answer:
      "Sign in and open My Account to review and edit the profile details available for your account.",
  },
  {
    category: "Custom Printing",
    question: "How do I order a custom print?",
    answer:
      "Browse the products, choose the options shown on the product page, and provide any requested artwork or personalization details.",
  },
  {
    category: "Custom Printing",
    question: "Can I upload my own artwork?",
    answer:
      "Some products support customer artwork. Product pages show whether artwork can be uploaded and any related requirements.",
  },
];

const categories = [
  "All topics",
  "Orders & Tracking",
  "Payments",
  "Cash on Delivery",
  "Delivery",
  "Returns & Refunds",
  "Account & Login",
  "Custom Printing",
];

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All topics");
  const filteredFaqs = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return faqs.filter((faq) => {
      const matchesCategory =
        category === "All topics" || faq.category === category;
      const matchesQuery =
        !normalizedQuery ||
        `${faq.category} ${faq.question} ${faq.answer}`
          .toLocaleLowerCase()
          .includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [category, query]);

  return (
    <main className="help-center">
      <div className="help-center-shell">
        <header className="help-center-header">
          <span className="help-center-eyebrow">PRINT HUB HELP</span>
          <h1>How can we help?</h1>
          <p>Search answers about orders, payments, delivery, and printing.</p>
          <label className="help-search">
            <span className="visually-hidden">Search help articles</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search questions..."
            />
          </label>
        </header>

        <nav className="help-categories" aria-label="Help categories">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              className={category === item ? "is-active" : ""}
              aria-pressed={category === item}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </nav>

        <section className="help-faq-list" aria-label="Frequently asked questions">
          {filteredFaqs.length ? (
            filteredFaqs.map((faq) => (
              <details className="help-faq" key={faq.question}>
                <summary>
                  <span className="help-faq-category">{faq.category}</span>
                  <span>{faq.question}</span>
                  <span className="help-faq-toggle" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p>{faq.answer}</p>
              </details>
            ))
          ) : (
            <p className="help-empty">
              No answers matched your search. Try another phrase or contact
              support.
            </p>
          )}
        </section>

        <aside className="help-contact">
          <div>
            <h2>Still need help?</h2>
            <p>Send our team a support request and we&apos;ll follow up.</p>
          </div>
          <Link href="/support">Contact support</Link>
        </aside>
      </div>
    </main>
  );
}
