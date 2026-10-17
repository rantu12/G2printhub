"use client";

export default function PrintButton() {
  return (
    <button
      type="button"
      className="admin-secondary-button invoice-print-button"
      onClick={() => window.print()}
    >
      Print / Save as PDF
    </button>
  );
}
