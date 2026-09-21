import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { apiError } from '@/lib/apiError'
import { setQuestionEmbedding } from '@/lib/embeddings'

const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = 'P2002'

export async function POST(req: NextRequest) {
  // Internal-only endpoint: the worker must present the shared internal key.
  // Never trust client-controlled headers (e.g. Host) to decide trust.
  const authHeader = req.headers.get('x-internal-worker-key')
  const expectedKey = process.env.WORKER_INTERNAL_KEY

  if (!expectedKey || authHeader !== expectedKey) {
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

    // 4. Update File.sha256Hash with the actual computed hash.
    // sha256Hash is nullable+unique, so we rely on the DB constraint instead of a
    // check-then-act race: if another file already claimed this hash concurrently,
    // the update throws P2002 and we simply leave this file's hash unset.
    if (fileHash) {
      try {
        await prisma.file.update({
          where: { id: job.file.id },
          data: { sha256Hash: fileHash },
        })
      } catch (hashErr) {
        if (hashErr instanceof Prisma.PrismaClientKnownRequestError && hashErr.code === PRISMA_UNIQUE_CONSTRAINT_VIOLATION) {
          console.warn(`File ${job.file.id}: hash ${fileHash} already claimed by another file; leaving unset.`)
        } else {
          console.warn('Could not update file sha256Hash:', hashErr)
        }
      }
    }

    // 5. Persist atomic questions into PostgreSQL if paper exists.
    // Each question is upserted on the (paperId, questionNumber) unique constraint,
    // so retries or concurrent double-processing of the same job never create
    // duplicate rows instead of relying on a racy "existingCount === 0" pre-check.
    let questionsSaved = 0
    if (paper && Array.isArray(questions) && questions.length > 0) {
      for (const q of questions) {
        const questionNumber = q.questionNumber || 'Q'
        const createdQ = await prisma.question.upsert({
          where: { paperId_questionNumber: { paperId: paper.id, questionNumber } },
          update: {
            extractedText: q.extractedText || '',
            marks: q.marks ? Number(q.marks) : null,
            imageCropS3Key: q.imageCropS3Key || null,
          },
          create: {
            paperId: paper.id,
            questionNumber,
            extractedText: q.extractedText || '',
            marks: q.marks ? Number(q.marks) : null,
            imageCropS3Key: q.imageCropS3Key || null,
          },
        })
        questionsSaved += 1

        // Semantic search vector from the worker (Gemini embedding API) - written via
        // raw SQL since Prisma can't touch the pgvector "Unsupported" column directly.
        if (q.embedding) {
          await setQuestionEmbedding(createdQ.id, q.embedding)
        }

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
            await prisma.questionTopic.upsert({
              where: { questionId_topicId: { questionId: createdQ.id, topicId: matchedTopic.id } },
              update: { confidence: q.confidence ? Number(q.confidence) : 0.85 },
              create: {
                questionId: createdQ.id,
                topicId: matchedTopic.id,
                confidence: q.confidence ? Number(q.confidence) : 0.85,
              },
            })
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      jobId,
      updatedStatus: status,
      submissionStatus,
      questionsSaved,
    })
  } catch (error) {
    return apiError('Job update error:', error, 'Failed to update job in database.')
  }
}
