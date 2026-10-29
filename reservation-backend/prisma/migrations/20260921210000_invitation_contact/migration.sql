ALTER TABLE "Invitation" ADD COLUMN "contactId" TEXT;
CREATE INDEX "Invitation_contactId_idx" ON "Invitation"("contactId");
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "ExternalContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;