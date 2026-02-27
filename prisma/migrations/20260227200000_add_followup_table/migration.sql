-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "FollowupStatus" AS ENUM ('SCHEDULED', 'SENT', 'CANCELLED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Followup" (
    "id" TEXT NOT NULL,
    "leadSessionId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "templateVariant" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "messageId" TEXT,
    "status" "FollowupStatus" NOT NULL,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Followup_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey (only if table was just created; ignore if constraint exists)
DO $$ BEGIN
  ALTER TABLE "Followup" ADD CONSTRAINT "Followup_leadSessionId_fkey" FOREIGN KEY ("leadSessionId") REFERENCES "LeadSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
