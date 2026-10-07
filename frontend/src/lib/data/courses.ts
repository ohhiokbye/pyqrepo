import { prisma } from '@/lib/db'

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

/** Read the active published version, so syllabus switches take effect immediately. */
export async function getCourseWithSyllabus(code: string): Promise<CourseWithSyllabus | null> {
  const course = await loadCourseWithSyllabus(code)
  return course ? { ...course, modules: course.modules.filter((module) => module.syllabusVersionId === course.activeSyllabusVersionId) } : null
}
