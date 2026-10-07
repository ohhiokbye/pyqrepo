-- Upgrade the legacy CPYQ schema without deleting existing data.
-- Run once on the legacy schema. Repeated execution fails and rolls back.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';
CREATE TEMP TABLE cpyq_v1_original_counts ON COMMIT DROP AS
SELECT 'Course' AS name, count(*) AS count FROM "Course"
UNION ALL SELECT 'Module', count(*) FROM "Module"
UNION ALL SELECT 'Topic', count(*) FROM "Topic"
UNION ALL SELECT 'File', count(*) FROM "File"
UNION ALL SELECT 'Paper', count(*) FROM "Paper"
UNION ALL SELECT 'Question', count(*) FROM "Question"
UNION ALL SELECT 'QuestionTopic', count(*) FROM "QuestionTopic"
UNION ALL SELECT 'Submission', count(*) FROM "Submission"
UNION ALL SELECT 'ProcessingJob', count(*) FROM "ProcessingJob"
UNION ALL SELECT 'StudyMaterial', count(*) FROM "StudyMaterial";
-- DropIndex
DROP INDEX "Module_courseId_moduleNo_key";

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "activeSyllabusVersionId" TEXT;

-- AlterTable
ALTER TABLE "Module" ADD COLUMN     "syllabusVersionId" TEXT;

-- AlterTable
ALTER TABLE "Paper" ADD COLUMN     "publicationStatus" TEXT NOT NULL DEFAULT 'PROCESSING';

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "boundingBox" JSONB,
ADD COLUMN     "duplicateOfId" TEXT,
ADD COLUMN     "embeddingModel" TEXT,
ADD COLUMN     "pageIndex" INTEGER,
ADD COLUMN     "textHash" TEXT;

-- AlterTable
ALTER TABLE "ProcessingJob" ADD COLUMN     "leaseExpiresAt" TIMESTAMP(3),
ADD COLUMN     "leaseToken" TEXT,
ADD COLUMN     "nextRetryAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "SyllabusVersion" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AUTO_PUBLISHED',
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyllabusVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractionAttempt" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtractionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityResult" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "ocrConfidence" DOUBLE PRECISION NOT NULL,
    "segmentationCoverage" DOUBLE PRECISION NOT NULL,
    "checks" JSONB,
    "questionCount" INTEGER NOT NULL,
    "reasons" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QualityResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRetry" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobRetry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SyllabusVersion_courseId_version_key" ON "SyllabusVersion"("courseId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "QualityResult_jobId_key" ON "QualityResult"("jobId");

-- CreateIndex
CREATE INDEX "Module_courseId_idx" ON "Module"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Module_syllabusVersionId_moduleNo_key" ON "Module"("syllabusVersionId", "moduleNo");

-- CreateIndex
CREATE INDEX "Question_textHash_idx" ON "Question"("textHash");

-- CreateIndex
CREATE INDEX "ProcessingJob_status_nextRetryAt_idx" ON "ProcessingJob"("status", "nextRetryAt");

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_syllabusVersionId_fkey" FOREIGN KEY ("syllabusVersionId") REFERENCES "SyllabusVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyllabusVersion" ADD CONSTRAINT "SyllabusVersion_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyllabusVersion" ADD CONSTRAINT "SyllabusVersion_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionAttempt" ADD CONSTRAINT "ExtractionAttempt_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ProcessingJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityResult" ADD CONSTRAINT "QualityResult_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ProcessingJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRetry" ADD CONSTRAINT "JobRetry_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ProcessingJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Incompatible vectors abort the transaction rather than losing data.
ALTER TABLE "Question" ALTER COLUMN embedding TYPE vector(768) USING embedding::vector(768);
-- Legacy uploads have not passed v1 quality checks. Preserve them privately.
UPDATE "Paper" SET "publicationStatus" = 'RETRY_PENDING';
-- Explicit retry is required to process legacy uploads.
UPDATE "ProcessingJob" SET "nextRetryAt" = NULL;
UPDATE "ProcessingJob" SET status = 'RETRY_PENDING', "errorCategory" = COALESCE("errorCategory", 'Legacy job: explicitly retry to run v1 extraction') WHERE status = 'PROCESSING';
DO $$
DECLARE original record; actual bigint;
BEGIN
  FOR original IN SELECT * FROM cpyq_v1_original_counts LOOP
    EXECUTE format('SELECT count(*) FROM %I', original.name) INTO actual;
    IF actual <> original.count THEN
      RAISE EXCEPTION 'Row count changed for %: before %, after %', original.name, original.count, actual;
    END IF;
  END LOOP;
END $$;
COMMIT;
