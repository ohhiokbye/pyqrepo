import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { apiError } from '@/lib/apiError'
import { isWorker } from '@/lib/auth'
import { LEASE_MS } from '@/lib/jobs/retry'

export async function POST(req: NextRequest) {
  if (!isWorker(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { jobId } = await req.json()
    if (typeof jobId !== 'string' || !jobId) return NextResponse.json({ error: 'jobId is required' }, { status: 400 })
    const leaseToken = randomUUID()
    const now = new Date()
    const claimed = await prisma.$transaction(async (tx) => {
      const result = await tx.processingJob.updateMany({ where: { id: jobId, status: { in: ['PENDING', 'RETRY_PENDING'] }, nextRetryAt: { lte: now } }, data: { status: 'PROCESSING', leaseToken, leaseExpiresAt: new Date(now.getTime() + LEASE_MS), retryCount: { increment: 1 }, nextRetryAt: null } })
      if (result.count) await tx.extractionAttempt.create({ data: { jobId, provider: 'pending', status: 'PROCESSING', details: { leaseToken } } })
      return Boolean(result.count)
    })
    return NextResponse.json({ claimed, leaseToken: claimed ? leaseToken : null })
  } catch (error) { return apiError('Job claim error:', error, 'Failed to claim job.') }
}
