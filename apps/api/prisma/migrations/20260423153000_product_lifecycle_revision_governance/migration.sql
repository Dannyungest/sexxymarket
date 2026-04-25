-- CreateEnum
CREATE TYPE "ProductAuthoringStatus" AS ENUM ('DRAFT', 'READY_FOR_REVIEW', 'PUBLISHED');

-- AlterTable
ALTER TABLE "Product"
ADD COLUMN "authoringStatus" "ProductAuthoringStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "publishedAt" TIMESTAMP(3),
ADD COLUMN "lastSavedAt" TIMESTAMP(3),
ADD COLUMN "autosaveVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ProductRevision" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "metadata" JSONB,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductRevision_productId_revisionNumber_key" ON "ProductRevision"("productId", "revisionNumber");

-- CreateIndex
CREATE INDEX "ProductRevision_productId_createdAt_idx" ON "ProductRevision"("productId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProductRevision" ADD CONSTRAINT "ProductRevision_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
