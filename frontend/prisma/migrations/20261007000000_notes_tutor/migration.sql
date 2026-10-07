ALTER TABLE "StudyMaterial" ADD COLUMN "publicationStatus" TEXT NOT NULL DEFAULT 'PROCESSING',
  ADD COLUMN "extractionVersion" TEXT, ADD COLUMN "pageCount" INTEGER;
CREATE TABLE "MaterialPage" (
  "id" TEXT PRIMARY KEY, "materialId" TEXT NOT NULL REFERENCES "StudyMaterial"("id") ON DELETE CASCADE,
  "pageIndex" INTEGER NOT NULL CHECK ("pageIndex" >= 0 AND "pageIndex" < 200),
  "fileHash" TEXT NOT NULL, "extractionVersion" TEXT NOT NULL,
  "text" TEXT NOT NULL, "heading" TEXT NOT NULL, "method" TEXT NOT NULL
);
CREATE UNIQUE INDEX "MaterialPage_materialId_pageIndex_key" ON "MaterialPage"("materialId", "pageIndex");
CREATE TABLE "MaterialChunk" (
  "id" TEXT PRIMARY KEY, "materialId" TEXT NOT NULL REFERENCES "StudyMaterial"("id") ON DELETE CASCADE,
  "position" INTEGER NOT NULL, "text" TEXT NOT NULL, "heading" TEXT NOT NULL,
  "sourcePages" INTEGER[] NOT NULL, "method" TEXT NOT NULL, "extractionVersion" TEXT NOT NULL
);
CREATE UNIQUE INDEX "MaterialChunk_materialId_position_key" ON "MaterialChunk"("materialId", "position");
CREATE INDEX "MaterialChunk_search_idx" ON "MaterialChunk" USING GIN (to_tsvector('english', "heading" || ' ' || "text"));
CREATE INDEX "Question_search_idx" ON "Question" USING GIN (to_tsvector('english', "extractedText"));
CREATE TABLE "ApiRateLimit" ("key" TEXT PRIMARY KEY, "count" INTEGER NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "ApiRateLimit_expiresAt_idx" ON "ApiRateLimit"("expiresAt");
ALTER TABLE "MaterialPage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MaterialChunk" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApiRateLimit" ENABLE ROW LEVEL SECURITY;
