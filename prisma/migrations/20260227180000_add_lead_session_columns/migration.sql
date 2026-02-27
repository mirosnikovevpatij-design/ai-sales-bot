-- AlterTable LeadSession: add columns that exist in schema but were missing from init migration
ALTER TABLE "LeadSession" ADD COLUMN IF NOT EXISTS "phoneMasked" TEXT;
ALTER TABLE "LeadSession" ADD COLUMN IF NOT EXISTS "waAccountId" INTEGER;
ALTER TABLE "LeadSession" ADD COLUMN IF NOT EXISTS "slaNotified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LeadSession" ADD COLUMN IF NOT EXISTS "slaNotifiedAt" TIMESTAMP(3);
ALTER TABLE "LeadSession" ADD COLUMN IF NOT EXISTS "slaSecondNotified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LeadSession" ADD COLUMN IF NOT EXISTS "initStatus" "MessageStatus";
ALTER TABLE "LeadSession" ADD COLUMN IF NOT EXISTS "zoomMeetingId" TEXT;
ALTER TABLE "LeadSession" ADD COLUMN IF NOT EXISTS "zoomJoinUrl" TEXT;
ALTER TABLE "LeadSession" ADD COLUMN IF NOT EXISTS "zoomScheduledAt" TIMESTAMP(3);
ALTER TABLE "LeadSession" ADD COLUMN IF NOT EXISTS "zoomReminder24hSent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LeadSession" ADD COLUMN IF NOT EXISTS "zoomReminder1hSent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LeadSession" ADD COLUMN IF NOT EXISTS "amoPipelineStatusId" BIGINT;
ALTER TABLE "LeadSession" ADD COLUMN IF NOT EXISTS "followupStopped" BOOLEAN NOT NULL DEFAULT false;
