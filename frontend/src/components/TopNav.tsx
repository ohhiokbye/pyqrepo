'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function TopNav() {
  const pathname = usePathname()

  const isTutor = pathname === '/'
  const isPapers = pathname.startsWith('/papers') || pathname.startsWith('/questions')
  const isUpload = pathname.startsWith('/upload') || pathname.startsWith('/admin')

  return (
    <nav className={`border-b border-border bg-surface sticky top-0 z-20 ${isTutor ? "tutor-nav" : ""}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-12">
        <div className="flex items-center gap-2 sm:gap-6">
          <Link
            href="/"
            className="text-sm font-semibold text-foreground tracking-tight flex items-center gap-2"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            CPYQ
          </Link>

          <div className="flex items-center gap-1 text-xs sm:text-sm" role="navigation" aria-label="Main Navigation">
            <Link
              href="/"
              className={`px-2 sm:px-3 py-1.5 rounded-md transition-colors ${
                isTutor
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
              aria-current={isTutor ? 'page' : undefined}
            >
              Tutor
            </Link>
            <Link
              href="/papers"
              className={`px-2 sm:px-3 py-1.5 rounded-md transition-colors ${
                isPapers
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
              aria-current={isPapers ? 'page' : undefined}
            >
              Exam Papers
            </Link>
            <Link
              href="/admin"
              className={`px-2 sm:px-3 py-1.5 rounded-md transition-colors ${
                isUpload
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
              aria-current={isUpload ? 'page' : undefined}
            >
              Admin
            </Link>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">{isTutor ? <button type="button" className="underline underline-offset-4" onClick={() => window.dispatchEvent(new Event("cpyq-provider-settings"))}>Settings</button> : <span className="hidden sm:block font-mono">Syllabus-Grounded Tutor</span>}</div>
      </div>
    </nav>
  )
}
