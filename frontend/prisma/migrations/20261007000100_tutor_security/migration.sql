-- The earlier pattern migration did not enable RLS. Only server-side Prisma
-- access is required; anonymous/PostgREST clients receive no policies.
ALTER TABLE "QuestionPattern" ENABLE ROW LEVEL SECURITY;
-- Reuse the original FTS index instead of keeping two identical indexes.
DROP INDEX IF EXISTS "Question_search_idx";
