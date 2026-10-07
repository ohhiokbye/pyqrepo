import { connection } from 'next/server'
import { getCoursesWithTopics } from '@/lib/data/questions'
import { TutorAccessGate } from '@/components/tutor/TutorAccessGate'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Academic Tutor — CPYQ Lib',
  description: 'Academic tutoring and revision planning using your syllabus, course notes and previous examination papers.',
}

export default async function HomePage() {
  await connection()
  // Fetch courses with full module & topic trees and question counts
  const courses = await getCoursesWithTopics()

  // Find the first active course with questions (e.g. BCSE302L)
  const defaultCourse = courses.find((c) => (c.questionCount ?? 0) > 0) || courses[0]

  return (
    <TutorAccessGate
      courses={courses}
      initialCourseCode={defaultCourse?.code}
    />
  )
}
