"use client";

import { useState } from "react";

type ArtworkControlsProps = {
  artworkId: string;
  fileName: string | null;
  contentType: string | null;
  pdfPassword: string | null;
};

export default function ArtworkControls({
  artworkId,
  fileName,
  contentType,
  pdfPassword,
}: ArtworkControlsProps) {
  const [showPassword, setShowPassword] = useState(true);
  const inlineUrl = `/api/customer/artwork/${encodeURIComponent(artworkId)}?inline=1`;

  return (
    <div className="admin-order-artwork-controls">
      {pdfPassword && (
        <div className="admin-order-pdf-password">
          <small>
            PDF password: <span>{showPassword ? pdfPassword : "Hidden"}</span>
          </small>
          <button
            type="button"
            className="admin-order-password-toggle"
            aria-label={`${showPassword ? "Hide" : "Show"} PDF password`}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((visible) => !visible)}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      )}
      {fileName && contentType === "image/jpeg" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="admin-order-artwork-preview"
          src={inlineUrl}
          alt={`Customer artwork: ${fileName}`}
        />
      )}
      {fileName && (
        <div className="admin-order-artwork-actions">
          {contentType === "application/pdf" && (
            <a
              href={inlineUrl}
              className="admin-order-artwork-link admin-order-artwork-button"
              target="_blank"
              rel="noreferrer"
            >
              View PDF
            </a>
          )}
          <a
            href={`/api/customer/artwork/${encodeURIComponent(artworkId)}`}
            className="admin-order-artwork-link admin-order-artwork-button"
          >
            Download original
          </a>
        </div>
      )}
      {!fileName && <small>No artwork file attached.</small>}
    </div>
  );
}
