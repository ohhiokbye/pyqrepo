import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { apiError } from '@/lib/apiError'
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit'

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8000'

// The upload passphrase is a single shared secret with no lockout, so guard
// against brute-force guessing with a per-IP attempt limit.
const PASSPHRASE_ATTEMPT_LIMIT = 10
const PASSPHRASE_ATTEMPT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes

const finalizeSchema = z.object({
  s3Key: z.string().min(1),
  documentType: z.enum(['PYQ', 'STUDY_MATERIAL']),
  courseId: z.string().min(1),
  // Fields for PYQ
  examType: z.string().optional(),
  year: z.number().int().optional(),
  // Fields for STUDY_MATERIAL
  title: z.string().optional(),
})

export async function POST(req: NextRequest) {
  if (!checkRateLimit(`upload-finalize:${getClientIdentifier(req)}`, PASSPHRASE_ATTEMPT_LIMIT, PASSPHRASE_ATTEMPT_WINDOW_MS)) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 })
  }

  const authHeader = req.headers.get('authorization')
  const expectedPassphrase = process.env.UPLOAD_PASSPHRASE

  if (!expectedPassphrase || authHeader !== `Bearer ${expectedPassphrase}`) {
    return NextResponse.json({ error: 'Unauthorized: Invalid or missing upload passphrase' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const result = finalizeSchema.safeParse(body)
    
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid payload', details: result.error.issues }, { status: 400 })
    }

    const { s3Key, documentType, courseId, examType, year, title } = result.data

    // Verify course exists before creating paper/material
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    })

    if (!course) {
      return NextResponse.json({
        error: `Course with id '${courseId}' does not exist in the database. Please select a valid course.`,
      }, { status: 400 })
    }

    // sha256Hash starts null; the worker computes the real hash once it downloads
    // the file and reports it back via /api/jobs/update.
    const fileRecord = await prisma.file.create({
      data: { s3Key }
    })

    const submission = await prisma.submission.create({
      data: {
        fileId: fileRecord.id,
        status: 'PENDING',
      }
    })

    if (documentType === 'PYQ') {
      if (!examType) {
        return NextResponse.json({ error: 'examType is required for PYQ' }, { status: 400 })
      }
      await prisma.paper.create({
        data: {
          fileId: fileRecord.id,
          courseId,
          examType,
          year: year ?? null
        }
      })
    } else {
      if (!title) {
        return NextResponse.json({ error: 'title is required for STUDY_MATERIAL' }, { status: 400 })
      }
      await prisma.studyMaterial.create({
        data: {
          fileId: fileRecord.id,
          courseId,
          title,
          documentType: 'NOTES'
        }
      })
    }

    const job = await prisma.processingJob.create({
      data: {
        fileId: fileRecord.id,
        status: 'PENDING',
        stage: 'CREATED'
      }
    })

    // Asynchronously dispatch job to the Python worker without blocking HTTP response
    fetch(`${WORKER_URL}/jobs/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId: job.id,
        s3Key,
        documentType,
        courseCode: course.code,
        year: year || null
      })
    }).catch((err) => {
      // Worker offline or busy; job remains PENDING in database
      console.warn('Worker dispatch note:', err instanceof Error ? err.message : String(err))
    })

    return NextResponse.json({ success: true, submissionId: submission.id, jobId: job.id })
  } catch (error) {
    return apiError('Upload finalize error:', error, 'Failed to finalize upload. Please try again.')
  }
}
