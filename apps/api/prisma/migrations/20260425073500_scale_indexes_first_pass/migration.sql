-- First-pass indexing for high-volume reads.
CREATE INDEX IF NOT EXISTS "User_role_createdAt_idx" ON "User"("role", "createdAt");

CREATE INDEX IF NOT EXISTS "MerchantProfile_verificationStatus_createdAt_idx"
ON "MerchantProfile"("verificationStatus", "createdAt");
CREATE INDEX IF NOT EXISTS "MerchantProfile_status_createdAt_idx"
ON "MerchantProfile"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "MerchantProfile_merchantTier_createdAt_idx"
ON "MerchantProfile"("merchantTier", "createdAt");

CREATE INDEX IF NOT EXISTS "Product_isApproved_isHidden_authoringStatus_createdAt_idx"
ON "Product"("isApproved", "isHidden", "authoringStatus", "createdAt");
CREATE INDEX IF NOT EXISTS "Product_merchantId_createdAt_idx"
ON "Product"("merchantId", "createdAt");
CREATE INDEX IF NOT EXISTS "Product_categoryId_createdAt_idx"
ON "Product"("categoryId", "createdAt");

CREATE INDEX IF NOT EXISTS "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_paymentReference_idx" ON "Order"("paymentReference");
CREATE INDEX IF NOT EXISTS "Order_createdAt_idx" ON "Order"("createdAt");

CREATE INDEX IF NOT EXISTS "OrderItem_merchantId_orderId_idx" ON "OrderItem"("merchantId", "orderId");
CREATE INDEX IF NOT EXISTS "OrderItem_productId_orderId_idx" ON "OrderItem"("productId", "orderId");
