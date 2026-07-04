-- Add media processing state to messages.
ALTER TABLE "Message" ADD COLUMN "mediaStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Message" ADD COLUMN "mediaError" TEXT;
ALTER TABLE "Message" ADD COLUMN "mediaAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Message" ADD COLUMN "mediaLastAttemptAt" TIMESTAMP(3);
ALTER TABLE "Message" ADD COLUMN "waMessageKey" JSONB;

-- Preserve original file names for reliable downloads.
ALTER TABLE "Media" ADD COLUMN "originalFileName" TEXT;

-- Existing media rows are immediately available.
UPDATE "Message"
SET "mediaStatus" = 'AVAILABLE'
WHERE "id" IN (SELECT "messageId" FROM "Media");

-- Non-media messages do not need media processing state.
UPDATE "Message"
SET "mediaStatus" = 'NONE'
WHERE "type" NOT IN ('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'STICKER');

CREATE INDEX "Message_mediaStatus_idx" ON "Message"("mediaStatus");
