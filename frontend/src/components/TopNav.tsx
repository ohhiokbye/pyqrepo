'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function TopNav() {
  const pathname = usePathname()

  const isTutor = pathname === '/'
  const isPapers = pathname.startsWith('/papers') || pathname.startsWith('/questions')
  const isUpload = pathname.startsWith('/upload')

  return (
    <nav className="border-b border-border bg-surface sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-12">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="text-sm font-semibold text-foreground tracking-tight flex items-center gap-2"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            CPYQ Lib
          </Link>

          <div className="flex items-center gap-1 text-xs sm:text-sm" role="navigation" aria-label="Main Navigation">
            <Link
              href="/"
              className={`px-3 py-1.5 rounded-md transition-colors ${
                isTutor
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
              aria-current={isTutor ? 'page' : undefined}
            >
              Academic Tutor
            </Link>
            <Link
              href="/papers"
              className={`px-3 py-1.5 rounded-md transition-colors ${
                isPapers
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
              aria-current={isPapers ? 'page' : undefined}
            >
              Exam Papers
            </Link>
            <Link
              href="/upload"
              className={`px-3 py-1.5 rounded-md transition-colors ${
                isUpload
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
              aria-current={isUpload ? 'page' : undefined}
            >
              Upload
            </Link>
          </div>
        </div>

        <div className="text-xs text-muted-foreground hidden sm:block font-mono">
          Syllabus-Grounded Tutor
        </div>
      </div>
    </nav>
  )
}
