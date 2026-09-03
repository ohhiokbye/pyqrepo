import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

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

    return NextResponse.json({ courses })
  } catch (error) {
    console.error('Failed to fetch courses:', error)
    return NextResponse.json(
      {
        error: 'Failed to connect to database or fetch courses',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
