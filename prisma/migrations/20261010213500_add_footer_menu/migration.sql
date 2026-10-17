CREATE TABLE "FooterMenuItem" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FooterMenuItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FooterMenuItem_isActive_position_idx"
ON "FooterMenuItem"("isActive", "position");

INSERT INTO "FooterMenuItem" ("id", "label", "href", "position", "updatedAt")
VALUES
    ('footer-home', 'Home', '/', 0, CURRENT_TIMESTAMP),
    ('footer-products', 'Products', '/products', 1, CURRENT_TIMESTAMP),
    ('footer-orders', 'My Orders', '/orders', 2, CURRENT_TIMESTAMP),
    ('footer-cart', 'Cart', '/cart', 3, CURRENT_TIMESTAMP),
    ('footer-account', 'My Account', '/account', 4, CURRENT_TIMESTAMP);
