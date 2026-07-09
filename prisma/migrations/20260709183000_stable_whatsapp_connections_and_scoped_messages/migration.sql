ALTER TABLE "WhatsAppConnection"
ADD COLUMN IF NOT EXISTS "whatsAppAccountJid" TEXT,
ADD COLUMN IF NOT EXISTS "whatsAppAccountPhone" TEXT;

DROP INDEX IF EXISTS "Message_waMessageId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Message_connection_waMessageId_key"
ON "Message" ("whatsAppConnectionId", "waMessageId");

CREATE INDEX IF NOT EXISTS "WhatsAppConnection_organizationId_whatsAppAccountPhone_idx"
ON "WhatsAppConnection" ("organizationId", "whatsAppAccountPhone");
