import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import crypto from 'crypto'

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
  const authHeader = req.headers.get('authorization')
  const expectedPassphrase = process.env.UPLOAD_PASSPHRASE

  if (!expectedPassphrase || authHeader !== `Bearer ${expectedPassphrase}`) {
    return NextResponse.json({ error: 'Unauthorized: Invalid or missing upload passphrase' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const result = finalizeSchema.safeParse(body)
    
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid payload', details: result.error.errors }, { status: 400 })
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

    // Generate placeholder sha256 to satisfy unique constraint.
    // Worker computes the real SHA-256 and detects duplicates.
    const tempSha = crypto.randomBytes(32).toString('hex') + '-temp'

    const fileRecord = await prisma.file.create({
      data: {
        s3Key,
        sha256Hash: tempSha,
      }
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
    fetch('http://localhost:8000/jobs/process', {
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
    console.error("Upload finalize error:", error)
    return NextResponse.json({ 
      error: 'Internal server error during finalization', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 })
  }
}
