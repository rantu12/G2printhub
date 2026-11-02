ALTER TABLE "StoreSettings"
ALTER COLUMN "siteName" SET DEFAULT 'G2 PrintHub';

UPDATE "StoreSettings"
SET "siteName" = 'G2 PrintHub'
WHERE "siteName" = 'PrintHub';
