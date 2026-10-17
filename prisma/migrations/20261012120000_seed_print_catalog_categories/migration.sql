INSERT INTO "Category" ("id", "name", "slug", "description", "active", "createdAt", "updatedAt")
VALUES
  ('catalog-category-mobile-covers', 'Custom Mobile Covers', 'custom-mobile-covers', 'Custom printed mobile phone covers.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('catalog-category-printed-shirts', 'Printed T-Shirts', 'printed-t-shirts', 'Custom printed T-shirts and apparel.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('catalog-category-custom-mugs', 'Custom Mugs', 'custom-mugs', 'Personalized custom printed mugs.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('catalog-category-printed-caps', 'Printed Caps', 'printed-caps', 'Custom printed caps and hats.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('catalog-category-pvc-id-cards', 'PVC ID Cards', 'pvc-id-cards', 'Durable custom PVC identity cards.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('catalog-category-wall-clocks', 'Wall Clocks', 'wall-clocks', 'Personalized printed wall clocks.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('catalog-category-photo-frames', 'Photo Frames', 'photo-frames', 'Custom photo frames and prints.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('catalog-category-custom-gifts', 'Custom Gifts', 'custom-gifts', 'Personalized gifts for every occasion.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
