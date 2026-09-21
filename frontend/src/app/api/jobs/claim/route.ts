import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { apiError } from '@/lib/apiError'

/**
 * Atomically claims a PENDING job by flipping it to PROCESSING in a single
 * UPDATE ... WHERE, so the worker's in-memory "already processing" set is only
 * an optimization, not the source of truth. This is what actually prevents
 * double-processing across worker restarts or multiple worker instances.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('x-internal-worker-key')
  const expectedKey = process.env.WORKER_INTERNAL_KEY

  if (!expectedKey || authHeader !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { jobId } = await req.json()
    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 })
    }

    const result = await prisma.processingJob.updateMany({
      where: { id: jobId, status: 'PENDING' },
      data: { status: 'PROCESSING' },
    })

    return NextResponse.json({ claimed: result.count > 0 })
  } catch (error) {
    return apiError('Job claim error:', error, 'Failed to claim job.')
  }
}
