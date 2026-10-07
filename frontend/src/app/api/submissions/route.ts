import { requireAdmin } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { apiError } from '@/lib/apiError'

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req)
  if (admin instanceof NextResponse) return admin
  try {
    const submissions = await prisma.submission.findMany({
      orderBy: { submittedAt: 'desc' },
      take: 100,
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
            jobs: { include: { qualityResult: true, attempts: true, retries: true } },
            syllabusVersions: { include: { course: true } },
          },
        },
      },
    })

    return NextResponse.json({ submissions })
  } catch (error) {
    return apiError('Failed to fetch submissions:', error, 'Failed to fetch submissions.')
  }
}
