CREATE TABLE "CustomerArtwork" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "orderItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerArtwork_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerArtwork_storageKey_key" ON "CustomerArtwork"("storageKey");
CREATE UNIQUE INDEX "CustomerArtwork_orderItemId_key" ON "CustomerArtwork"("orderItemId");
CREATE INDEX "CustomerArtwork_userId_createdAt_idx" ON "CustomerArtwork"("userId", "createdAt");
CREATE INDEX "CustomerArtwork_productId_idx" ON "CustomerArtwork"("productId");

ALTER TABLE "CustomerArtwork"
    ADD CONSTRAINT "CustomerArtwork_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerArtwork"
    ADD CONSTRAINT "CustomerArtwork_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerArtwork"
    ADD CONSTRAINT "CustomerArtwork_orderItemId_fkey"
    FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
