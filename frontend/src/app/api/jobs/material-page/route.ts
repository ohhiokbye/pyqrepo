import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { isWorker } from '@/lib/auth'
import { apiError } from '@/lib/apiError'
import { MATERIAL_EXTRACTION_VERSION, materialPageSchema } from '@/lib/materials'
import { readJsonBody } from '@/lib/requestBody'

const schema = z.object({
  jobId: z.string().min(1).max(100), leaseToken: z.string().uuid(),
  fileHash: z.string().regex(/^[a-f0-9]{64}$/),
  extractionVersion: z.literal(MATERIAL_EXTRACTION_VERSION),
  pageCount: z.number().int().min(1).max(200), page: materialPageSchema,
})

export async function POST(req: NextRequest) {
  if (!isWorker(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const parsed = schema.safeParse(await readJsonBody(req, 512 * 1024))
    if (!parsed.success || parsed.data.page.pageIndex >= parsed.data.pageCount) return NextResponse.json({ error: 'Invalid page checkpoint' }, { status: 400 })
    const data = parsed.data
    const saved = await prisma.$transaction(async (tx) => {
      // Lock the active lease against concurrent expiry/retry/result writes.
      const active = await tx.processingJob.updateMany({ where: { id: data.jobId, status: 'PROCESSING', leaseToken: data.leaseToken, leaseExpiresAt: { gt: new Date() } }, data: { stage: 'NOTES_EXTRACTION' } })
      if (!active.count) return false
      const job = await tx.processingJob.findUniqueOrThrow({ where: { id: data.jobId }, include: { file: { include: { materials: true } } } })
      const material = job.file.materials[0]
      if (!material) return false
      const page = { ...data.page, fileHash: data.fileHash, extractionVersion: data.extractionVersion }
      await tx.materialPage.upsert({ where: { materialId_pageIndex: { materialId: material.id, pageIndex: page.pageIndex } }, create: { materialId: material.id, ...page }, update: page })
      return true
    })
    return NextResponse.json({ success: saved }, { status: saved ? 200 : 409, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return apiError('Page checkpoint failed', error, 'Could not save page checkpoint.') }
}
