-- AlterEnum
ALTER TYPE "PaymentGateway" ADD VALUE 'MANUAL_CASH';
ALTER TYPE "PaymentGateway" ADD VALUE 'MANUAL_ONLINE';

-- AlterTable User
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "emailVerificationToken" TEXT,
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "passwordSetAt" TIMESTAMP(3);

-- Existing accounts: treat as already verified
UPDATE "User" SET "emailVerifiedAt" = CURRENT_TIMESTAMP WHERE "emailVerifiedAt" IS NULL;

CREATE UNIQUE INDEX "User_emailVerificationToken_key" ON "User"("emailVerificationToken");

-- AlterTable MerchantProfile
ALTER TABLE "MerchantProfile" ADD COLUMN "merchantCode" TEXT;

UPDATE "MerchantProfile"
SET "merchantCode" = 'MCH-' || UPPER(REPLACE("id"::text, '-', ''))
WHERE "merchantCode" IS NULL;

ALTER TABLE "MerchantProfile" ALTER COLUMN "merchantCode" SET NOT NULL;

CREATE UNIQUE INDEX "MerchantProfile_merchantCode_key" ON "MerchantProfile"("merchantCode");
