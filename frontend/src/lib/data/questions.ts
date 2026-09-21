import { prisma } from '@/lib/db'
import type { QuestionFilters, PaginatedQuestions, CourseWithModules } from '@/lib/types'
import { toQuestionResult } from './toQuestionResult'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export async function getQuestions(filters: QuestionFilters): Promise<PaginatedQuestions> {
  const page = Math.max(1, filters.page ?? 1)
  const limit = Math.min(MAX_LIMIT, Math.max(1, filters.limit ?? DEFAULT_LIMIT))
  const skip = (page - 1) * limit

  const where = {
    paper: {
      ...(filters.courseCode ? { course: { code: filters.courseCode } } : {}),
      ...(filters.examType ? { examType: filters.examType } : {}),
    },
    ...(filters.topic
      ? {
          questionTopics: {
            some: {
              topic: {
                topicName: {
                  contains: filters.topic,
                  mode: 'insensitive' as const,
                },
              },
            },
          },
        }
      : {}),
    ...(filters.search
      ? {
          extractedText: {
            contains: filters.search,
            mode: 'insensitive' as const,
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

  const formatted = questions.map((q) => toQuestionResult(q, q.paper))

  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    questions: formatted,
  }
}

export async function getCoursesWithTopics(): Promise<CourseWithModules[]> {
  const courses = await prisma.course.findMany({
    include: {
      modules: {
        include: {
          topics: true,
        },
        orderBy: { moduleNo: 'asc' },
      },
      papers: {
        select: {
          _count: {
            select: { questions: true },
          },
        },
      },
    },
    orderBy: { code: 'asc' },
  })

  const mapped = courses.map((c) => {
    const questionCount = c.papers.reduce((sum, p) => sum + p._count.questions, 0)
    return {
      id: c.id,
      code: c.code,
      title: c.title,
      credits: c.credits,
      questionCount,
      modules: c.modules.map((m) => ({
        id: m.id,
        moduleNo: m.moduleNo,
        name: m.name,
        topics: m.topics.map((t) => ({
          id: t.id,
          topicName: t.topicName,
        })),
      })),
    }
  })

  // Sort courses with questions to the top, then alphabetically
  return mapped.sort((a, b) => {
    if (a.questionCount > 0 && b.questionCount === 0) return -1
    if (a.questionCount === 0 && b.questionCount > 0) return 1
    return a.code.localeCompare(b.code)
  })
}

/** Get only courses that actually have questions in the database. */
export async function getCoursesWithQuestions(): Promise<{ code: string; title: string; questionCount: number }[]> {
  const result = await prisma.course.findMany({
    where: {
      papers: {
        some: {
          questions: {
            some: {},
          },
        },
      },
    },
    include: {
      _count: {
        select: {
          papers: {
            where: {
              questions: { some: {} },
            },
          },
        },
      },
    },
    orderBy: { code: 'asc' },
  })

  // Get actual question counts
  const coursesWithCounts = await Promise.all(
    result.map(async (c) => {
      const count = await prisma.question.count({
        where: { paper: { courseId: c.id } },
      })
      return { code: c.code, title: c.title, questionCount: count }
    })
  )

  return coursesWithCounts.filter((c) => c.questionCount > 0)
}
