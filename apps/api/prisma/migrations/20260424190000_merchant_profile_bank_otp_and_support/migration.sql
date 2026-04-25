-- CreateTable
CREATE TABLE "MerchantPayoutOtpChallenge" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL,
    "accountNo" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "invalidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantPayoutOtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantSupportMessage" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "orderId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantSupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MerchantPayoutOtpChallenge_merchantId_createdAt_idx" ON "MerchantPayoutOtpChallenge"("merchantId", "createdAt");

-- CreateIndex
CREATE INDEX "MerchantPayoutOtpChallenge_expiresAt_idx" ON "MerchantPayoutOtpChallenge"("expiresAt");

-- CreateIndex
CREATE INDEX "MerchantPayoutOtpChallenge_consumedAt_idx" ON "MerchantPayoutOtpChallenge"("consumedAt");

-- CreateIndex
CREATE INDEX "MerchantSupportMessage_merchantId_createdAt_idx" ON "MerchantSupportMessage"("merchantId", "createdAt");

-- CreateIndex
CREATE INDEX "MerchantSupportMessage_status_createdAt_idx" ON "MerchantSupportMessage"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "MerchantPayoutOtpChallenge" ADD CONSTRAINT "MerchantPayoutOtpChallenge_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "MerchantProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantSupportMessage" ADD CONSTRAINT "MerchantSupportMessage_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "MerchantProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
