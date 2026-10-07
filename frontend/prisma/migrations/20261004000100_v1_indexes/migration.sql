CREATE INDEX IF NOT EXISTS "Question_embedding_hnsw" ON "Question" USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS "Question_search_fts" ON "Question" USING gin (to_tsvector('english', "extractedText"));
CREATE INDEX IF NOT EXISTS "Paper_public_filters" ON "Paper" ("courseId", "examType", year) WHERE "publicationStatus" = 'AUTO_PUBLISHED';
CREATE INDEX IF NOT EXISTS "QuestionTopic_topicId_idx" ON "QuestionTopic" ("topicId");
-- No PostgREST access is needed. Prisma uses a server-only database role.
ALTER TABLE "Course" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Module" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Topic" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "File" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Submission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Paper" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Question" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuestionTopic" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudyMaterial" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProcessingJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SyllabusVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExtractionAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QualityResult" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobRetry" ENABLE ROW LEVEL SECURITY;
