ALTER TABLE "ProductReview"
ADD COLUMN "name" TEXT,
ADD COLUMN "email" TEXT;

UPDATE "ProductReview"
SET "name" = "User"."name",
    "email" = "User"."email"
FROM "User"
WHERE "ProductReview"."userId" = "User"."id";

ALTER TABLE "ProductReview"
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "email" SET NOT NULL;
