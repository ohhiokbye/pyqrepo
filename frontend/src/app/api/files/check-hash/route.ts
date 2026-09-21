import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { apiError } from '@/lib/apiError'
import { getQuestionEmbeddings } from '@/lib/embeddings'

export async function GET(req: NextRequest) {
  const hash = req.nextUrl.searchParams.get('hash')
  const jobId = req.nextUrl.searchParams.get('jobId')

  if (!hash) {
    return NextResponse.json({ error: 'Missing hash parameter' }, { status: 400 })
  }

  try {
    let excludeFileId: string | undefined
    if (jobId) {
      const currentJob = await prisma.processingJob.findUnique({
        where: { id: jobId },
        select: { fileId: true },
      })
      if (currentJob) excludeFileId = currentJob.fileId
    }

    const existingFile = await prisma.file.findFirst({
      where: {
        sha256Hash: hash,
        ...(excludeFileId ? { id: { not: excludeFileId } } : {}),
      },
      include: {
        papers: {
          include: {
            questions: {
              include: {
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
        const embeddings = await getQuestionEmbeddings(paper.questions.map((q) => q.id))

        return NextResponse.json({
          exists: true,
          existingFileId: existingFile.id,
          paperId: paper.id,
          year: paper.year,
          questions: paper.questions.map((q) => ({
            questionNumber: q.questionNumber,
            marks: q.marks,
            extractedText: q.extractedText,
            imageCropS3Key: q.imageCropS3Key,
            topic: q.questionTopics[0]?.topic?.topicName || 'General',
            confidence: q.questionTopics[0]?.confidence || 0.85,
            embedding: embeddings[q.id] ?? null,
          })),
        })
      }
    }

    return NextResponse.json({ exists: false })
  } catch (error) {
    return apiError('Check-hash error:', error, 'Failed to verify file hash.')
  }
}
