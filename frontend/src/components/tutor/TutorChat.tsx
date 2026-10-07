'use client'

import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import type { RevisionEvidence } from '@/lib/types'

export type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
  citations?: { id: string; source: number; label: string; url: string }[]
  revision?: RevisionEvidence | null
}

export function TutorChat({ messages, isGenerating }: { messages: Message[]; isGenerating: boolean }) {
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'end' })
  }, [messages, isGenerating])
  return <div className="tutor-messages" role="log" aria-label="Tutor conversation" aria-live="polite" aria-busy={isGenerating}>
    {messages.map((message) => <article key={message.id} className={message.role === 'user' ? 'tutor-user-message' : 'tutor-assistant-message'}>
      <span className="sr-only">{message.role === 'user' ? 'You' : 'Tutor'}</span>
      {message.role === 'user' ? <p className="whitespace-pre-wrap">{message.content}</p> : <>
        {message.revision && <aside className="mb-4 rounded border border-border p-3 text-sm" aria-label="Historical revision evidence">
          <p className="font-medium">Revision evidence · {message.revision.minutes} minutes available</p>
          {message.revision.paperCount ? <><p className="mt-1 text-xs text-muted-foreground">Historical order from {message.revision.paperCount} analysed papers. Learning sequence and prerequisites below are tutor recommendations.</p><ol className="mt-2 space-y-1">{message.revision.topics.map((topic) => <li key={topic.topicId}>{topic.topic}: appeared in {topic.matchingPapers} of {message.revision!.paperCount} papers · {Number(topic.allocatedMarks.toFixed(1))} allocated marks</li>)}</ol></> : <p className="mt-2">Historical priorities are unavailable. This plan uses your syllabus, notes and the tutor’s recommendations.</p>}
        </aside>}
        <div className="tutor-markdown"><ReactMarkdown skipHtml components={{
          a: ({ href, children }) => message.citations?.some((source) => source.url === href) ? <a href={href} className="underline underline-offset-4">{children}</a> : <span>{children}</span>,
          img: ({ alt }) => <span>{alt || 'Image omitted'}</span>,
        }}>{message.content.replace(/\[(\d+)\](?!\()/g, (match, number: string) => {
          const citation = message.citations?.find((source) => source.source === Number(number))
          return citation ? `[${number}](${citation.url})` : match
        })}</ReactMarkdown></div>
        {!!message.citations?.length && <details className="mt-4 text-xs text-muted-foreground"><summary className="cursor-pointer">Notes and paper sources ({message.citations.length})</summary><ul className="space-y-2 mt-2">{message.citations.map((source) => <li key={source.id}><a href={source.url} className="underline underline-offset-4">[{source.source}] {source.label}</a></li>)}</ul></details>}
      </>}
    </article>)}
    {isGenerating && <p className="py-4 text-sm text-muted-foreground" role="status">Reading your syllabus, notes and papers…</p>}
    <div ref={end} />
  </div>
}
