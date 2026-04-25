UPDATE "Product"
SET
  "authoringStatus" = 'PUBLISHED',
  "publishedAt" = COALESCE("publishedAt", NOW())
WHERE
  "isApproved" = true
  AND "isHidden" = false
  AND "authoringStatus" <> 'PUBLISHED';
