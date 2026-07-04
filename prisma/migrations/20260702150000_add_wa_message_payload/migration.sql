-- Persist full Evolution webhook payload for reliable media rescue.
ALTER TABLE "Message" ADD COLUMN "waMessagePayload" JSONB;
