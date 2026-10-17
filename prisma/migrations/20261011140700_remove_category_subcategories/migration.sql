DELETE FROM "CustomerArtwork"
WHERE "productId" IN (
  SELECT product."id"
  FROM "Product" AS product
  INNER JOIN "Category" AS category
    ON category."id" = product."categoryId"
  WHERE category."parentCategoryId" IS NOT NULL
);

DELETE FROM "Product"
WHERE "categoryId" IN (
  SELECT "id"
  FROM "Category"
  WHERE "parentCategoryId" IS NOT NULL
);

DELETE FROM "Category"
WHERE "parentCategoryId" IS NOT NULL;

ALTER TABLE "Category"
DROP CONSTRAINT "Category_parentCategoryId_fkey";

DROP INDEX "Category_parentCategoryId_idx";

ALTER TABLE "Category"
DROP COLUMN "parentCategoryId";
