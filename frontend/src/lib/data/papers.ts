import { prisma } from '@/lib/db'
import type { QuestionResult } from '@/lib/types'

export type ExamPaper = {
  id: string
  examType: string
  year: number | null
  course: {
    id: string
    code: string
    title: string
  }
  totalMarks: number
  questionCount: number
  questions: QuestionResult[]
}

export type PaperFilters = {
  courseCode?: string
  examType?: string
  year?: number
}

export async function getPapers(filters: PaperFilters): Promise<ExamPaper[]> {
  const papers = await prisma.paper.findMany({
    where: {
      ...(filters.courseCode ? { course: { code: filters.courseCode } } : {}),
      ...(filters.examType ? { examType: filters.examType } : {}),
      ...(filters.year ? { year: filters.year } : {}),
      questions: {
        some: {}, // only papers with segmented questions
      },
    },
    include: {
      course: true,
      questions: {
        orderBy: { questionNumber: 'asc' },
        include: {
          questionTopics: {
            include: { topic: true },
          },
        },
      },
    },
    orderBy: [
      { year: 'desc' },
      { examType: 'asc' },
    ],
  })

  return papers.map((p) => {
    const totalMarks = p.questions.reduce((acc, q) => acc + (q.marks ?? 0), 0)
    const formattedQuestions: QuestionResult[] = p.questions.map((q) => {
      const primaryTopic = q.questionTopics[0]
      return {
        id: q.id,
        questionNumber: q.questionNumber,
        marks: q.marks,
        extractedText: q.extractedText,
        imageCropS3Key: q.imageCropS3Key,
        cropUrl: q.imageCropS3Key ? `/api/crops/${q.imageCropS3Key}` : null,
        paper: {
          id: p.id,
          examType: p.examType,
          year: p.year,
        },
        course: {
          id: p.course.id,
          code: p.course.code,
          title: p.course.title,
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

    return {
      id: p.id,
      examType: p.examType,
      year: p.year,
      course: {
        id: p.course.id,
        code: p.course.code,
        title: p.course.title,
      },
      totalMarks,
      questionCount: p.questions.length,
      questions: formattedQuestions,
    }
  })
}

export async function getPaperFilterMetadata() {
  const [coursesWithPapers, distinctYears] = await Promise.all([
    prisma.course.findMany({
      where: {
        papers: {
          some: {
            questions: { some: {} },
          },
        },
      },
      include: {
        papers: {
          where: { questions: { some: {} } },
          select: { id: true, examType: true, year: true },
        },
      },
      orderBy: { code: 'asc' },
    }),
    prisma.paper.findMany({
      where: {
        year: { not: null },
        questions: { some: {} },
      },
      distinct: ['year'],
      select: { year: true },
      orderBy: { year: 'desc' },
    }),
  ])

  const years = distinctYears.map((y) => y.year!).filter(Boolean)

  return {
    courses: coursesWithPapers.map((c) => ({
      code: c.code,
      title: c.title,
      paperCount: c.papers.length,
      availableExamTypes: Array.from(new Set(c.papers.map((p) => p.examType))),
      availableYears: Array.from(new Set(c.papers.map((p) => p.year).filter(Boolean))),
    })),
    years,
  }
}
