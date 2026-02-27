-- Enums для базы знаний (если ещё не созданы)
DO $$ BEGIN
  CREATE TYPE "KnowledgeFileType" AS ENUM ('docx', 'md');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "KnowledgeIndexingStatus" AS ENUM ('PENDING', 'INDEXED', 'FAILED', 'OUTDATED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Таблицы базы знаний (если ещё не созданы)
CREATE TABLE IF NOT EXISTS "KnowledgeDocument" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileType" "KnowledgeFileType" NOT NULL,
    "storagePath" TEXT NOT NULL DEFAULT '',
    "content" TEXT,
    "indexingStatus" "KnowledgeIndexingStatus" NOT NULL DEFAULT 'PENDING',
    "fragmentCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "uploadedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "indexedAt" TIMESTAMP(3),
    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "KnowledgeFragment" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "topic" TEXT,
    "audienceLevel" TEXT,
    "language" TEXT,
    "manuallyEdited" BOOLEAN NOT NULL DEFAULT false,
    "sourceFile" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgeFragment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "KnowledgeFragment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Добавить content и default для storagePath, если таблица уже была
ALTER TABLE "KnowledgeDocument" ADD COLUMN IF NOT EXISTS "content" TEXT;
ALTER TABLE "KnowledgeDocument" ALTER COLUMN "storagePath" SET DEFAULT '';

-- FollowupTemplate: шаблоны follow-up по шагу, языку и варианту A/B
CREATE TABLE IF NOT EXISTS "FollowupTemplate" (
    "id" SERIAL NOT NULL,
    "step" INTEGER NOT NULL,
    "language" "ClientLanguage" NOT NULL DEFAULT 'RU',
    "variant" TEXT NOT NULL DEFAULT 'A',
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FollowupTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FollowupTemplate_step_language_variant_key" ON "FollowupTemplate"("step", "language", "variant");
