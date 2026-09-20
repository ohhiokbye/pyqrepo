'use client'

import { useState, useEffect } from 'react'

type Props = {
  cropUrl: string
  alt: string
}

export function CropPreview({ cropUrl, alt }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

  return (
    <>
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group block text-left border border-border rounded-md overflow-hidden hover:border-foreground/30 transition-colors bg-surface"
          title="Click to view full-resolution crop"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cropUrl}
            alt={alt}
            className="max-h-40 w-auto object-contain cursor-zoom-in group-hover:opacity-95 transition-opacity"
            loading="lazy"
          />
          <span className="block px-2.5 py-1 text-[11px] text-muted-foreground border-t border-border bg-muted/40">
            Original Paper Snippet · Click to expand
          </span>
        </button>
      </div>

      {/* Lightbox modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 sm:p-6"
          onClick={() => setIsOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={alt}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-surface border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-background">
              <span className="text-xs font-mono text-muted-foreground">{alt}</span>
              <div className="flex items-center gap-3">
                <a
                  href={cropUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                >
                  Open raw
                </a>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-xs font-semibold px-2 py-1 bg-muted hover:bg-muted/80 text-foreground rounded transition-colors"
                  aria-label="Close image preview"
                >
                  Close (Esc)
                </button>
              </div>
            </div>

            <div className="p-4 overflow-auto flex items-center justify-center bg-black/20 max-h-[calc(90vh-45px)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cropUrl}
                alt={alt}
                className="max-h-[75vh] w-auto object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
