-- CreateTable
CREATE TABLE "ClosedDeal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "conversationId" TEXT,
    "totalValue" DOUBLE PRECISION NOT NULL,
    "installmentCount" INTEGER,
    "firstPaymentValue" DOUBLE PRECISION,
    "firstPaymentDate" TIMESTAMP(3),
    "projectDuration" TEXT,
    "paymentMethod" TEXT,
    "hasSignal" BOOLEAN NOT NULL DEFAULT false,
    "signalValue" DOUBLE PRECISION,
    "notes" TEXT,
    "productsJson" JSONB,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClosedDeal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClosedDeal_organizationId_contactId_key" ON "ClosedDeal"("organizationId", "contactId");

-- CreateIndex
CREATE INDEX "ClosedDeal_organizationId_closedAt_idx" ON "ClosedDeal"("organizationId", "closedAt");

-- CreateIndex
CREATE INDEX "ClosedDeal_contactId_idx" ON "ClosedDeal"("contactId");

-- CreateIndex
CREATE INDEX "ClosedDeal_closedByUserId_idx" ON "ClosedDeal"("closedByUserId");

-- CreateIndex
CREATE INDEX "ClosedDeal_firstPaymentDate_idx" ON "ClosedDeal"("firstPaymentDate");

-- AddForeignKey
ALTER TABLE "ClosedDeal" ADD CONSTRAINT "ClosedDeal_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClosedDeal" ADD CONSTRAINT "ClosedDeal_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClosedDeal" ADD CONSTRAINT "ClosedDeal_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClosedDeal" ADD CONSTRAINT "ClosedDeal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
