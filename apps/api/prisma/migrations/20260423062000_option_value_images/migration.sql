-- Add media metadata fields for product option values
ALTER TABLE "ProductOptionValue"
ADD COLUMN "imageUrl" TEXT,
ADD COLUMN "storageKey" TEXT,
ADD COLUMN "altText" TEXT;
