-- Clean up duplicate open conversations for the same (contactId, whatsAppConnectionId)
-- keeping only the most recently updated one per pair.

WITH ranked AS (
  SELECT
    id,
    "contactId",
    "whatsAppConnectionId",
    row_number() OVER (
      PARTITION BY "contactId", "whatsAppConnectionId"
      ORDER BY "updatedAt" DESC, "lastMessageAt" DESC NULLS LAST
    ) AS rn
  FROM "Conversation"
  WHERE status = 'OPEN' AND "whatsAppConnectionId" IS NOT NULL
),
to_keep AS (
  SELECT id, "contactId", "whatsAppConnectionId" FROM ranked WHERE rn = 1
),
to_close AS (
  SELECT id, "contactId", "whatsAppConnectionId" FROM ranked WHERE rn > 1
),
moved AS (
  UPDATE "Message" m
  SET "conversationId" = k.id
  FROM to_close c
  JOIN to_keep k ON k."contactId" = c."contactId" AND k."whatsAppConnectionId" = c."whatsAppConnectionId"
  WHERE m."conversationId" = c.id
)
UPDATE "Conversation" c
SET status = 'CLOSED'
FROM to_close tc
WHERE c.id = tc.id;

-- Add partial unique index to prevent future duplicates
CREATE UNIQUE INDEX "Conversation_contactId_whatsAppConnectionId_open_key"
  ON "Conversation" ("contactId", "whatsAppConnectionId")
  WHERE status = 'OPEN' AND "whatsAppConnectionId" IS NOT NULL;
