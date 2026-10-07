import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import type { CourseWithModules, TutorSource, RevisionEvidence } from '@/lib/types'
import type { ExamAnalysis } from '@/lib/examAnalysis'

const stopWords = new Set('the and for with this that what how explain question about please show from teach topic step study revision prioritize priority important concepts subject course exam paper uploaded available hours minutes give practice'.split(' '))
export function retrievalTerms(text: string) {
  return [...new Set(text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [])].filter((word) => !stopWords.has(word)).slice(0, 24)
}

export function revisionEvidence(analysis: ExamAnalysis, course: CourseWithModules, minutes: number, focus: { moduleId?: string; topicName?: string }): RevisionEvidence {
  const syllabus = course.modules.filter((module) => !focus.moduleId || module.id === focus.moduleId).flatMap((module) => module.topics.filter((topic) => !focus.topicName || topic.topicName === focus.topicName).map((topic) => ({ ...topic, module: module.name })))
  const order = new Map(syllabus.map((topic, index) => [topic.id, index]))
  const topics = syllabus.map((topic) => {
    const stats = analysis.topics.find((row) => row.topicId === topic.id)
    return { topicId: topic.id, topic: topic.topicName, module: topic.module, matchingPapers: stats?.matchingPapers || 0, allocatedMarks: stats?.allocatedMarks || 0 }
  }).sort((a, b) => b.matchingPapers - a.matchingPapers || b.allocatedMarks - a.allocatedMarks || order.get(a.topicId)! - order.get(b.topicId)!).slice(0, 8)
  return { minutes, paperCount: analysis.paperCount, status: analysis.paperCount ? 'available' : 'insufficient_data', topics }
}

type SearchRow = { id: string; kind: 'notes' | 'question'; text: string; heading: string; title: string; fileKey: string; sourcePages: number[]; paperId: string | null; questionNumber: string | null; examType: string | null; year: number | null; instructions: string | null; paperInstructions: string | null; marks: number | null }
export async function retrieveTutorSources(input: { courseId: string; query: string; examType?: string; year?: number; moduleId?: string; topicName?: string }): Promise<TutorSource[]> {
  const terms = retrievalTerms(input.query)
  if (!terms.length) return []
  const query = terms.join(' OR ')
  const focus = input.moduleId || input.topicName ? Prisma.sql`AND EXISTS (
    SELECT 1 FROM "QuestionTopic" qt JOIN "Topic" t ON t.id = qt."topicId" JOIN "Module" m ON m.id = t."moduleId"
    WHERE qt."questionId" = q.id ${input.moduleId ? Prisma.sql`AND m.id = ${input.moduleId}` : Prisma.empty}
    ${input.topicName ? Prisma.sql`AND t."topicName" = ${input.topicName}` : Prisma.empty}
  )` : Prisma.empty
  const [notes, questions] = await Promise.all([
    prisma.$queryRaw<SearchRow[]>(Prisma.sql`SELECT ch.id, 'notes' AS kind, ch.text, ch.heading, sm.title,
      f."s3Key" AS "fileKey", ch."sourcePages", NULL AS "paperId", NULL AS "questionNumber", NULL AS "examType", NULL::int AS year, NULL AS instructions, NULL AS "paperInstructions", NULL::float AS marks
      FROM "MaterialChunk" ch JOIN "StudyMaterial" sm ON sm.id = ch."materialId" JOIN "File" f ON f.id = sm."fileId"
      WHERE sm."courseId" = ${input.courseId} AND sm."publicationStatus" = 'AUTO_PUBLISHED'
      AND to_tsvector('english', ch.heading || ' ' || ch.text) @@ websearch_to_tsquery('english', ${query})
      ORDER BY ts_rank_cd(to_tsvector('english', ch.heading || ' ' || ch.text), websearch_to_tsquery('english', ${query})) DESC, ch."materialId", ch.position LIMIT 6`),
    prisma.$queryRaw<SearchRow[]>(Prisma.sql`SELECT q.id, 'question' AS kind, q."extractedText" AS text, '' AS heading,
      q."questionNumber" AS title, f."s3Key" AS "fileKey", q."sourcePages", p.id AS "paperId", q."questionNumber", p."examType", p.year,
      q."sharedInstructions" AS instructions, p."sharedInstructions" AS "paperInstructions", q.marks
      FROM "Question" q JOIN "Paper" p ON p.id = q."paperId" JOIN "File" f ON f.id = p."fileId"
      WHERE p."courseId" = ${input.courseId} AND p."publicationStatus" = 'AUTO_PUBLISHED' AND p."duplicateOfPaperId" IS NULL AND q."marksScope" <> 'PARENT_TOTAL'
      ${input.examType ? Prisma.sql`AND p."examType" = ${input.examType}` : Prisma.empty}
      ${input.year ? Prisma.sql`AND p.year = ${input.year}` : Prisma.empty} ${focus}
      AND to_tsvector('english', q."extractedText") @@ websearch_to_tsquery('english', ${query})
      ORDER BY ts_rank_cd(to_tsvector('english', q."extractedText"), websearch_to_tsquery('english', ${query})) DESC, p.year DESC NULLS LAST, q.id LIMIT 4`),
  ])
  let remaining = 32_000
  return [...notes, ...questions].filter((row) => {
    const size = row.text.length + (row.instructions?.length || 0) + (row.paperInstructions?.length || 0)
    if (size > remaining) return false
    remaining -= size
    return true
  }).map((row, index) => ({
    id: row.id, source: index + 1, kind: row.kind, text: row.text, heading: row.heading,
    label: row.kind === 'notes' ? `${row.title} · p. ${row.sourcePages.map((page) => page + 1).join(', ')}` : `${row.questionNumber} · ${row.examType}${row.year ? ` ${row.year}` : ''}`,
    url: row.kind === 'notes' ? `/api/files/${row.fileKey.split('/').map(encodeURIComponent).join('/')}#page=${(row.sourcePages[0] || 0) + 1}` : `/papers/${row.paperId}#question-${row.id}`,
    sourcePages: row.sourcePages, instructions: row.instructions, paperInstructions: row.paperInstructions, marks: row.marks,
  }))
}

export function validCitations(reply: string, sources: Pick<TutorSource, 'source'>[]) {
  const allowed = new Set(sources.map((source) => source.source))
  return [...reply.matchAll(/\[(\d+)\]/g)].every((match) => allowed.has(Number(match[1])))
}
