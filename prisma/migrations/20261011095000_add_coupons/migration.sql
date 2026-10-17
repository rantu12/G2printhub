CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" TEXT NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "minimumSubtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "maximumDiscount" DECIMAL(10,2),
    "usageLimit" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");
CREATE INDEX "Coupon_isActive_startsAt_endsAt_idx" ON "Coupon"("isActive", "startsAt", "endsAt");

ALTER TABLE "Order"
ADD COLUMN "couponId" TEXT,
ADD COLUMN "couponCode" TEXT,
ADD COLUMN "discount" DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE "Order"
ADD CONSTRAINT "Order_couponId_fkey"
FOREIGN KEY ("couponId") REFERENCES "Coupon"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
