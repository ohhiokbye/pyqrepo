import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { apiError } from '@/lib/apiError'

export async function GET() {
  try {
    const courses = await prisma.course.findMany({
      include: {
        modules: {
          include: {
            topics: true,
          },
        },
      },
      orderBy: { code: 'asc' },
    })

    return NextResponse.json({ courses: courses.map((course) => ({ ...course, modules: course.modules.filter((module) => module.syllabusVersionId === course.activeSyllabusVersionId) })) })
  } catch (error) {
    return apiError('Failed to fetch courses:', error, 'Failed to fetch courses.')
  }
}
