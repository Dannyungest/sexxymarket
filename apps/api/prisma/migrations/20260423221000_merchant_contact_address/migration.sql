-- AlterTable
ALTER TABLE "MerchantProfile" ADD COLUMN     "contactAddress" TEXT NOT NULL DEFAULT '';

-- Backfill from legacy business address
UPDATE "MerchantProfile" SET "contactAddress" = "businessAddress";

ALTER TABLE "MerchantProfile" ALTER COLUMN "contactAddress" DROP DEFAULT;

