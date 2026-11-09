
"use client";

type PrintButtonProps = {
  label?: string;
};

export default function PrintButton({
  label = "Print / Save as PDF",
}: PrintButtonProps) {
  return (
    <button
      type="button"
      className="admin-secondary-button invoice-print-button"
      onClick={() => window.print()}
    >
      {label}
    </button>
  );
}
