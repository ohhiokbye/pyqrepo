'use client'

import { useState } from 'react'

type Props = {
  text: string
}

export function ExpandableText({ text }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const isLong = text.length > 350
  const displayText = isLong && !expanded ? text.slice(0, 350) + '…' : text

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard write might fail in non-secure context
    }
  }

  return (
    <div className="relative group">
      <p className="text-sm text-foreground leading-relaxed whitespace-pre-line break-words font-sans">
        {displayText}
      </p>

      <div className="flex items-center gap-3 mt-2">
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            {expanded ? 'Show less' : 'Show full question'}
          </button>
        )}

        <button
          type="button"
          onClick={handleCopy}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto flex items-center gap-1"
          title="Copy question text"
        >
          {copied ? (
            <span className="text-success text-xs font-medium">✓ Copied</span>
          ) : (
            <span>Copy text</span>
          )}
        </button>
      </div>
    </div>
  )
}
