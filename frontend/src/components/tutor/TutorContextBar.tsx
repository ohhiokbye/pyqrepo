'use client'

import type { CourseWithModules } from '@/lib/types'

export type StudyContext = {
  program: string
  semester: string
  courseCode: string
  moduleId: string
  topicName: string
  examType: string
  year: string
}

type Props = { courses: CourseWithModules[]; context: StudyContext; onContextChange: (updates: Partial<StudyContext>) => void; disabled?: boolean }
export function TutorContextBar({ courses, context, onContextChange, disabled }: Props) {
  const active = courses.find((course) => course.code === context.courseCode)
  const filtered = courses.filter((course) => {
    const program = context.program === 'ALL' || (context.program === 'SCI' ? /^(BMAT|BPHY|BCHY)/.test(course.code) : course.code.startsWith(context.program))
    const level = context.semester === 'ALL' || course.code.match(/\d/)?.[0] === String(Math.ceil(Number(context.semester) / 2))
    return program && level
  })
  const visible = active && !filtered.includes(active) ? [active, ...filtered] : filtered
  return <fieldset disabled={disabled} className="tutor-context">
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label>Course<select value={context.courseCode} onChange={(event) => onContextChange({ courseCode: event.target.value, moduleId: '', topicName: '' })}>{visible.map((course) => <option key={course.code} value={course.code}>{course.code} — {course.title}</option>)}</select></label>
      <label>Module / topic<select value={JSON.stringify([context.moduleId, context.topicName])} onChange={(event) => { const [moduleId, topicName] = JSON.parse(event.target.value) as string[]; onContextChange({ moduleId, topicName }) }}>
        <option value={JSON.stringify(['', ''])}>Entire course syllabus</option>
        {active?.modules.map((module) => <optgroup key={module.id} label={`Module ${module.moduleNo}: ${module.name}`}><option value={JSON.stringify([module.id, ''])}>All Module {module.moduleNo} topics</option>{module.topics.map((topic) => <option key={topic.id} value={JSON.stringify([module.id, topic.topicName])}>{topic.topicName}</option>)}</optgroup>)}
      </select></label>
    </div>
    <details className="mt-3"><summary className="text-xs cursor-pointer w-fit">Study settings{context.examType || context.year ? ` · ${context.examType || 'All exams'} ${context.year}` : ''}</summary>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
        <label>Program<select value={context.program} onChange={(event) => onContextChange({ program: event.target.value })}><option value="ALL">All programs</option><option value="BCSE">Computer science</option><option value="BECE">Electronics</option><option value="SCI">Sciences & math</option></select></label>
        <label>Semester level<select value={context.semester} onChange={(event) => onContextChange({ semester: event.target.value })}><option value="ALL">All semesters</option>{Array.from({ length: 8 }, (_, index) => <option key={index} value={index + 1}>Semester {index + 1}</option>)}</select></label>
        <label>Exam<select value={context.examType} onChange={(event) => onContextChange({ examType: event.target.value })}><option value="">All exams</option>{['CAT1', 'CAT2', 'FAT'].map((exam) => <option key={exam}>{exam}</option>)}</select></label>
        <label>Year<input type="number" min="2000" max="2100" placeholder="All years" value={context.year} onChange={(event) => onContextChange({ year: event.target.value })} /></label>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Semester filters use course-number levels; exact semester assignments may vary by program.</p>
    </details>
  </fieldset>
}
