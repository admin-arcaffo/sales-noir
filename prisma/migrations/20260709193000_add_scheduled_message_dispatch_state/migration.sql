ALTER TABLE "ScheduledMessage"
ADD COLUMN IF NOT EXISTS "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "lastAttemptAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "failedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "lastError" TEXT,
ADD COLUMN IF NOT EXISTS "dispatchMessageId" TEXT;

CREATE INDEX IF NOT EXISTS "ScheduledMessage_status_lastAttemptAt_idx"
ON "ScheduledMessage" ("status", "lastAttemptAt");
