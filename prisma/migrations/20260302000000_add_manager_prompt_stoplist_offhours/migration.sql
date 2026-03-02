-- Enums for missing tables
DO $$ BEGIN
  CREATE TYPE "StopListAddedBy" AS ENUM ('client_request', 'admin', 'system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "WhatsAppAccountStatus" AS ENUM ('ACTIVE', 'DISCONNECTED', 'BANNED', 'QR_REQUIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "OffHoursQueueStatus" AS ENUM ('PENDING', 'PROCESSED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Manager
CREATE TABLE IF NOT EXISTS "Manager" (
    "id" SERIAL PRIMARY KEY,
    "amoUserId" BIGINT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "telegramId" BIGINT,
    "whatsappPhone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "excludeFromRotation" BOOLEAN NOT NULL DEFAULT false,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "currentRoundPosition" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- HandoffAssignment
CREATE TABLE IF NOT EXISTS "HandoffAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadSessionId" TEXT NOT NULL,
    "managerId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    CONSTRAINT "HandoffAssignment_leadSessionId_fkey" FOREIGN KEY ("leadSessionId") REFERENCES "LeadSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HandoffAssignment_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- StopList
CREATE TABLE IF NOT EXISTS "StopList" (
    "id" SERIAL PRIMARY KEY,
    "phone" TEXT NOT NULL UNIQUE,
    "reason" TEXT NOT NULL,
    "addedBy" "StopListAddedBy" NOT NULL,
    "leadSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- WhatsAppAccount
CREATE TABLE IF NOT EXISTS "WhatsAppAccount" (
    "id" SERIAL PRIMARY KEY,
    "connectionId" TEXT,
    "phone" TEXT NOT NULL,
    "channelId" TEXT,
    "status" "WhatsAppAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "rotationWeight" INTEGER NOT NULL DEFAULT 1,
    "messagesSentToday" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "bannedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- OffHoursQueue
CREATE TABLE IF NOT EXISTS "OffHoursQueue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadSessionId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduledReplyAt" TIMESTAMP(3) NOT NULL,
    "status" "OffHoursQueueStatus" NOT NULL DEFAULT 'PENDING',
    "processedAt" TIMESTAMP(3),
    CONSTRAINT "OffHoursQueue_leadSessionId_fkey" FOREIGN KEY ("leadSessionId") REFERENCES "LeadSession"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Prompt (multiple versions per key)
CREATE TABLE IF NOT EXISTS "Prompt" (
    "id" SERIAL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isAbTest" BOOLEAN NOT NULL DEFAULT false,
    "abTrafficPercent" INTEGER,
    "content" TEXT NOT NULL,
    "variablesDesc" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Prompt_key_version_key" ON "Prompt"("key", "version");

-- Indexes for HandoffAssignment
CREATE INDEX IF NOT EXISTS "HandoffAssignment_leadSessionId_idx" ON "HandoffAssignment"("leadSessionId");
CREATE INDEX IF NOT EXISTS "HandoffAssignment_managerId_idx" ON "HandoffAssignment"("managerId");
