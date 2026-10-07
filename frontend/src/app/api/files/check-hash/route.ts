import { isWorker } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { apiError } from '@/lib/apiError'
import { EXTRACTION_VERSION } from '@/lib/examAnalysis'

export async function GET(req: NextRequest) {
  if (!isWorker(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const hash = req.nextUrl.searchParams.get('hash')
  const jobId = req.nextUrl.searchParams.get('jobId')

  if (!hash) {
    return NextResponse.json({ error: 'Missing hash parameter' }, { status: 400 })
  }

  try {
    let excludeFileId: string | undefined
    let currentPaper: { courseId: string; examType: string; year: number | null } | undefined
    if (jobId) {
      const currentJob = await prisma.processingJob.findUnique({
        where: { id: jobId },
        select: { fileId: true, file: { include: { papers: true } } },
      })
      if (currentJob) { excludeFileId = currentJob.fileId; currentPaper = currentJob.file.papers[0] }
    }

    const existingFile = await prisma.file.findFirst({
      where: {
        sha256Hash: hash,
        ...(excludeFileId ? { id: { not: excludeFileId } } : {}),
      },
      include: {
        papers: {
          where: { publicationStatus: 'AUTO_PUBLISHED', ...(currentPaper ? { courseId: currentPaper.courseId, examType: currentPaper.examType, ...(currentPaper.year ? { year: currentPaper.year } : {}) } : {}) },
          include: {
            questions: {
              include: {
                pattern: true,
                questionTopics: {
                  include: {
                    topic: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (existingFile && existingFile.papers.length > 0) {
      const paper = existingFile.papers[0]
      if (paper.questions.length > 0) {
        // Embeddings live in a pgvector "Unsupported" column Prisma can't select
        // normally - fetched separately via raw SQL so a reused duplicate paper
        // keeps its questions semantically searchable too, not just the original.
        const course = await prisma.course.findUniqueOrThrow({ where: { id: paper.courseId } })

        return NextResponse.json({
          exists: true,
          analysisComplete: paper.analysisComplete && paper.extractionVersion === EXTRACTION_VERSION && paper.analysedSyllabusVersionId === course.activeSyllabusVersionId,
          syllabusVersionId: paper.analysedSyllabusVersionId,
          sharedInstructions: paper.sharedInstructions,
          pageCount: Math.max(0, ...paper.questions.flatMap((question) => question.sourcePages)) + 1,
          existingFileId: existingFile.id,
          paperId: paper.id,
          year: paper.year,
          questions: paper.questions.map((q) => ({
            questionNumber: q.questionNumber,
            marks: q.marks,
            extractedText: q.extractedText,
            imageCropS3Key: q.imageCropS3Key,
            pageIndex: q.pageIndex,
            boundingBox: q.boundingBox,
            embeddingModel: q.embeddingModel,
            topic: q.questionTopics[0]?.topic?.topicName || 'General',
            confidence: q.questionTopics[0]?.confidence || 0.85,
            topics: q.questionTopics.map((link) => ({ name: link.topic.topicName, confidence: link.confidence ?? 0 })),
            sourcePages: q.sourcePages, sharedInstructions: q.sharedInstructions, parentQuestionNumber: q.parentQuestionNumber, marksScope: q.marksScope, patternId: q.patternId, patternDescription: q.pattern?.description, topicIds: q.questionTopics.map((link) => link.topicId),
          })),
        })
      }
    }

    return NextResponse.json({ exists: false })
  } catch (error) {
    return apiError('Check-hash error:', error, 'Failed to verify file hash.')
  }
}
