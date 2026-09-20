import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  // Internal-only endpoint: validate worker key or passphrase
  const authHeader = req.headers.get('x-internal-worker-key')
  const expectedPassphrase = process.env.UPLOAD_PASSPHRASE

  // Allow calls from worker (no auth header) only from localhost, 
  // or validate against passphrase if header is present
  const isLocalRequest = req.headers.get('host')?.startsWith('localhost')
  if (!isLocalRequest && authHeader !== expectedPassphrase) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { jobId, status, stage, reviewReasons, questions, year, fileHash } = body

    if (!jobId || !status) {
      return NextResponse.json({ error: 'jobId and status are required' }, { status: 400 })
    }

    // 1. Update the ProcessingJob status
    const job = await prisma.processingJob.update({
      where: { id: jobId },
      data: {
        status,
        stage: stage || 'COMPLETED',
        errorCategory: reviewReasons && reviewReasons.length > 0 ? reviewReasons.join('; ') : null,
      },
      include: {
        file: {
          include: {
            papers: true,
            submissions: true,
          },
        },
      },
    })

    // 2. Sync Submission.status with the job outcome
    const submissionStatus = status === 'COMPLETED' ? 'APPROVED' : status === 'FAILED' ? 'REJECTED' : 'PENDING'
    for (const submission of job.file.submissions) {
      await prisma.submission.update({
        where: { id: submission.id },
        data: { status: submissionStatus },
      })
    }

    const paper = job.file.papers[0]

    // 3. Update Paper.year if detected or provided
    if (paper && year) {
      try {
        await prisma.paper.update({
          where: { id: paper.id },
          data: { year: Number(year) },
        })
      } catch (yearErr) {
        console.warn('Could not update paper year:', yearErr)
      }
    }

    // 4. Update File.sha256Hash with actual computed hash
    if (fileHash) {
      try {
        const existingWithHash = await prisma.file.findFirst({
          where: { sha256Hash: fileHash, id: { not: job.file.id } },
        })
        if (!existingWithHash) {
          await prisma.file.update({
            where: { id: job.file.id },
            data: { sha256Hash: fileHash },
          })
        }
      } catch (hashErr) {
        console.warn('Could not update file sha256Hash:', hashErr)
      }
    }

    // 5. Persist atomic questions into PostgreSQL if paper exists
    if (paper && Array.isArray(questions) && questions.length > 0) {
      const existingCount = await prisma.question.count({
        where: { paperId: paper.id },
      })

      if (existingCount === 0) {
        for (const q of questions) {
          const createdQ = await prisma.question.create({
            data: {
              paperId: paper.id,
              questionNumber: q.questionNumber || 'Q',
              extractedText: q.extractedText || '',
              marks: q.marks ? Number(q.marks) : null,
              imageCropS3Key: q.imageCropS3Key || null,
            },
          })

          // Link with topic if topic is classified and belongs to this course
          if (q.topic && q.topic.toLowerCase().trim() !== 'general' && q.topic.toLowerCase().trim() !== 'none') {
            const matchedTopic = await prisma.topic.findFirst({
              where: {
                module: {
                  courseId: paper.courseId,
                },
                topicName: {
                  contains: q.topic,
                  mode: 'insensitive',
                },
              },
            })

            if (matchedTopic) {
              await prisma.questionTopic.create({
                data: {
                  questionId: createdQ.id,
                  topicId: matchedTopic.id,
                  confidence: q.confidence ? Number(q.confidence) : 0.85,
                },
              })
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      jobId,
      updatedStatus: status,
      submissionStatus,
      questionsSaved: questions ? questions.length : 0,
    })
  } catch (error) {
    console.error('Job update error:', error)
    return NextResponse.json(
      {
        error: 'Failed to update job in database',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
