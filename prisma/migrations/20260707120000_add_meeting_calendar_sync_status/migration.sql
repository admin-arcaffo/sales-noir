ALTER TABLE "Meeting"
ADD COLUMN "googleCalendarHtmlLink" TEXT,
ADD COLUMN "calendarSyncStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "calendarSyncError" TEXT,
ADD COLUMN "calendarSyncedAt" TIMESTAMP(3),
ADD COLUMN "calendarLastCheckedAt" TIMESTAMP(3);

UPDATE "Meeting"
SET
  "calendarSyncStatus" = 'SYNCED',
  "calendarSyncedAt" = COALESCE("updatedAt", "createdAt")
WHERE "googleEventId" IS NOT NULL;

CREATE INDEX "Meeting_organizationId_calendarSyncStatus_scheduledAt_idx"
ON "Meeting"("organizationId", "calendarSyncStatus", "scheduledAt");
