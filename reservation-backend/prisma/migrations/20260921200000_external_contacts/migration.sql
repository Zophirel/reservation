CREATE TYPE "ContactSource" AS ENUM ('DEVICE', 'GOOGLE');

CREATE TABLE "ExternalContact" (
    "id" TEXT NOT NULL,
    "source" "ContactSource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "phoneNormalized" TEXT NOT NULL,
    "importedById" TEXT,
    "matchedUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalContact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExternalContact_source_externalId_key" ON "ExternalContact"("source", "externalId");
CREATE INDEX "ExternalContact_phoneNormalized_idx" ON "ExternalContact"("phoneNormalized");
CREATE INDEX "ExternalContact_matchedUserId_idx" ON "ExternalContact"("matchedUserId");
ALTER TABLE "ExternalContact" ADD CONSTRAINT "ExternalContact_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExternalContact" ADD CONSTRAINT "ExternalContact_matchedUserId_fkey" FOREIGN KEY ("matchedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
