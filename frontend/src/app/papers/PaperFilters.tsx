'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

type CourseOption = {
  code: string
  title: string
  paperCount: number
  availableExamTypes: string[]
  availableYears: (number | null)[]
}

type Props = {
  courses: CourseOption[]
  allYears: number[]
  selectedCourseCode: string
  selectedExamType: string
  selectedYear: string
}

const EXAM_TYPES = [
  { value: '', label: 'All Exams' },
  { value: 'CAT1', label: 'CAT 1' },
  { value: 'CAT2', label: 'CAT 2' },
  { value: 'FAT', label: 'FAT' },
] as const

export function PaperFilters({
  courses,
  allYears,
  selectedCourseCode,
  selectedExamType,
  selectedYear,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const updateParam = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value)
        } else {
          params.delete(key)
        }
      }
      router.push(`${pathname}?${params.toString()}`)
    },
    [searchParams, pathname, router]
  )

  const activeCourse = courses.find((c) => c.code === selectedCourseCode)

  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-3 shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Course / Subject Selector */}
        <div>
          <label htmlFor="paper-course-select" className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Subject / Course
          </label>
          <select
            id="paper-course-select"
            value={selectedCourseCode}
            onChange={(e) => updateParam({ courseCode: e.target.value })}
            className="w-full h-9 px-3 text-xs bg-background border border-border rounded-lg
                       text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-foreground/20 cursor-pointer"
          >
            {courses.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.title} ({c.paperCount} paper{c.paperCount > 1 ? 's' : ''})
              </option>
            ))}
          </select>
        </div>

        {/* Exam Type Selector */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Exam Type
          </label>
          <div className="flex gap-1 p-0.5 bg-muted rounded-lg" role="tablist">
            {EXAM_TYPES.map((et) => (
              <button
                key={et.value}
                type="button"
                role="tab"
                aria-selected={selectedExamType === et.value}
                onClick={() => updateParam({ examType: et.value })}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  selectedExamType === et.value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {et.label}
              </button>
            ))}
          </div>
        </div>

        {/* Year Selector */}
        <div>
          <label htmlFor="paper-year-select" className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Examination Year
          </label>
          <select
            id="paper-year-select"
            value={selectedYear}
            onChange={(e) => updateParam({ year: e.target.value })}
            className="w-full h-9 px-3 text-xs bg-background border border-border rounded-lg
                       text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20 cursor-pointer"
          >
            <option value="">All Available Years</option>
            {allYears.length > 0 ? (
              allYears.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))
            ) : (
              <>
                <option value="2026">2026</option>
                <option value="2025">2025</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* Active Filter Pills */}
      {(selectedExamType || selectedYear) && (
        <div className="flex items-center gap-2 pt-2 border-t border-border/60 text-xs">
          <span className="text-muted-foreground text-[11px]">Filtered by:</span>
          {selectedExamType && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted rounded text-foreground text-xs font-mono">
              {selectedExamType}
              <button
                type="button"
                onClick={() => updateParam({ examType: '' })}
                className="text-muted-foreground hover:text-foreground ml-0.5"
              >
                ×
              </button>
            </span>
          )}
          {selectedYear && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted rounded text-foreground text-xs font-mono">
              Year {selectedYear}
              <button
                type="button"
                onClick={() => updateParam({ year: '' })}
                className="text-muted-foreground hover:text-foreground ml-0.5"
              >
                ×
              </button>
            </span>
          )}
          <button
            type="button"
            onClick={() => updateParam({ examType: '', year: '' })}
            className="text-muted-foreground hover:text-foreground underline text-[11px]"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  )
}
