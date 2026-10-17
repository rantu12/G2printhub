INSERT INTO "FooterMenuItem" ("id", "label", "href", "position", "updatedAt")
VALUES
    ('footer-about', 'About Us', '/about', 5, CURRENT_TIMESTAMP),
    ('footer-privacy', 'Privacy Policy', '/privacy', 6, CURRENT_TIMESTAMP),
    ('footer-terms', 'Terms of Service', '/terms', 7, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
