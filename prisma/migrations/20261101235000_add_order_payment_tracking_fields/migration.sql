ALTER TABLE "OrderItem"
ADD COLUMN "idempotencyKey" TEXT,
ADD COLUMN "paymentSessionId" TEXT;
