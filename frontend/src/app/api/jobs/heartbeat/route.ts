import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isWorker } from '@/lib/auth'
import { readJsonBody } from '@/lib/requestBody'
import { apiError } from '@/lib/apiError'
import { z } from 'zod'
import { LEASE_MS } from '@/lib/jobs/retry'

export async function POST(req: NextRequest) {
  if (!isWorker(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const parsed = z.object({ jobId: z.string().min(1).max(200), leaseToken: z.string().min(1).max(200) }).safeParse(await readJsonBody(req))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid lease' }, { status: 400 })
    const { jobId, leaseToken } = parsed.data
    const result = await prisma.processingJob.updateMany({ where: { id: jobId, status: 'PROCESSING', leaseToken, leaseExpiresAt: { gt: new Date() } }, data: { leaseExpiresAt: new Date(Date.now() + LEASE_MS) } })
    return NextResponse.json({ renewed: result.count === 1 }, { status: result.count ? 200 : 409 })
  } catch (error) { return apiError('jobs.heartbeat', error, 'Could not renew lease.') }
}
