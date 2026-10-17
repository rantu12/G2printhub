import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function formatFileSize(size: number | null) {
  if (size === null) return null;
  return size >= 1024 * 1024
    ? `${(size / (1024 * 1024)).toFixed(2)} MB`
    : `${(size / 1024).toFixed(1)} KB`;
}

export default async function DesignsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const designs = await prisma.customerArtwork.findMany({
    where: {
      userId: user.id,
      orderItemId: null,
    },
    select: {
      id: true,
      fileName: true,
      contentType: true,
      fileSize: true,
      createdAt: true,
      product: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return (
    <main className="account-page">
      <section className="account-content">
        <div className="account-welcome">
          <div>
            <span className="account-eyebrow">YOUR PRINT FILES</span>
            <h1>Saved Designs</h1>
            <p>
              View artwork you have saved for products. Saved files are private
              to your account.
            </p>
          </div>
        </div>

        {designs.length === 0 ? (
          <section className="account-profile account-orders-empty">
            <h2>No saved designs yet</h2>
            <p>
              Upload a JPG or PDF while personalizing a product, and it will
              appear here.
            </p>
            <Link href="/products" className="help-button">
              Browse products →
            </Link>
          </section>
        ) : (
          <div className="account-designs-list">
            {designs.map((design) => (
              <article className="account-design-card" key={design.id}>
                <div className="account-design-file-icon" aria-hidden="true">
                  {design.contentType === "application/pdf" ? "PDF" : "JPG"}
                </div>
                <div className="account-design-details">
                  <span className="account-eyebrow">{design.product.name}</span>
                  <h2>{design.fileName ?? "Saved product customization"}</h2>
                  <p>
                    Saved{" "}
                    {new Intl.DateTimeFormat("en", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(design.createdAt)}
                    {formatFileSize(design.fileSize)
                      ? ` · ${formatFileSize(design.fileSize)}`
                      : ""}
                  </p>
                  <div className="account-design-actions">
                    {design.fileName && (
                      <>
                        <a
                          href={`/api/customer/artwork/${encodeURIComponent(design.id)}?inline=1`}
                          className="account-order-artwork-link"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Preview
                        </a>
                        <a
                          href={`/api/customer/artwork/${encodeURIComponent(design.id)}`}
                          className="account-order-artwork-link"
                        >
                          Download original
                        </a>
                      </>
                    )}
                    <Link
                      href={`/products/${encodeURIComponent(design.product.slug)}`}
                      className="account-order-artwork-link"
                    >
                      View product
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
