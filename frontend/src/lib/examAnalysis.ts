import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db'

export const analysisFiltersSchema = z.object({
  courseCode: z.string().min(1).max(20),
  examType: z.enum(['CAT1', 'CAT2', 'FAT']).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  fromYear: z.coerce.number().int().min(2000).max(2100).optional(),
  toYear: z.coerce.number().int().min(2000).max(2100).optional(),
}).refine((filters) => !filters.fromYear || !filters.toYear || filters.fromYear <= filters.toYear)
export type AnalysisFilters = z.infer<typeof analysisFiltersSchema>
export const EXTRACTION_VERSION = 'cloud-v2'
export type ExamAnalysis = {
  paperCount: number
  excludedPaperCount: number
  questionAppearances: number
  unknownMarksCount: number
  printedMarksSum: number
  topics: { topicId: string; topic: string; module: string; matchingPapers: number; frequency: number; appearances: number; allocatedMarks: number; markShare: number }[]
  repeatedPatterns: { id: string; description: string; appearances: number; matchingPapers: number }[]
  exactTextRepeats: { textHash: string; text: string; appearances: number; matchingPapers: number }[]
  printedMarksDistribution: { marks: number; marksScope: string; appearances: number }[]
}

/** All counts are calculated in Postgres over the same eligible-paper scope. */
export async function calculateExamAnalysis(filters: AnalysisFilters, db: Pick<Prisma.TransactionClient, '$queryRaw'> = prisma) {
  const scope = Prisma.sql`c.code = ${filters.courseCode}
    ${filters.examType ? Prisma.sql`AND p."examType" = ${filters.examType}` : Prisma.empty}
    ${filters.year ? Prisma.sql`AND p.year = ${filters.year}` : Prisma.empty}
    ${filters.fromYear ? Prisma.sql`AND p.year >= ${filters.fromYear}` : Prisma.empty}
    ${filters.toYear ? Prisma.sql`AND p.year <= ${filters.toYear}` : Prisma.empty}`
  const rows = await db.$queryRaw<{ result: ExamAnalysis }[]>(Prisma.sql`
    WITH scoped AS (
      SELECT p.*, c."activeSyllabusVersionId" FROM "Paper" p JOIN "Course" c ON c.id = p."courseId" WHERE ${scope}
    ), eligible AS (
      SELECT * FROM scoped WHERE "publicationStatus" = 'AUTO_PUBLISHED' AND "analysisComplete"
        AND "duplicateOfPaperId" IS NULL AND "extractionVersion" = ${EXTRACTION_VERSION}
        AND "analysedSyllabusVersionId" = "activeSyllabusVersionId"
    ), questions AS (
      SELECT q.* FROM "Question" q JOIN eligible p ON p.id = q."paperId"
    ), atomic AS (
      SELECT * FROM questions WHERE "marksScope" <> 'PARENT_TOTAL'
    ), links AS (
      SELECT qt.*, count(*) OVER (PARTITION BY qt."questionId") AS topic_count
      FROM "QuestionTopic" qt JOIN atomic q ON q.id = qt."questionId"
    ), topic_rows AS (
      SELECT t.id AS "topicId", t."topicName" AS topic, m.name AS module,
        count(DISTINCT q."paperId")::int AS "matchingPapers", count(q.id)::int AS appearances,
        coalesce(sum(q.marks / l.topic_count), 0)::float AS "allocatedMarks"
      FROM "Topic" t JOIN "Module" m ON m.id = t."moduleId" JOIN "Course" c ON c.id = m."courseId"
      LEFT JOIN links l ON l."topicId" = t.id LEFT JOIN atomic q ON q.id = l."questionId"
      WHERE c.code = ${filters.courseCode} AND m."syllabusVersionId" = c."activeSyllabusVersionId"
      GROUP BY t.id, t."topicName", m.name
    ), patterns AS (
      SELECT pat.id, pat.description, count(q.id)::int AS appearances, count(DISTINCT q."paperId")::int AS "matchingPapers"
      FROM atomic q JOIN "QuestionPattern" pat ON pat.id = q."patternId"
      GROUP BY pat.id, pat.description HAVING count(DISTINCT q."paperId") > 1
    ), repeats AS (
      SELECT "textHash", min("extractedText") AS text, count(*)::int AS appearances, count(DISTINCT "paperId")::int AS "matchingPapers"
      FROM atomic WHERE "textHash" IS NOT NULL GROUP BY "textHash" HAVING count(DISTINCT "paperId") > 1
    ), marks AS (
      SELECT marks, "marksScope", count(*)::int AS appearances FROM questions WHERE marks IS NOT NULL GROUP BY marks, "marksScope"
    )
    SELECT jsonb_build_object(
      'paperCount', (SELECT count(*)::int FROM eligible),
      'excludedPaperCount', (SELECT count(*)::int FROM scoped WHERE id NOT IN (SELECT id FROM eligible)),
      'questionAppearances', (SELECT count(*)::int FROM atomic),
      'unknownMarksCount', (SELECT count(*)::int FROM atomic WHERE marks IS NULL),
      'printedMarksSum', (SELECT coalesce(sum(marks), 0)::float FROM atomic),
      'topics', coalesce((SELECT jsonb_agg(to_jsonb(t) || jsonb_build_object(
        'frequency', CASE WHEN (SELECT count(*) FROM eligible) > 0 THEN t."matchingPapers"::float / (SELECT count(*) FROM eligible) ELSE 0 END,
        'markShare', CASE WHEN (SELECT sum(marks) FROM atomic) > 0 THEN t."allocatedMarks" / (SELECT sum(marks) FROM atomic) ELSE 0 END
      ) ORDER BY t."matchingPapers" DESC, t.topic) FROM topic_rows t), '[]'::jsonb),
      'repeatedPatterns', coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p."matchingPapers" DESC) FROM patterns p), '[]'::jsonb),
      'exactTextRepeats', coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r."matchingPapers" DESC) FROM repeats r), '[]'::jsonb),
      'printedMarksDistribution', coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.marks) FROM marks m), '[]'::jsonb)
    ) AS result`)
  const result = rows[0].result
  return {
    filters, ...result,
    status: result.paperCount ? 'available' : 'insufficient_data',
    notObservedTopics: result.paperCount ? result.topics.filter((topic) => !topic.matchingPapers) : [],
    notes: [
      'Frequency is distinct matching papers divided by all successfully analysed, unique papers in this scope and active syllabus version.',
      'Multi-topic printed marks are split equally only for allocated topic marks and mark shares.',
      'Printed alternatives count as appearances. Printed marks sums are not attempted exam totals. Parent totals are excluded to avoid counting subparts twice; unknown subpart marks are not guessed.',
      'Failed, duplicate, incomplete, legacy and other-syllabus extractions are excluded. Not observed does not mean never examined.',
      'Patterns group the same concept and solution task; exact text repeats are separate.',
    ],
  }
}
