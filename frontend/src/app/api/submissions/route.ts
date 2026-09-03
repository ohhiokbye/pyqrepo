import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const submissions = await prisma.submission.findMany({
      orderBy: { submittedAt: 'desc' },
      take: 10,
      include: {
        file: {
          include: {
            papers: {
              include: {
                course: true,
                questions: {
                  include: {
                    questionTopics: {
                      include: {
                        topic: true,
                      },
                    },
                  },
                },
              },
            },
            materials: {
              include: {
                course: true,
              },
            },
            jobs: true,
          },
        },
      },
    })

    return NextResponse.json({ submissions })
  } catch (error) {
    console.error('Failed to fetch submissions:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch submissions',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
