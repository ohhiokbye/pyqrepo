'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useCallback } from 'react'

type Props = {
  page: number
  totalPages: number
  total: number
  itemLabel?: string
}

export function Pagination({ page, totalPages, total, itemLabel = 'item' }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const goToPage = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams.toString())
      if (newPage <= 1) {
        params.delete('page')
      } else {
        params.set('page', String(newPage))
      }
      router.push(`${pathname}?${params.toString()}`)
    },
    [searchParams, pathname, router]
  )

  if (totalPages <= 1) return null

  return (
    <nav
      className="flex items-center justify-between pt-4 border-t border-border"
      aria-label="Pagination"
    >
      <p className="text-xs text-muted-foreground">
        {total} {itemLabel}{total !== 1 ? 's' : ''} total
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => goToPage(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 text-xs font-medium border border-border rounded-md
                     text-foreground bg-background
                     hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed
                     transition-colors"
        >
          Previous
        </button>
        <span className="text-xs text-muted-foreground tabular-nums px-2">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => goToPage(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1.5 text-xs font-medium border border-border rounded-md
                     text-foreground bg-background
                     hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed
                     transition-colors"
        >
          Next
        </button>
      </div>
    </nav>
  )
}
