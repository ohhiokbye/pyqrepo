import { prisma } from '@/lib/db'

// The syllabus only changes when the seed is re-run, so the tutor doesn't need to
// reload the full course -> modules -> topics tree from the database on every message.
const SYLLABUS_CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

async function loadCourseWithSyllabus(code: string) {
  return prisma.course.findUnique({
    where: { code },
    include: {
      modules: {
        include: { topics: true },
        orderBy: { moduleNo: 'asc' },
      },
    },
  })
}

type CourseWithSyllabus = NonNullable<Awaited<ReturnType<typeof loadCourseWithSyllabus>>>

const syllabusCache = new Map<string, { course: CourseWithSyllabus; cachedAt: number }>()

/** Course with its ordered modules and topics, cached in memory per course code. Returns null for unknown codes (never cached). */
export async function getCourseWithSyllabus(code: string): Promise<CourseWithSyllabus | null> {
  const cached = syllabusCache.get(code)
  if (cached && Date.now() - cached.cachedAt < SYLLABUS_CACHE_TTL_MS) return cached.course

  const course = await loadCourseWithSyllabus(code)
  if (course) syllabusCache.set(code, { course, cachedAt: Date.now() })
  return course
}
