ALTER TABLE "Task" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "Task" ADD COLUMN "reminderAt" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN "completedById" TEXT;
ALTER TABLE "Task" ADD COLUMN "conversationId" TEXT;
ALTER TABLE "Task" ADD COLUMN "analysisId" TEXT;

CREATE INDEX "Task_userId_status_dueAt_idx" ON "Task"("userId", "status", "dueAt");
CREATE INDEX "Task_contactId_status_dueAt_idx" ON "Task"("contactId", "status", "dueAt");
CREATE INDEX "Task_conversationId_idx" ON "Task"("conversationId");
CREATE INDEX "Task_analysisId_idx" ON "Task"("analysisId");

ALTER TABLE "Task" ADD CONSTRAINT "Task_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "AIAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;
