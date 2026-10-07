'use client'

import { useState, useEffect, useRef } from 'react'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSave: (key: string, provider: 'gemini' | 'groq') => void
  initialProvider?: 'gemini' | 'groq'
  initialKey?: string
}

export function ApiKeyModal({ isOpen, onClose, onSave, initialKey = '', initialProvider = 'gemini' }: Props) {
  const [key, setKey] = useState(initialKey)
  const [provider, setProvider] = useState<'gemini' | 'groq'>(initialProvider)
  const [showKey, setShowKey] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Re-sync the local editable value whenever the saved key changes (e.g. loaded
  // from localStorage after mount), without the extra render an effect would cause.
  const [prevInitialKey, setPrevInitialKey] = useState(initialKey)
  if (initialKey !== prevInitialKey) {
    setPrevInitialKey(initialKey)
    setKey(initialKey)
  }

  useEffect(() => {
    if (!isOpen) return
    const previousFocus = document.activeElement as HTMLElement | null
    dialogRef.current?.querySelector<HTMLInputElement>('input')?.focus()
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        const elements = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button, input, select') || [])
        const first = elements[0], last = elements.at(-1)
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
      }
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => { window.removeEventListener('keydown', handleKeyDown); previousFocus?.focus() }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(key.trim(), provider)
    onClose()
  }

  const handleClear = () => {
    setKey('')
    onSave('', provider)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="api-modal-title"
    >
      <button type="button" tabIndex={-1} aria-label="Close provider settings" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div
        ref={dialogRef}
        className="relative w-full max-w-md bg-surface border border-border rounded-xl shadow-2xl p-6 space-y-5"
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h2 id="api-modal-title" className="text-sm font-semibold text-foreground">
              Tutor API key
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Use a Gemini or Groq key for this page session
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-sm font-mono px-2 py-1 rounded hover:bg-muted"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <label htmlFor="ai-provider" className="block text-xs">Provider</label>
          <select id="ai-provider" value={provider} onChange={(event) => { setProvider(event.target.value as 'gemini' | 'groq'); setKey('') }} className="w-full rounded border border-border bg-background p-2 text-sm">
            <option value="gemini">Gemini</option><option value="groq">Groq</option>
          </select>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="api-key-input" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Tutor API key
              </label>
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              id="api-key-input"
              type={showKey ? 'text' : 'password'}
              placeholder={provider === 'gemini' ? 'AIzaSy...' : 'gsk_...'}
              autoComplete="off"
              maxLength={512}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="w-full h-9 px-3 text-xs font-mono bg-background border border-border rounded-lg
                         text-foreground placeholder:text-muted-foreground
                         focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground/20
                         transition-colors"
            />
            <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
              Your key stays only in page memory across messages. Refresh, sign-out, or Clear key removes it. It is sent securely to your chosen provider through the tutor API.
            </p>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border">
            {key ? (
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-destructive hover:underline"
              >
                Clear key
              </button>
            ) : <span />}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs font-medium border border-border rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
              >
                Save for this page
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
