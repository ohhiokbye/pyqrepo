ALTER TABLE "Paper" ADD COLUMN "analysedSyllabusVersionId" TEXT,
  ADD COLUMN "extractionVersion" TEXT,
  ADD COLUMN "analysisComplete" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "duplicateOfPaperId" TEXT,
  ADD COLUMN "sharedInstructions" TEXT;
ALTER TABLE "Question" ADD COLUMN "sourcePages" INTEGER[] NOT NULL DEFAULT '{}',
  ADD COLUMN "sharedInstructions" TEXT,
  ADD COLUMN "parentQuestionNumber" TEXT,
  ADD COLUMN "marksScope" TEXT NOT NULL DEFAULT 'QUESTION',
  ADD COLUMN "patternId" TEXT;
CREATE TABLE "QuestionPattern" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "courseId" TEXT NOT NULL REFERENCES "Course"("id"),
  "syllabusVersionId" TEXT NOT NULL,
  "signature" TEXT NOT NULL,
  "description" TEXT NOT NULL
);
CREATE UNIQUE INDEX "QuestionPattern_courseId_syllabusVersionId_signature_key" ON "QuestionPattern"("courseId", "syllabusVersionId", "signature");
ALTER TABLE "Question" ADD CONSTRAINT "Question_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "QuestionPattern"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Paper_analysis_scope_idx" ON "Paper"("courseId", "analysedSyllabusVersionId", "examType", "year") WHERE "analysisComplete" AND "duplicateOfPaperId" IS NULL;
CREATE INDEX "Question_patternId_idx" ON "Question"("patternId");
