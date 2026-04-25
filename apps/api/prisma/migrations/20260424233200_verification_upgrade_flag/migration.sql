-- AlterTable
ALTER TABLE "MerchantProfile" ALTER COLUMN "businessAddress" SET DEFAULT '';

-- AlterTable
ALTER TABLE "MerchantVerification" ADD COLUMN     "isRegisteredBusinessUpgrade" BOOLEAN NOT NULL DEFAULT false;
