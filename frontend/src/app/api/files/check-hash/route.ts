import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

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
          })),
        })
      }
    }

    return NextResponse.json({ exists: false })
  } catch (error) {
    console.error('Check-hash error:', error)
    return NextResponse.json(
      {
        error: 'Failed to verify file hash',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
