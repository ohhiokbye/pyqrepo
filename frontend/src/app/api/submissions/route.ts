import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { apiError } from '@/lib/apiError'

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
    return apiError('Failed to fetch submissions:', error, 'Failed to fetch submissions.')
  }
}
