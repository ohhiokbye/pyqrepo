import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { readJsonBody } from '@/lib/requestBody'
import { apiError } from '@/lib/apiError'
import { z } from 'zod'

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req)
  if (admin instanceof NextResponse) return admin
  const versions = await prisma.syllabusVersion.findMany({ orderBy: { extractedAt: 'desc' }, take: 100, include: { course: true, modules: { include: { topics: true } } } })
  return NextResponse.json({ versions })
}
export async function POST(req: NextRequest) {
  const admin = requireAdmin(req)
  if (admin instanceof NextResponse) return admin
  try {
    const parsed = z.object({ versionId: z.string().min(1).max(200) }).safeParse(await readJsonBody(req))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid syllabus request' }, { status: 400 })
    const { versionId } = parsed.data
    const version = await prisma.syllabusVersion.findFirst({ where: { id: versionId, status: 'AUTO_PUBLISHED', modules: { some: {} } } })
    if (!version) return NextResponse.json({ error: 'Only an automatically published version can be activated.' }, { status: 409 })
    await prisma.course.update({ where: { id: version.courseId }, data: { activeSyllabusVersionId: version.id } })
    return NextResponse.json({ activated: true })
  } catch (error) { return apiError('admin.syllabus', error, 'Could not update administration request.') }
}
