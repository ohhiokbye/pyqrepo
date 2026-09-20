'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CourseWithModules } from '@/lib/types'

const EXAM_TYPES = [
  { value: '', label: 'All exams' },
  { value: 'CAT1', label: 'CAT 1' },
  { value: 'CAT2', label: 'CAT 2' },
  { value: 'FAT', label: 'FAT' },
] as const

type Props = {
  courses: CourseWithModules[]
}

export function QuestionFilters({ courses }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const courseCode = searchParams.get('courseCode') ?? ''
  const examType = searchParams.get('examType') ?? ''
  const topic = searchParams.get('topic') ?? ''
  const search = searchParams.get('search') ?? ''

  const [searchInput, setSearchInput] = useState(search)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Build a new URL with updated params, resetting page to 1 on filter change
  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value)
        } else {
          params.delete(key)
        }
      }
      // Reset to page 1 when filters change
      params.delete('page')
      router.push(`${pathname}?${params.toString()}`)
    },
    [searchParams, pathname, router]
  )

  // Debounced text search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (searchInput !== search) {
        updateParams({ search: searchInput })
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchInput, search, updateParams])

  // Sync search input when URL changes externally
  useEffect(() => {
    setSearchInput(search)
  }, [search])

  // Get topics for the selected course
  const selectedCourse = courses.find((c) => c.code === courseCode)
  const allTopics = selectedCourse
    ? selectedCourse.modules.flatMap((m) => m.topics)
    : []

  // Active filter count (excluding search)
  const activeFilterCount = [courseCode, examType, topic].filter(Boolean).length

  return (
    <div className="space-y-3">
      {/* Search + course row */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1">
          <label htmlFor="question-search" className="sr-only">
            Search questions
          </label>
          <input
            id="question-search"
            type="search"
            placeholder="Search question text…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full h-9 px-3 text-sm bg-background border border-border rounded-lg
                       placeholder:text-muted-foreground
                       focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground/20
                       transition-colors"
          />
        </div>
        <div className="sm:w-56">
          <label htmlFor="course-select" className="sr-only">
            Course
          </label>
          <select
            id="course-select"
            value={courseCode}
            onChange={(e) => updateParams({ courseCode: e.target.value, topic: '' })}
            className="w-full h-9 px-3 text-sm bg-background border border-border rounded-lg
                       text-foreground
                       focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground/20
                       transition-colors cursor-pointer"
          >
            <option value="">All courses</option>
            {courses.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.title} {c.questionCount ? `(${c.questionCount})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Exam type tabs + topic */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        <div className="flex gap-1 p-0.5 bg-muted rounded-lg" role="tablist" aria-label="Exam type filter">
          {EXAM_TYPES.map((et) => (
            <button
              key={et.value}
              type="button"
              role="tab"
              aria-selected={examType === et.value}
              onClick={() => updateParams({ examType: et.value })}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                examType === et.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {et.label}
            </button>
          ))}
        </div>

        {allTopics.length > 0 && (
          <div className="sm:ml-auto">
            <label htmlFor="topic-select" className="sr-only">
              Topic
            </label>
            <select
              id="topic-select"
              value={topic}
              onChange={(e) => updateParams({ topic: e.target.value })}
              className="h-8 px-2 text-xs bg-background border border-border rounded-md
                         text-foreground
                         focus:outline-none focus:ring-2 focus:ring-foreground/10
                         transition-colors cursor-pointer"
            >
              <option value="">All topics</option>
              {allTopics.map((t) => (
                <option key={t.id} value={t.topicName}>
                  {t.topicName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Active filters summary */}
      {(activeFilterCount > 0 || search) && (
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {courseCode && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-md text-foreground">
              {courseCode}
              <button
                type="button"
                onClick={() => updateParams({ courseCode: '', topic: '' })}
                className="text-muted-foreground hover:text-foreground ml-0.5"
                aria-label={`Remove ${courseCode} filter`}
              >
                ×
              </button>
            </span>
          )}
          {examType && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-md text-foreground">
              {examType}
              <button
                type="button"
                onClick={() => updateParams({ examType: '' })}
                className="text-muted-foreground hover:text-foreground ml-0.5"
                aria-label={`Remove ${examType} filter`}
              >
                ×
              </button>
            </span>
          )}
          {topic && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-md text-foreground max-w-48 truncate">
              {topic}
              <button
                type="button"
                onClick={() => updateParams({ topic: '' })}
                className="text-muted-foreground hover:text-foreground ml-0.5 shrink-0"
                aria-label={`Remove topic filter`}
              >
                ×
              </button>
            </span>
          )}
          {search && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-md text-foreground max-w-48 truncate">
              &ldquo;{search}&rdquo;
              <button
                type="button"
                onClick={() => { setSearchInput(''); updateParams({ search: '' }) }}
                className="text-muted-foreground hover:text-foreground ml-0.5 shrink-0"
                aria-label="Clear search"
              >
                ×
              </button>
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setSearchInput('')
              router.push(pathname)
            }}
            className="text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}
