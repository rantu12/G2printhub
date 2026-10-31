CREATE TABLE "CustomPrintModel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "modelType" TEXT NOT NULL,
    "modelUrl" TEXT NOT NULL,
    "printAreas" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomPrintModel_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CustomPrintProduct" ADD COLUMN "modelId" TEXT;

CREATE INDEX "CustomPrintModel_active_modelType_idx" ON "CustomPrintModel"("active", "modelType");

CREATE INDEX "CustomPrintProduct_modelId_idx" ON "CustomPrintProduct"("modelId");

ALTER TABLE "CustomPrintProduct" ADD CONSTRAINT "CustomPrintProduct_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "CustomPrintModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
