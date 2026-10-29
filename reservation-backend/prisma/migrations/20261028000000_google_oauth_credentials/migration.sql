CREATE TABLE "GoogleOAuthCredential" (
    "id" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GoogleOAuthCredential_pkey" PRIMARY KEY ("id")
);
