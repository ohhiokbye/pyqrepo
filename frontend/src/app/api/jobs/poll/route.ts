import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isWorker } from '@/lib/auth'
import { retryAt } from '@/lib/jobs/retry'
import { apiError } from '@/lib/apiError'

export async function POST(req: NextRequest) {
  if (!isWorker(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const now = new Date()
    // A dead worker loses its lease. A later poll recovers its jobs, even after a restart.
    const expired = await prisma.processingJob.findMany({ where: { status: 'PROCESSING', OR: [{ leaseExpiresAt: { lt: now } }, { leaseExpiresAt: null }] }, take: 100 })
    for (const job of expired) {
      await prisma.$transaction(async (tx) => {
        const scheduledAt = retryAt(job.retryCount)
        const result = await tx.processingJob.updateMany({ where: { id: job.id, status: 'PROCESSING', leaseToken: job.leaseToken, OR: [{ leaseExpiresAt: { lt: now } }, { leaseExpiresAt: null }] }, data: { status: 'RETRY_PENDING', leaseToken: null, leaseExpiresAt: null, nextRetryAt: scheduledAt, errorCategory: 'Worker lease expired' } })
        if (result.count) {
          await tx.paper.updateMany({ where: { fileId: job.fileId }, data: { publicationStatus: 'RETRY_PENDING' } })
          await tx.syllabusVersion.updateMany({ where: { fileId: job.fileId }, data: { status: 'RETRY_PENDING' } })
          await tx.studyMaterial.updateMany({ where: { fileId: job.fileId }, data: { publicationStatus: 'RETRY_PENDING' } })
          await tx.jobRetry.create({ data: { jobId: job.id, reason: 'Worker lease expired', scheduledAt: scheduledAt ?? now } })
          await tx.extractionAttempt.updateMany({ where: { jobId: job.id, status: 'PROCESSING' }, data: { status: 'LEASE_EXPIRED' } })
        }
      })
    }
    const jobs = await prisma.processingJob.findMany({
      where: { status: { in: ['PENDING', 'RETRY_PENDING'] }, nextRetryAt: { lte: now } },
      orderBy: { createdAt: 'asc' }, take: 20,
      include: { file: { include: { papers: { include: { course: true } }, syllabusVersions: { include: { course: true } }, materials: { include: { course: true } } } } },
    })
    return NextResponse.json({ jobs: jobs.map((job) => {
      const paper = job.file.papers[0]
      const syllabus = job.file.syllabusVersions[0]
      return { id: job.id, s3Key: job.file.s3Key, documentType: paper ? 'PYQ' : syllabus ? 'CURRICULUM' : 'STUDY_MATERIAL', courseCode: (paper?.course ?? syllabus?.course ?? job.file.materials[0]?.course)?.code, year: paper?.year, examType: paper?.examType }
    }) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return apiError('Job poll failed', error, 'Could not poll jobs.') }
}
