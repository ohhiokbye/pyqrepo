'use client'

import { useState, useEffect } from 'react'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSave: (key: string) => void
  initialKey?: string
}

export function ApiKeyModal({ isOpen, onClose, onSave, initialKey = '' }: Props) {
  const [key, setKey] = useState(initialKey)
  const [showKey, setShowKey] = useState(false)

  // Re-sync the local editable value whenever the saved key changes (e.g. loaded
  // from localStorage after mount), without the extra render an effect would cause.
  const [prevInitialKey, setPrevInitialKey] = useState(initialKey)
  if (initialKey !== prevInitialKey) {
    setPrevInitialKey(initialKey)
    setKey(initialKey)
  }

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(key.trim())
    onClose()
  }

  const handleClear = () => {
    setKey('')
    onSave('')
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="api-modal-title"
    >
      <div
        className="w-full max-w-md bg-surface border border-border rounded-xl shadow-2xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h2 id="api-modal-title" className="text-sm font-semibold text-foreground">
              Gemini API Key
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configure your personal Gemini key for the academic tutor
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
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="api-key-input" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Gemini API Key
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
              placeholder="AIzaSy..."
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="w-full h-9 px-3 text-xs font-mono bg-background border border-border rounded-lg
                         text-foreground placeholder:text-muted-foreground
                         focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground/20
                         transition-colors"
            />
            <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
              Your key is saved locally in your browser and used only for your tutor questions. If left blank, the tutor uses the system default key (rate limited).
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
                Save Settings
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
