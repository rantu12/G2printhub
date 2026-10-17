ALTER TABLE "Category"
ADD COLUMN "parentCategoryId" TEXT;

CREATE INDEX "Category_parentCategoryId_idx"
ON "Category"("parentCategoryId");

ALTER TABLE "Category"
ADD CONSTRAINT "Category_parentCategoryId_fkey"
FOREIGN KEY ("parentCategoryId") REFERENCES "Category"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
