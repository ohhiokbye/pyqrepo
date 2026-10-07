'use client'

import { useRef, useState } from 'react'

type Props = {
  onSend: (text: string, options?: { intent: 'explain' | 'revision' | 'practice'; minutes: number }) => void
  busy: boolean
  disabled?: boolean
  opening: boolean
  subject: string
}

export function TutorComposer({ onSend, busy, disabled, opening, subject }: Props) {
  const [input, setInput] = useState('')
  const [intent, setIntent] = useState<'explain' | 'revision' | 'practice'>('explain')
  const [minutes, setMinutes] = useState(120)
  const ref = useRef<HTMLTextAreaElement>(null)
  const validMinutes = intent !== 'revision' || (Number.isInteger(minutes) && minutes >= 15 && minutes <= 720)
  const submit = () => {
    if (!input.trim() || busy || disabled || !validMinutes) return
    onSend(input.trim(), { intent, minutes })
    setInput('')
  }
  const prompts = [
    { label: 'Prioritize revision', intent: 'revision' as const, text: `Help me prioritize revision for ${subject}. Use uploaded papers and notes, identify prerequisite concepts, and build a plan for my available study time.` },
    { label: 'Explain a concept', intent: 'explain' as const, text: `Teach me ${subject} step by step, using teaching notes and a relevant past-paper question where available.` },
    { label: 'Practice a PYQ', intent: 'practice' as const, text: `Give me a relevant past-paper question on ${subject}. Let me attempt it before showing the solution. If no relevant paper exists, label the exercise as generated practice.` },
  ]
  return <div className="w-full">
    <div className="flex flex-wrap items-end gap-3 mb-3 text-xs">
      <label>Study action<select className="block rounded border border-border bg-background p-2 mt-1" value={intent} disabled={busy} onChange={(event) => setIntent(event.target.value as typeof intent)}><option value="explain">Explain a concept</option><option value="revision">Prioritize revision</option><option value="practice">Practice a PYQ</option></select></label>
      {intent === 'revision' && <label>Available minutes<input className="block w-28 rounded border border-border bg-background p-2 mt-1" type="number" min={15} max={720} required value={minutes} disabled={busy} onChange={(event) => setMinutes(Number(event.target.value))} /></label>}
      {intent === 'revision' && <span className="text-muted-foreground">Choose your exam in study settings. Default: 120 minutes.</span>}
    </div>
    <form className={`tutor-composer ${opening ? 'tutor-composer-opening' : ''}`} onSubmit={(event) => { event.preventDefault(); submit() }}>
      <label htmlFor="tutor-prompt" className="sr-only">Ask your tutor</label>
      <textarea id="tutor-prompt" ref={ref} rows={opening ? 3 : 2} maxLength={4000} value={input} onChange={(event) => setInput(event.target.value)}
        placeholder="Ask about a topic, a past question, or your next exam…"
        onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit() } }} />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{busy ? 'Preparing your response…' : 'Enter to send · Shift + Enter for a new line'}</span>
        <button className="tutor-send" type="submit" disabled={!input.trim() || busy || disabled || !validMinutes} aria-label="Send question">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
        </button>
      </div>
    </form>
    {opening && <div className="flex flex-wrap gap-2 mt-4">{prompts.map((prompt) => <button key={prompt.label} type="button" className="tutor-chip" disabled={busy} onClick={() => { setIntent(prompt.intent); setInput(prompt.text); ref.current?.focus() }}>{prompt.label}</button>)}</div>}
  </div>
}
