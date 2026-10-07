import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isWorker } from '@/lib/auth'
import { apiError } from '@/lib/apiError'

export async function GET(req: NextRequest) {
  if (!isWorker(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const job = await prisma.processingJob.findFirst({ where: { id: req.nextUrl.searchParams.get('jobId') || '', status: 'PROCESSING', leaseToken: req.headers.get('x-job-lease') || '', leaseExpiresAt: { gt: new Date() } }, include: { file: { include: { papers: true, syllabusVersions: true, materials: { include: { pages: { orderBy: { pageIndex: 'asc' } } } } } } } })
    if (!job) return NextResponse.json({ error: 'Active lease required' }, { status: 409 })
    const material = job.file.materials[0]
    const courseId = job.file.papers[0]?.courseId || job.file.syllabusVersions[0]?.courseId || material?.courseId
    if (!courseId) return NextResponse.json({ error: 'Job course not found' }, { status: 404 })
    const course = await prisma.course.findUniqueOrThrow({ where: { id: courseId } })
    const modules = await prisma.module.findMany({ where: { courseId, syllabusVersionId: course.activeSyllabusVersionId }, include: { topics: true } })
    const patterns = course.activeSyllabusVersionId ? await prisma.questionPattern.findMany({ where: { courseId, syllabusVersionId: course.activeSyllabusVersionId }, select: { id: true, description: true, signature: true } }) : []
    return NextResponse.json({ courseCode: course.code, syllabusVersionId: course.activeSyllabusVersionId, topics: modules.flatMap((module) => module.topics.map((topic) => ({ id: topic.id, name: topic.topicName, module: module.name }))), patterns, material: material ? { id: material.id, title: material.title, pages: material.pages } : null }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return apiError('Worker context failed', error, 'Could not load extraction context.') }
}
