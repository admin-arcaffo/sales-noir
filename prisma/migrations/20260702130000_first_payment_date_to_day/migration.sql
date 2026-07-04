-- Change firstPaymentDate from DateTime to Int (day of month, 1-31).
-- First, add a temporary column.
ALTER TABLE "ClosedDeal" ADD COLUMN "firstPaymentDay" INTEGER;

-- Convert existing dates to day-of-month (or null).
UPDATE "ClosedDeal"
SET "firstPaymentDay" = EXTRACT(DAY FROM "firstPaymentDate")::INTEGER
WHERE "firstPaymentDate" IS NOT NULL;

-- Remove the old column and rename the new one.
ALTER TABLE "ClosedDeal" DROP COLUMN "firstPaymentDate";
ALTER TABLE "ClosedDeal" RENAME COLUMN "firstPaymentDay" TO "firstPaymentDate";

-- Drop the old index on firstPaymentDate (it was on DateTime).
DROP INDEX IF EXISTS "ClosedDeal_firstPaymentDate_idx";
