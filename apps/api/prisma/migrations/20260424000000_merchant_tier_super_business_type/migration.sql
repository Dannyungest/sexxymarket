-- Rename TRUSTED -> SUPER on MerchantTier
ALTER TYPE "MerchantTier" RENAME VALUE 'TRUSTED' TO 'SUPER';

-- Business type for KYC (CAC only when REGISTERED_BUSINESS)
CREATE TYPE "BusinessType" AS ENUM ('INDIVIDUAL', 'REGISTERED_BUSINESS');

ALTER TABLE "MerchantProfile" ADD COLUMN "businessType" "BusinessType" NOT NULL DEFAULT 'INDIVIDUAL';

-- CAC optional for individual merchants
ALTER TABLE "MerchantVerification" ALTER COLUMN "cacNumber" DROP NOT NULL;
