import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const courseCode = searchParams.get('courseCode')
    const topic = searchParams.get('topic')
    const yearStr = searchParams.get('year')
    const examType = searchParams.get('examType')
    const search = searchParams.get('search')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const skip = (page - 1) * limit

    const year = yearStr ? parseInt(yearStr, 10) : undefined

    const where: Prisma.QuestionWhereInput = {
      paper: {
        ...(courseCode ? { course: { code: courseCode } } : {}),
        ...(year ? { year } : {}),
        ...(examType ? { examType } : {}),
      },
      ...(topic
        ? {
            questionTopics: {
              some: {
                topic: {
                  topicName: {
                    contains: topic,
                    mode: 'insensitive',
                  },
                },
              },
            },
          }
        : {}),
      ...(search
        ? {
            extractedText: {
              contains: search,
              mode: 'insensitive',
            },
          }
        : {}),
    }

    const [total, questions] = await Promise.all([
      prisma.question.count({ where }),
      prisma.question.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { paper: { year: 'desc' } },
          { questionNumber: 'asc' },
        ],
        include: {
          paper: {
            include: {
              course: true,
            },
          },
          questionTopics: {
            include: {
              topic: true,
            },
          },
        },
      }),
    ])

    const formattedQuestions = questions.map((q) => {
      const primaryTopic = q.questionTopics[0]
      return {
        id: q.id,
        questionNumber: q.questionNumber,
        marks: q.marks,
        extractedText: q.extractedText,
        imageCropS3Key: q.imageCropS3Key,
        cropUrl: q.imageCropS3Key ? `/api/crops/${q.imageCropS3Key}` : null,
        paper: {
          id: q.paper.id,
          examType: q.paper.examType,
          year: q.paper.year,
        },
        course: {
          id: q.paper.course.id,
          code: q.paper.course.code,
          title: q.paper.course.title,
        },
        primaryTopic: primaryTopic
          ? {
              id: primaryTopic.topic.id,
              name: primaryTopic.topic.topicName,
              confidence: primaryTopic.confidence,
            }
          : null,
        topics: q.questionTopics.map((qt) => ({
          id: qt.topic.id,
          name: qt.topic.topicName,
          confidence: qt.confidence,
        })),
      }
    })

    return NextResponse.json({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      questions: formattedQuestions,
    })
  } catch (error) {
    console.error('Questions browse error:', error)
    return NextResponse.json(
      {
        error: 'Failed to retrieve questions',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
