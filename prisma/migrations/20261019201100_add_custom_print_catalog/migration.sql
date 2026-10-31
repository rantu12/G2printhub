-- CreateTable
CREATE TABLE "CustomPrintCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomPrintCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomPrintProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "colors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sizes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "options" JSONB,
    "printAreas" JSONB,
    "customizationSettings" JSONB,
    "price" DECIMAL(10,2) NOT NULL,
    "salePrice" DECIMAL(10,2),
    "stock" INTEGER NOT NULL DEFAULT 0,
    "availability" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomPrintProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomPrintProductAngleImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomPrintProductAngleImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomPrintArtwork" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "fileName" TEXT,
    "contentType" TEXT,
    "fileSize" INTEGER,
    "storageKey" TEXT,
    "designConfiguration" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomPrintArtwork_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomPrintCategory_name_key" ON "CustomPrintCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CustomPrintCategory_slug_key" ON "CustomPrintCategory"("slug");

-- CreateIndex
CREATE INDEX "CustomPrintCategory_active_sortOrder_idx" ON "CustomPrintCategory"("active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CustomPrintProduct_slug_key" ON "CustomPrintProduct"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CustomPrintProduct_sku_key" ON "CustomPrintProduct"("sku");

-- CreateIndex
CREATE INDEX "CustomPrintProduct_categoryId_active_sortOrder_idx" ON "CustomPrintProduct"("categoryId", "active", "sortOrder");

-- CreateIndex
CREATE INDEX "CustomPrintProduct_active_availability_idx" ON "CustomPrintProduct"("active", "availability");

-- CreateIndex
CREATE INDEX "CustomPrintProduct_createdAt_idx" ON "CustomPrintProduct"("createdAt");

-- CreateIndex
CREATE INDEX "CustomPrintProductAngleImage_productId_sortOrder_idx" ON "CustomPrintProductAngleImage"("productId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CustomPrintArtwork_storageKey_key" ON "CustomPrintArtwork"("storageKey");

-- CreateIndex
CREATE INDEX "CustomPrintArtwork_userId_createdAt_idx" ON "CustomPrintArtwork"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomPrintArtwork_productId_idx" ON "CustomPrintArtwork"("productId");

-- AddForeignKey
ALTER TABLE "CustomPrintProduct" ADD CONSTRAINT "CustomPrintProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CustomPrintCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomPrintProductAngleImage" ADD CONSTRAINT "CustomPrintProductAngleImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CustomPrintProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomPrintArtwork" ADD CONSTRAINT "CustomPrintArtwork_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomPrintArtwork" ADD CONSTRAINT "CustomPrintArtwork_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CustomPrintProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
