-- Add reportToken to Organization for monthly report downloads.
ALTER TABLE "Organization" ADD COLUMN "reportToken" TEXT UNIQUE;