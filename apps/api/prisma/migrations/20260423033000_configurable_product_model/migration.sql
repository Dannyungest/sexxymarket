-- Add configurable product structures and richer media metadata
ALTER TABLE "Product" ADD COLUMN "variationGuide" TEXT;

ALTER TABLE "ProductImage"
  ADD COLUMN "storageKey" TEXT,
  ADD COLUMN "altText" TEXT,
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "variantId" TEXT;

ALTER TABLE "ProductVariant"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "ProductOption" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "displayType" TEXT NOT NULL DEFAULT 'TEXT',
  "guideText" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductOptionValue" (
  "id" TEXT NOT NULL,
  "optionId" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "code" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductOptionValue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductVariantValue" (
  "id" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "optionValueId" TEXT NOT NULL,
  CONSTRAINT "ProductVariantValue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage"("productId", "sortOrder");
CREATE INDEX "ProductVariant_productId_isActive_idx" ON "ProductVariant"("productId", "isActive");
CREATE INDEX "ProductOption_productId_sortOrder_idx" ON "ProductOption"("productId", "sortOrder");
CREATE INDEX "ProductOptionValue_optionId_sortOrder_idx" ON "ProductOptionValue"("optionId", "sortOrder");
CREATE INDEX "ProductVariantValue_optionValueId_idx" ON "ProductVariantValue"("optionValueId");

CREATE UNIQUE INDEX "ProductVariant_productId_sku_key" ON "ProductVariant"("productId", "sku");
CREATE UNIQUE INDEX "ProductOptionValue_optionId_value_key" ON "ProductOptionValue"("optionId", "value");
CREATE UNIQUE INDEX "ProductVariantValue_variantId_optionValueId_key" ON "ProductVariantValue"("variantId", "optionValueId");

ALTER TABLE "ProductImage"
  ADD CONSTRAINT "ProductImage_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductOption"
  ADD CONSTRAINT "ProductOption_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductOptionValue"
  ADD CONSTRAINT "ProductOptionValue_optionId_fkey"
  FOREIGN KEY ("optionId") REFERENCES "ProductOption"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductVariantValue"
  ADD CONSTRAINT "ProductVariantValue_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductVariantValue"
  ADD CONSTRAINT "ProductVariantValue_optionValueId_fkey"
  FOREIGN KEY ("optionValueId") REFERENCES "ProductOptionValue"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
