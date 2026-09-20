'use client'

import { useMemo } from 'react'
import type { CourseWithModules } from '@/lib/types'

export type StudyContext = {
  program: string
  semester: string
  courseCode: string
  moduleId: string
  topicName: string
}

type Props = {
  courses: CourseWithModules[]
  context: StudyContext
  onContextChange: (newContext: Partial<StudyContext>) => void
  onOpenKeyModal: () => void
  hasApiKey: boolean
  provider: string
  groundedQuestionCount: number
}

const PROGRAMS = [
  { id: 'ALL', label: 'All Programs' },
  { id: 'BCSE', label: 'Computer Science (BCSE)' },
  { id: 'BECE', label: 'Electronics & Comm (BECE)' },
  { id: 'SCI', label: 'Basic Sciences & Math' },
]

const SEMESTERS = [
  { id: 'ALL', label: 'All Semesters' },
  { id: '1', label: 'Sem 1 (100)' },
  { id: '2', label: 'Sem 2 (100)' },
  { id: '3', label: 'Sem 3 (200)' },
  { id: '4', label: 'Sem 4 (200)' },
  { id: '5', label: 'Sem 5 (300)' },
  { id: '6', label: 'Sem 6 (300)' },
  { id: '7', label: 'Sem 7 (400)' },
  { id: '8', label: 'Sem 8 (400)' },
]

export function TutorContextBar({
  courses,
  context,
  onContextChange,
  onOpenKeyModal,
  hasApiKey,
  provider,
  groundedQuestionCount,
}: Props) {
  // Filter courses by Program
  const filteredByProgram = useMemo(() => {
    if (context.program === 'ALL') return courses
    if (context.program === 'SCI') {
      return courses.filter((c) =>
        c.code.startsWith('BMAT') || c.code.startsWith('BPHY') || c.code.startsWith('BCHY')
      )
    }
    return courses.filter((c) => c.code.startsWith(context.program))
  }, [courses, context.program])

  // Filter courses by Semester level
  const filteredCourses = useMemo(() => {
    if (context.semester === 'ALL') return filteredByProgram
    const semNum = parseInt(context.semester, 10)
    const levelPrefix = semNum <= 2 ? '1' : semNum <= 4 ? '2' : semNum <= 6 ? '3' : '4'
    return filteredByProgram.filter((c) => {
      // e.g. BCSE302L -> match character 4 for level
      const match = c.code.match(/[A-Z]+(\d)/)
      return match ? match[1] === levelPrefix : true
    })
  }, [filteredByProgram, context.semester])

  // Active course
  const activeCourse = courses.find((c) => c.code === context.courseCode) || courses[0]

  // Modules and Topics for the active course
  const activeModules = activeCourse?.modules || []
  const selectedModule = activeModules.find((m) => m.id === context.moduleId)

  return (
    <div className="border-b border-border bg-surface/50 p-3 sm:p-4 space-y-3">
      {/* Context selectors row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
        {/* 1. Program Selector */}
        <div>
          <label htmlFor="program-select" className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Program
          </label>
          <select
            id="program-select"
            value={context.program}
            onChange={(e) => {
              const newProg = e.target.value
              onContextChange({ program: newProg })
            }}
            className="w-full h-8 px-2.5 text-xs bg-background border border-border rounded-md
                       text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20 cursor-pointer"
          >
            {PROGRAMS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* 2. Semester Selector */}
        <div>
          <label htmlFor="sem-select" className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Semester
          </label>
          <select
            id="sem-select"
            value={context.semester}
            onChange={(e) => onContextChange({ semester: e.target.value })}
            className="w-full h-8 px-2.5 text-xs bg-background border border-border rounded-md
                       text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20 cursor-pointer"
          >
            {SEMESTERS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* 3. Subject / Course Selector */}
        <div>
          <label htmlFor="course-select-tutor" className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Subject
          </label>
          <select
            id="course-select-tutor"
            value={context.courseCode}
            onChange={(e) => {
              const code = e.target.value
              onContextChange({
                courseCode: code,
                moduleId: '',
                topicName: '',
              })
            }}
            className="w-full h-8 px-2.5 text-xs bg-background border border-border rounded-md
                       text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20 cursor-pointer font-medium"
          >
            {filteredCourses.length > 0 ? (
              filteredCourses.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.title} {c.questionCount ? `(${c.questionCount} PYQs)` : ''}
                </option>
              ))
            ) : (
              <option value={activeCourse?.code || ''}>
                {activeCourse?.code} — {activeCourse?.title}
              </option>
            )}
          </select>
        </div>

        {/* 4. Module & Topic Selector */}
        <div>
          <label htmlFor="module-select" className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Module / Topic
          </label>
          <select
            id="module-select"
            value={context.moduleId ? `${context.moduleId}:${context.topicName}` : ''}
            onChange={(e) => {
              const val = e.target.value
              if (!val) {
                onContextChange({ moduleId: '', topicName: '' })
              } else {
                const [modId, tName] = val.split(':')
                onContextChange({ moduleId: modId, topicName: tName || '' })
              }
            }}
            className="w-full h-8 px-2.5 text-xs bg-background border border-border rounded-md
                       text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20 cursor-pointer"
          >
            <option value="">All Modules (General Subject)</option>
            {activeModules.map((m) => (
              <optgroup key={m.id} label={`Module ${m.moduleNo}: ${m.name}`}>
                <option value={`${m.id}:`}>All Module {m.moduleNo} Topics</option>
                {m.topics.map((t) => (
                  <option key={t.id} value={`${m.id}:${t.topicName}`}>
                    {t.topicName}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      {/* Grounding Status Bar & API Key Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="font-semibold text-foreground">
            {activeCourse ? `${activeCourse.code} (${activeCourse.title})` : 'Course'}
          </span>
          {context.topicName && (
            <>
              <span className="text-border">·</span>
              <span className="text-foreground bg-muted px-2 py-0.5 rounded text-[11px]">
                {context.topicName}
              </span>
            </>
          )}
          <span className="text-border">·</span>
          <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
            {groundedQuestionCount} university exam questions indexed
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenKeyModal}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium border border-border rounded-md
                       bg-background text-foreground hover:bg-muted transition-colors"
            title="Configure personal Gemini or OpenAI key"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${hasApiKey ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span>{provider === 'openai' ? 'OpenAI' : 'Gemini 3.6'}</span>
            <span className="text-muted-foreground font-mono">
              {hasApiKey ? 'Custom Key' : 'System Default'}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
