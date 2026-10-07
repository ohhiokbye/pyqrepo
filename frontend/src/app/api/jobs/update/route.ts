import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { isWorker } from '@/lib/auth'
import { retryAt } from '@/lib/jobs/retry'
import { apiError } from '@/lib/apiError'
import { EXTRACTION_VERSION } from '@/lib/examAnalysis'
import { MATERIAL_EXTRACTION_VERSION, materialPageSchema, chunkMaterialPages } from '@/lib/materials'
import { readJsonBody } from '@/lib/requestBody'

const questionSchema = z.object({
  questionNumber: z.string().min(1).max(40), extractedText: z.string().min(1), marks: z.number().positive().nullable().optional(),
  imageCropS3Key: z.string().nullable().optional(), pageIndex: z.number().int().nonnegative().nullable().optional(), boundingBox: z.record(z.string(), z.unknown()).nullable().optional(),
  topic: z.string().optional(), confidence: z.number().min(0).max(1).optional(),
  topics: z.array(z.object({ name: z.string().min(1), confidence: z.number().min(0).max(1) })).nullable().optional(),
  sourcePages: z.array(z.number().int().nonnegative()).default([]), sharedInstructions: z.string().optional(),
  parentQuestionNumber: z.string().nullable().optional(), marksScope: z.enum(['QUESTION', 'PARENT_TOTAL']).default('QUESTION'),
  topicIds: z.array(z.string()).optional(), patternId: z.string().nullable().optional(), patternDescription: z.string().min(1).max(500).optional(),
  embedding: z.array(z.number().finite()).length(768).nullable().optional(), embeddingModel: z.string().nullable().optional(),
})
const schema = z.object({
  jobId: z.string().min(1), leaseToken: z.string().uuid(), status: z.enum(['AUTO_PUBLISHED', 'COMPLETED', 'RETRY_PENDING', 'FAILED']),
  stage: z.string().optional(), reviewReasons: z.array(z.string()).default([]), questions: z.array(questionSchema).default([]),
  year: z.number().int().min(2000).max(2100).optional(), fileHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  extractionVersion: z.string().optional(), syllabusVersionId: z.string().nullable().optional(), analysisComplete: z.boolean().default(false), duplicateOfPaperId: z.string().optional(),
  sharedInstructions: z.string().optional(), pageCount: z.number().int().positive().max(200).optional(), reviewedPages: z.array(z.number().int().nonnegative()).optional(),
  provider: z.string().default('unknown'), pages: z.array(z.record(z.string(), z.unknown())).optional(),
  qualityMetrics: z.object({ ocrConfidence: z.number().min(0).max(1), segmentationCoverage: z.number().min(0), questionCount: z.number().int().nonnegative(), checks: z.record(z.string(), z.unknown()).optional() }).optional(),
  curriculum: z.object({ modules: z.array(z.object({ moduleNo: z.number().int().positive(), name: z.string().min(1), topics: z.array(z.string().min(1)).min(1) })).min(1) }).optional(),
  materialComplete: z.boolean().optional(),
  retryAfterSeconds: z.number().int().min(0).max(86400).optional(),
})

export async function POST(req: NextRequest) {
  if (!isWorker(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const parsed = schema.safeParse(await readJsonBody(req, 4 * 1024 * 1024))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid worker result', details: parsed.error.issues }, { status: 400 })
    const data = parsed.data
    const repeatedLabels = new Set(data.questions.map((q) => q.questionNumber)).size !== data.questions.length
    let published = (data.status === 'AUTO_PUBLISHED' || data.status === 'COMPLETED') && !repeatedLabels && !data.reviewReasons.length
    const pagesComplete = Boolean(data.pageCount && data.reviewedPages && new Set(data.reviewedPages).size === data.pageCount && data.reviewedPages.every((page) => page < data.pageCount!))
    if (published && (![EXTRACTION_VERSION, MATERIAL_EXTRACTION_VERSION].includes(data.extractionVersion || '') || !pagesComplete || !data.fileHash)) { published = false; data.reviewReasons.push('Extraction version, file hash or page inventory is incomplete') }
    if (repeatedLabels) data.reviewReasons.push('Numbering: repeated question labels; extraction kept private')
    // Preserve ambiguous extractions without violating the per-paper label constraint.
    // Original OCR labels remain in attempt details, alongside their stored labels.
    const usedLabels = new Set<string>()
    const questions = data.questions.map((q, index) => {
      let label = q.questionNumber
      let occurrence = 2
      while (usedLabels.has(label)) label = `${q.questionNumber} [${occurrence++}]`
      usedLabels.add(label)
      return { ...q, questionNumber: label, originalQuestionNumber: data.questions[index].questionNumber }
    })
    const result = await prisma.$transaction(async (tx) => {
      const active = await tx.processingJob.updateMany({ where: { id: data.jobId, status: 'PROCESSING', leaseToken: data.leaseToken, leaseExpiresAt: { gt: new Date() } }, data: { stage: data.stage || 'SAVING_RESULT' } })
      if (!active.count) return false
      const job = await tx.processingJob.findUniqueOrThrow({ where: { id: data.jobId }, include: { file: { include: { papers: true, syllabusVersions: true, materials: true } } } })
      const paper = job.file.papers[0]
      const syllabus = job.file.syllabusVersions[0]
      const material = job.file.materials[0]
      if (published && !material && data.extractionVersion !== EXTRACTION_VERSION) { published = false; data.reviewReasons.push('Invalid paper/syllabus extraction version') }
      const materialPages = material ? await tx.materialPage.findMany({ where: { materialId: material.id, fileHash: data.fileHash || '', extractionVersion: MATERIAL_EXTRACTION_VERSION }, orderBy: { pageIndex: 'asc' } }) : []
      const chunks = chunkMaterialPages(materialPages.map((page) => materialPageSchema.parse(page)))
      if (published && material && (data.extractionVersion !== MATERIAL_EXTRACTION_VERSION || !data.materialComplete || materialPages.length !== data.pageCount || materialPages.some((page, index) => page.pageIndex !== index) || !chunks.length)) {
        published = false; data.reviewReasons.push('Notes page checkpoints are incomplete or empty')
      }
      const analysedCourse = paper ? await tx.course.findUniqueOrThrow({ where: { id: paper.courseId } }) : null
      const topicCatalog = analysedCourse ? await tx.topic.findMany({ where: { module: { courseId: analysedCourse.id, syllabusVersionId: data.syllabusVersionId ?? analysedCourse.activeSyllabusVersionId } }, select: { id: true } }) : []
      const validTopicIds = new Set(topicCatalog.map((topic) => topic.id))
      const patternCatalog = analysedCourse && data.syllabusVersionId ? await tx.questionPattern.findMany({ where: { courseId: analysedCourse.id, syllabusVersionId: data.syllabusVersionId }, select: { id: true } }) : []
      const validPatternIds = new Set(patternCatalog.map((pattern) => pattern.id))
      const atomic = questions.filter((question) => question.marksScope !== 'PARENT_TOTAL')
      if (published && paper) {
        const labels = new Set(questions.map((question) => question.questionNumber))
        const classificationValid = atomic.length > 0 && atomic.every((question) => question.topicIds !== undefined && question.topicIds.every((id) => validTopicIds.has(id)) && (question.patternId ? validPatternIds.has(question.patternId) : Boolean(question.patternDescription?.trim())))
        const structureValid = questions.every((question) => question.sourcePages.length > 0 && question.sourcePages.every((page) => page < (data.pageCount ?? 0)) &&
          (!question.parentQuestionNumber || (labels.has(question.parentQuestionNumber) && question.parentQuestionNumber !== question.questionNumber)) &&
          (question.marksScope !== 'PARENT_TOTAL' || questions.some((child) => child.parentQuestionNumber === question.questionNumber)))
        if (!data.analysisComplete || !data.syllabusVersionId || data.syllabusVersionId !== analysedCourse?.activeSyllabusVersionId || !classificationValid || !structureValid) {
          published = false; data.reviewReasons.push('Syllabus snapshot, source pages, question structure or classification is incomplete')
        }
      }
      if (published && syllabus && data.curriculum && new Set(data.curriculum.modules.map((module) => module.moduleNo)).size !== data.curriculum.modules.length) {
        published = false; data.reviewReasons.push('Repeated syllabus module numbers')
      }
      let duplicateOfPaperId: string | null = null
      if (data.fileHash) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${data.fileHash}))`
        const original = await tx.file.findUnique({ where: { sha256Hash: data.fileHash }, include: { papers: true } })
        const matching = original?.papers.find((candidate) => candidate.id !== paper?.id && candidate.courseId === paper?.courseId && candidate.analysisComplete && candidate.publicationStatus === 'AUTO_PUBLISHED' && candidate.analysedSyllabusVersionId === data.syllabusVersionId)
        duplicateOfPaperId = matching?.duplicateOfPaperId || matching?.id || null
        if (data.duplicateOfPaperId && duplicateOfPaperId !== data.duplicateOfPaperId) throw new Error('Invalid duplicate reference')
      }
      if (published && ((paper && !data.questions.length) || (syllabus && !data.curriculum))) throw new Error('Cannot publish an empty extraction')
      let nextRetryAt = published ? null : retryAt(job.retryCount)
      if (nextRetryAt && data.retryAfterSeconds) nextRetryAt = new Date(Math.max(nextRetryAt.getTime(), Date.now() + data.retryAfterSeconds * 1000))
      const claimed = await tx.processingJob.updateMany({ where: { id: job.id, status: 'PROCESSING', leaseToken: data.leaseToken, leaseExpiresAt: { gt: new Date() } }, data: { status: published ? 'AUTO_PUBLISHED' : 'RETRY_PENDING', stage: data.stage, errorCategory: data.reviewReasons.join('; ') || null, leaseToken: null, leaseExpiresAt: null, nextRetryAt } })
      if (!claimed.count) return false
      if (material) {
        if (published) {
          await tx.materialChunk.deleteMany({ where: { materialId: material.id } })
          await tx.materialChunk.createMany({ data: chunks.map((chunk, position) => ({ materialId: material.id, position, ...chunk, extractionVersion: MATERIAL_EXTRACTION_VERSION })) })
        }
        await tx.studyMaterial.update({ where: { id: material.id }, data: { publicationStatus: published ? 'AUTO_PUBLISHED' : 'RETRY_PENDING', extractionVersion: data.extractionVersion, pageCount: data.pageCount } })
      }
      await tx.extractionAttempt.updateMany({ where: { jobId: job.id, status: 'PROCESSING' }, data: { status: published ? data.status : 'RETRY_PENDING', provider: data.provider, details: { pages: data.pages ?? [], reasons: data.reviewReasons, questionLabels: questions.map((q) => ({ original: q.originalQuestionNumber, stored: q.questionNumber })) } as Prisma.InputJsonValue } })
      if (!published) await tx.jobRetry.create({ data: { jobId: job.id, reason: data.reviewReasons.join('; ') || data.stage || 'Extraction failed', scheduledAt: nextRetryAt ?? new Date() } })
      await tx.submission.updateMany({ where: { fileId: job.fileId }, data: { status: published ? 'APPROVED' : 'PENDING' } })
      if (data.qualityMetrics) {
        const quality = { ocrConfidence: data.qualityMetrics.ocrConfidence, segmentationCoverage: data.qualityMetrics.segmentationCoverage, questionCount: data.qualityMetrics.questionCount, checks: (data.qualityMetrics.checks ?? {}) as Prisma.InputJsonValue, reasons: data.reviewReasons }
        await tx.qualityResult.upsert({ where: { jobId: job.id }, create: { jobId: job.id, ...quality }, update: quality })
      }
      if (data.fileHash) {
        // Serialize identical uploads on their hash to avoid a unique-constraint race.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${data.fileHash}))`
        const existing = await tx.file.findUnique({ where: { sha256Hash: data.fileHash } })
        if (!existing || existing.id === job.fileId) await tx.file.update({ where: { id: job.fileId }, data: { sha256Hash: data.fileHash } })
      }
      if (syllabus) {
        if (published && data.curriculum) {
          await tx.module.deleteMany({ where: { syllabusVersionId: syllabus.id } })
          for (const syllabusModule of data.curriculum.modules) await tx.module.create({ data: { courseId: syllabus.courseId, syllabusVersionId: syllabus.id, moduleNo: syllabusModule.moduleNo, name: syllabusModule.name, topics: { create: [...new Set(syllabusModule.topics)].map((topicName) => ({ topicName })) } } })
          await tx.course.update({ where: { id: syllabus.courseId }, data: { activeSyllabusVersionId: syllabus.id } })
        }
        await tx.syllabusVersion.update({ where: { id: syllabus.id }, data: { status: published ? 'AUTO_PUBLISHED' : 'RETRY_PENDING' } })
      }
      if (paper) {
        // Retries replace the whole extraction; stale questions and topic links cannot survive.
        await tx.question.deleteMany({ where: { paperId: paper.id } })
        const course = analysedCourse!
        for (const q of questions) {
          const textHash = createHash('sha256').update(q.extractedText.toLowerCase().replace(/\s+/g, ' ').trim()).digest('hex')
          const duplicate = await tx.question.findFirst({ where: { textHash, paper: { courseId: paper.courseId, publicationStatus: 'AUTO_PUBLISHED' } }, select: { id: true } })
          let patternId: string | null = null
          if (q.patternId && data.syllabusVersionId) {
            const pattern = await tx.questionPattern.findFirst({ where: { id: q.patternId, courseId: paper.courseId, syllabusVersionId: data.syllabusVersionId } })
            patternId = pattern?.id || null
          } else if (q.patternDescription && data.syllabusVersionId) {
            const description = q.patternDescription.trim().toLowerCase().replace(/\s+/g, ' ')
            const signature = createHash('sha256').update(description).digest('hex')
            const pattern = await tx.questionPattern.upsert({ where: { courseId_syllabusVersionId_signature: { courseId: paper.courseId, syllabusVersionId: data.syllabusVersionId, signature } }, create: { courseId: paper.courseId, syllabusVersionId: data.syllabusVersionId, signature, description: q.patternDescription }, update: {} })
            patternId = pattern.id
          }
          const saved = await tx.question.create({ data: { paperId: paper.id, questionNumber: q.questionNumber, marks: q.marks, extractedText: q.extractedText, imageCropS3Key: q.imageCropS3Key, pageIndex: q.pageIndex, boundingBox: q.boundingBox as Prisma.InputJsonValue | undefined, textHash, duplicateOfId: duplicate?.id, embeddingModel: q.embeddingModel, sourcePages: q.sourcePages, sharedInstructions: q.sharedInstructions, parentQuestionNumber: q.parentQuestionNumber, marksScope: q.marksScope, patternId } })
          if (q.embedding) {
            const literal = `[${q.embedding.join(',')}]`
            await tx.$executeRaw`UPDATE "Question" SET embedding = ${literal}::vector WHERE id = ${saved.id}`
            if (!duplicate && q.embeddingModel) {
              const similar = await tx.$queryRaw<{ id: string }[]>`SELECT q.id FROM "Question" q JOIN "Paper" p ON p.id = q."paperId" WHERE p."courseId" = ${paper.courseId} AND p."publicationStatus" = 'AUTO_PUBLISHED' AND q."paperId" <> ${paper.id} AND q."embeddingModel" = ${q.embeddingModel} AND (q.embedding <=> ${literal}::vector) < 0.08 ORDER BY q.embedding <=> ${literal}::vector LIMIT 1`
              if (similar[0]) await tx.question.update({ where: { id: saved.id }, data: { duplicateOfId: similar[0].id } })
            }
          }
          for (const topicId of new Set(q.topicIds ?? [])) {
            if (!validTopicIds.has(topicId)) continue
            await tx.questionTopic.create({ data: { questionId: saved.id, topicId } })
          }
          const topicMatches = q.topicIds ? [] : q.topics ?? (q.topic ? [{ name: q.topic, confidence: q.confidence }] : [])
          const linkedTopics = new Set<string>()
          for (const match of topicMatches) {
            const topic = await tx.topic.findFirst({ where: { topicName: { equals: match.name, mode: 'insensitive' }, module: { courseId: paper.courseId, syllabusVersionId: course.activeSyllabusVersionId } } })
            if (topic && !linkedTopics.has(topic.id)) {
              await tx.questionTopic.create({ data: { questionId: saved.id, topicId: topic.id, confidence: match.confidence } })
              linkedTopics.add(topic.id)
            }
          }
        }
        // Until publication, preserve the contributor's supplied year. A guessed
        // year from a failed attempt must not become the next retry's input.
        await tx.paper.update({ where: { id: paper.id }, data: { analysisComplete: published && data.analysisComplete, extractionVersion: data.extractionVersion, analysedSyllabusVersionId: data.syllabusVersionId, duplicateOfPaperId, sharedInstructions: data.sharedInstructions, publicationStatus: published ? 'AUTO_PUBLISHED' : 'RETRY_PENDING', ...(published && data.year ? { year: data.year } : {}) } })
      }
      return true
    }, { timeout: 120_000 })
    return NextResponse.json({ success: result }, { status: result ? 200 : 409 })
  } catch (error) { return apiError('Job result rejected:', error, 'Could not persist extraction.') }
}
