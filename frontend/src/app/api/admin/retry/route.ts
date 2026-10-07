import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { readJsonBody } from '@/lib/requestBody'
import { apiError } from '@/lib/apiError'
import { z } from 'zod'

export async function POST(req: NextRequest) {
  const admin = requireAdmin(req)
  if (admin instanceof NextResponse) return admin
  try {
    const parsed = z.object({ jobId: z.string().min(1).max(200), reanalyse: z.boolean().optional() }).safeParse(await readJsonBody(req))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid retry request' }, { status: 400 })
    const { jobId, reanalyse } = parsed.data
    const queued = await prisma.$transaction(async (tx) => {
      const result = await tx.processingJob.updateMany({ where: { id: jobId, status: { in: reanalyse === true ? ['FAILED', 'RETRY_PENDING', 'AUTO_PUBLISHED', 'COMPLETED'] : ['FAILED', 'RETRY_PENDING'] } }, data: { status: 'PENDING', nextRetryAt: new Date(), retryCount: 0, leaseToken: null, leaseExpiresAt: null } })
      if (result.count && reanalyse === true) {
        const job = await tx.processingJob.findUniqueOrThrow({ where: { id: jobId } })
        await tx.paper.updateMany({ where: { fileId: job.fileId }, data: { analysisComplete: false } })
        await tx.studyMaterial.updateMany({ where: { fileId: job.fileId }, data: { publicationStatus: 'PROCESSING' } })
        // Explicit reanalysis recomputes pages; automatic retries reuse checkpoints.
        await tx.materialPage.deleteMany({ where: { material: { fileId: job.fileId } } })
      }
      if (result.count) await tx.jobRetry.create({ data: { jobId, reason: `Admin retry by ${admin.email}`, scheduledAt: new Date() } })
      return result.count === 1
    })
    return NextResponse.json({ queued }, { status: queued ? 200 : 409 })
  } catch (error) { return apiError('admin.retry', error, 'Could not update administration request.') }
}
