import { getCoursesWithTopics } from '@/lib/data/questions'
import { TutorWorkspace } from '@/components/tutor/TutorWorkspace'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Academic Tutor — CPYQ Lib',
  description: 'Conversational academic tutor grounded strictly in your official syllabus and university examination papers.',
}

export default async function HomePage() {
  // Fetch courses with full module & topic trees and question counts
  const courses = await getCoursesWithTopics()

  // Find the first active course with questions (e.g. BCSE302L)
  const defaultCourse = courses.find((c) => (c.questionCount ?? 0) > 0) || courses[0]

  return (
    <TutorWorkspace
      courses={courses}
      initialCourseCode={defaultCourse?.code}
    />
  )
}
