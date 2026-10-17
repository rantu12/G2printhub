UPDATE "Product"
SET "colors" = ARRAY['Black', 'White', 'Red', 'Blue', 'Pink', 'Green']::TEXT[]
WHERE cardinality("colors") = 0;
