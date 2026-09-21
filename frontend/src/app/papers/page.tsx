import { getPapers, getPaperFilterMetadata } from '@/lib/data/papers'
import { PaperFilters } from './PaperFilters'
import { PaperView } from './PaperView'
import { Pagination } from '@/components/Pagination'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Exam Papers — CPYQ Lib',
  description: 'Browse complete university examination papers by year and exam category (CAT 1, CAT 2, FAT).',
}

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

function getStringParam(
  params: { [key: string]: string | string[] | undefined },
  key: string
): string | undefined {
  const val = params[key]
  if (Array.isArray(val)) return val[0]
  return val ?? undefined
}

export default async function PapersPage({ searchParams }: Props) {
  const params = await searchParams
  const meta = await getPaperFilterMetadata()

  // Default course to the first course with papers, e.g. BCSE302L
  const defaultCourseCode = meta.courses[0]?.code || 'BCSE302L'
  const courseCode = getStringParam(params, 'courseCode') || defaultCourseCode
  const examType = getStringParam(params, 'examType') || ''
  const yearStr = getStringParam(params, 'year') || ''
  const year = yearStr ? parseInt(yearStr, 10) : undefined
  const pageStr = getStringParam(params, 'page') || ''
  const page = pageStr ? parseInt(pageStr, 10) : 1

  const { papers, total, totalPages } = await getPapers({
    courseCode,
    examType: examType || undefined,
    year,
    page,
  })

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">
          University Exam Papers
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Review full question papers by course, examination category (CAT 1 / CAT 2 / FAT), and year.
        </p>
      </div>

      {/* Filter Bar */}
      <PaperFilters
        courses={meta.courses}
        allYears={meta.years}
        selectedCourseCode={courseCode}
        selectedExamType={examType}
        selectedYear={yearStr}
      />

      {/* Papers Stream */}
      <PaperView papers={papers} />

      <Pagination page={page} totalPages={totalPages} total={total} itemLabel="paper" />
    </div>
  )
}
