-- Add phone field to User for internal contact detection
ALTER TABLE "User" ADD COLUMN "phone" TEXT;

-- Add whatsAppConnectionId to Message for audit trail (no FK constraint)
ALTER TABLE "Message" ADD COLUMN "whatsAppConnectionId" TEXT;

CREATE INDEX "Message_whatsAppConnectionId_timestamp_idx" ON "Message" ("whatsAppConnectionId", "timestamp");
