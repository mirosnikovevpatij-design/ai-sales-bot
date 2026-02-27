-- CreateEnum
CREATE TYPE "LeadSessionStatus" AS ENUM ('PENDING_INIT', 'INIT_SENT', 'ENGAGED', 'QUALIFYING', 'PRESENTING', 'OBJECTION_HANDLING', 'SCHEDULING_ZOOM', 'ZOOM_BOOKED', 'FOLLOWUP_1', 'FOLLOWUP_2', 'FOLLOWUP_3', 'HANDOFF_TO_HUMAN', 'INIT_FAILED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ClientLanguage" AS ENUM ('RU', 'KZ', 'SHALAKAZ', 'OTHER');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('WHATSAPP');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('text', 'image', 'audio', 'video', 'document', 'sticker', 'deleted');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('SENT', 'DELIVERED', 'READ', 'FAILED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "LeadSession" (
    "id" TEXT NOT NULL,
    "amoDealId" BIGINT NOT NULL,
    "amoContactId" BIGINT,
    "phone" TEXT NOT NULL,
    "conversationId" TEXT,
    "status" "LeadSessionStatus" NOT NULL,
    "clientLanguage" "ClientLanguage",
    "conversationStateJson" JSONB,
    "assignedManagerId" INTEGER,
    "handoffReason" TEXT,
    "handoffAt" TIMESTAMP(3),
    "lastClientMessageAt" TIMESTAMP(3),
    "lastBotMessageAt" TIMESTAMP(3),
    "initMessageId" TEXT,
    "initSentAt" TIMESTAMP(3),
    "source" TEXT,
    "proposedSlots" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "leadSessionId" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "messageType" "MessageType" NOT NULL,
    "text" TEXT,
    "externalMessageId" TEXT,
    "status" "MessageStatus" NOT NULL,
    "statusUpdatedAt" TIMESTAMP(3),
    "llmPromptTokens" INTEGER,
    "llmCompletionTokens" INTEGER,
    "ragScore" DOUBLE PRECISION,
    "language" "ClientLanguage",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InitQueue" (
    "id" TEXT NOT NULL,
    "leadSessionId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "runAfter" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "status" "QueueStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InitQueue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeadSession_amoDealId_key" ON "LeadSession"("amoDealId");

-- CreateIndex
CREATE UNIQUE INDEX "Message_externalMessageId_key" ON "Message"("externalMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "InitQueue_idempotencyKey_key" ON "InitQueue"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_leadSessionId_fkey" FOREIGN KEY ("leadSessionId") REFERENCES "LeadSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitQueue" ADD CONSTRAINT "InitQueue_leadSessionId_fkey" FOREIGN KEY ("leadSessionId") REFERENCES "LeadSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
