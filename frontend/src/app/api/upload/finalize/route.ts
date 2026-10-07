import { uploadedPdfExists } from '@/lib/storage'
import { verifyUploadToken } from '@/lib/storage/uploadToken'
import { requireUploadAccess } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { apiError } from '@/lib/apiError'
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit'
import { checkPersistentRateLimit } from '@/lib/persistentRateLimit'
import { readJsonBody } from '@/lib/requestBody'



// The upload passphrase is a single shared secret with no lockout, so guard
// against brute-force guessing with a per-IP attempt limit.
const PASSPHRASE_ATTEMPT_LIMIT = 10
const PASSPHRASE_ATTEMPT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes

const finalizeSchema = z.object({
  s3Key: z.string().regex(/^uploads\/submissions\/[a-zA-Z0-9._-]+\.pdf$/i),
  uploadToken: z.string().min(1),
  documentType: z.enum(['PYQ', 'STUDY_MATERIAL', 'CURRICULUM']),
  courseId: z.string().min(1).optional(),
  courseCode: z.string().min(2).max(20).optional(),
  courseTitle: z.string().min(2).max(200).optional(),
  // Fields for PYQ
  examType: z.enum(['CAT1', 'CAT2', 'FAT']).optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  // Fields for STUDY_MATERIAL
  title: z.string().trim().min(1).max(200).optional(),
})

export async function POST(req: NextRequest) {
  if (!checkRateLimit(`upload-finalize:${getClientIdentifier(req)}`, PASSPHRASE_ATTEMPT_LIMIT, PASSPHRASE_ATTEMPT_WINDOW_MS)) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 })
  }

  try {
    if (!await checkPersistentRateLimit('upload-finalize', getClientIdentifier(req), PASSPHRASE_ATTEMPT_LIMIT, PASSPHRASE_ATTEMPT_WINDOW_MS)) return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 })
    const uploader = requireUploadAccess(req)
    if (uploader instanceof NextResponse) return uploader
    const body = await readJsonBody(req)
    const result = finalizeSchema.safeParse(body)
    
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid payload', details: result.error.issues }, { status: 400 })
    }

    const { s3Key, uploadToken, documentType, courseId: requestedCourseId, courseCode, courseTitle, examType, year, title } = result.data
    if (!uploader.isAdmin && documentType !== 'PYQ') return NextResponse.json({ error: 'Contributor access allows question papers only.' }, { status: 403 })

    if (!verifyUploadToken(s3Key, uploadToken)) return NextResponse.json({ error: 'Upload authorization expired.' }, { status: 403 })
    if (documentType === 'PYQ' && !examType) return NextResponse.json({ error: 'Exam type is required.' }, { status: 400 })
    if (documentType === 'STUDY_MATERIAL' && !title) return NextResponse.json({ error: 'Title is required.' }, { status: 400 })

    if (!(await uploadedPdfExists(s3Key))) return NextResponse.json({ error: 'PDF is missing or exceeds 25 MB. Upload it again.' }, { status: 400 })
    let courseId = requestedCourseId
    if (documentType === 'CURRICULUM') {
      if (!courseCode || !courseTitle) return NextResponse.json({ error: 'courseCode and courseTitle are required for CURRICULUM' }, { status: 400 })
      const course = await prisma.course.upsert({
        where: { code: courseCode.trim().toUpperCase() },
        update: { title: courseTitle.trim() },
        create: { code: courseCode.trim().toUpperCase(), title: courseTitle.trim(), credits: 0 },
      })
      courseId = course.id
    }

    if (!courseId) return NextResponse.json({ error: 'courseId is required for non-curriculum uploads.' }, { status: 400 })
    // Verify course exists before creating paper/material
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    })

    if (!course) {
      return NextResponse.json({
        error: `Course with id '${courseId}' does not exist in the database. Please select a valid course.`,
      }, { status: 400 })
    }

    const { submission, job } = await prisma.$transaction(async (tx) => {
      const fileRecord = await tx.file.create({ data: { s3Key } })
      const submission = await tx.submission.create({ data: { fileId: fileRecord.id, status: 'PENDING', contributorId: uploader.email } })
      if (documentType === 'PYQ') {
        await tx.paper.create({ data: { fileId: fileRecord.id, courseId: course.id, examType: examType!, year: year ?? null, publicationStatus: 'PROCESSING' } })
      } else if (documentType === 'CURRICULUM') {
        const latest = await tx.syllabusVersion.findFirst({ where: { courseId: course.id }, orderBy: { version: 'desc' } })
        await tx.syllabusVersion.create({ data: { courseId: course.id, fileId: fileRecord.id, version: (latest?.version ?? 0) + 1, status: 'PROCESSING' } })
      } else {
        await tx.studyMaterial.create({ data: { fileId: fileRecord.id, courseId: course.id, title: title!, documentType: 'NOTES' } })
      }
      const job = await tx.processingJob.create({ data: { fileId: fileRecord.id, status: 'PENDING', stage: 'CREATED' } })
      return { submission, job }
    }, { isolationLevel: 'Serializable' })
    // The local worker polls outbound; uploads queue safely while it is offline.

    return NextResponse.json({ success: true, submissionId: submission.id, jobId: job.id })
  } catch (error) {
    return apiError('Upload finalize error:', error, 'Failed to finalize upload. Please try again.')
  }
}
