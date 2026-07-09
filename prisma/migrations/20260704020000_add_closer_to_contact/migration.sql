-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "closerId" TEXT;

-- CreateIndex
CREATE INDEX "Contact_organizationId_closerId_idx" ON "Contact"("organizationId", "closerId");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_closerId_fkey" FOREIGN KEY ("closerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
