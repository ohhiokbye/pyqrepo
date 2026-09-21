import { prisma } from '@/lib/db'

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
  /** Link to the original uploaded document, or null if its file type can't be served inline. */
  pdfUrl: string | null
}

export type PaperFilters = {
  courseCode?: string
  examType?: string
  year?: number
  page?: number
  limit?: number
}

export type PaginatedPapers = {
  total: number
  page: number
  limit: number
  totalPages: number
  papers: ExamPaper[]
}

const DEFAULT_PAPER_LIMIT = 20
const MAX_PAPER_LIMIT = 50

// Must match the extensions /api/files/[...path]/route.ts is willing to serve.
const INLINE_VIEWABLE_EXTENSIONS = new Set(['.pdf', '.pptx'])

function buildPdfUrl(s3Key: string | undefined): string | null {
  if (!s3Key) return null
  const ext = s3Key.slice(s3Key.lastIndexOf('.')).toLowerCase()
  if (!INLINE_VIEWABLE_EXTENSIONS.has(ext)) return null
  return `/api/files/${s3Key}`
}

const paperInclude = {
  course: true,
  file: { select: { s3Key: true } },
  questions: { select: { marks: true } },
}

function formatPaper(p: {
  id: string
  examType: string
  year: number | null
  course: { id: string; code: string; title: string }
  file: { s3Key: string } | null
  questions: { marks: number | null }[]
}): ExamPaper {
  return {
    id: p.id,
    examType: p.examType,
    year: p.year,
    course: {
      id: p.course.id,
      code: p.course.code,
      title: p.course.title,
    },
    totalMarks: p.questions.reduce((acc, q) => acc + (q.marks ?? 0), 0),
    questionCount: p.questions.length,
    pdfUrl: buildPdfUrl(p.file?.s3Key),
  }
}

export async function getPapers(filters: PaperFilters): Promise<PaginatedPapers> {
  const page = Math.max(1, filters.page ?? 1)
  const limit = Math.min(MAX_PAPER_LIMIT, Math.max(1, filters.limit ?? DEFAULT_PAPER_LIMIT))
  const skip = (page - 1) * limit

  const where = {
    ...(filters.courseCode ? { course: { code: filters.courseCode } } : {}),
    ...(filters.examType ? { examType: filters.examType } : {}),
    ...(filters.year ? { year: filters.year } : {}),
    questions: {
      some: {}, // only papers with segmented questions
    },
  }

  const [total, papers] = await Promise.all([
    prisma.paper.count({ where }),
    prisma.paper.findMany({
      where,
      skip,
      take: limit,
      include: paperInclude,
      orderBy: [
        { year: 'desc' },
        { examType: 'asc' },
      ],
    }),
  ])

  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    papers: papers.map(formatPaper),
  }
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
