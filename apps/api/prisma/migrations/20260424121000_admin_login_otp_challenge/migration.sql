CREATE TABLE "AdminLoginChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "keepSignedIn" BOOLEAN NOT NULL DEFAULT false,
    "consumedAt" TIMESTAMP(3),
    "invalidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdminLoginChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminLoginChallenge_userId_createdAt_idx"
ON "AdminLoginChallenge"("userId", "createdAt");

CREATE INDEX "AdminLoginChallenge_expiresAt_idx"
ON "AdminLoginChallenge"("expiresAt");

CREATE INDEX "AdminLoginChallenge_consumedAt_idx"
ON "AdminLoginChallenge"("consumedAt");

ALTER TABLE "AdminLoginChallenge"
ADD CONSTRAINT "AdminLoginChallenge_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
