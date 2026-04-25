-- CreateTable
CREATE TABLE "SavedRecipient" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT,
    "recipientName" TEXT NOT NULL,
    "recipientPhone" TEXT NOT NULL,
    "houseNo" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "landmark" TEXT NOT NULL DEFAULT '',
    "shippingState" TEXT NOT NULL,
    "shippingLga" TEXT NOT NULL,
    "shippingCity" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedRecipient_userId_createdAt_idx" ON "SavedRecipient"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "SavedRecipient" ADD CONSTRAINT "SavedRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
