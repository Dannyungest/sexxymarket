-- Add richer merchant verification profile fields
ALTER TABLE "MerchantVerification"
ADD COLUMN "firstName" TEXT,
ADD COLUMN "lastName" TEXT,
ADD COLUMN "gender" TEXT,
ADD COLUMN "dateOfBirth" TEXT,
ADD COLUMN "idNumber" TEXT,
ADD COLUMN "residentialAddress" TEXT,
ADD COLUMN "businessName" TEXT,
ADD COLUMN "isPhysicalStore" BOOLEAN,
ADD COLUMN "physicalStoreAddress" TEXT;
