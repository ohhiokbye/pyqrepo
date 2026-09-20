'use client'

import { useState, useRef, useEffect } from 'react'

export type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

type Props = {
  messages: Message[]
  onSendMessage: (text: string) => void
  isGenerating: boolean
  courseTitle: string
  courseCode: string
  topicName?: string
  suggestedPrompts?: string[]
}

export function TutorChat({
  messages,
  onSendMessage,
  isGenerating,
  courseTitle,
  courseCode,
  topicName,
  suggestedPrompts = [],
}: Props) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isGenerating])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isGenerating) return
    onSendMessage(input.trim())
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const defaultPrompts = [
    `What are the most frequent exam question patterns for ${topicName || courseTitle}?`,
    `Explain the core concept step-by-step with an exam-style problem and solution.`,
    `What are the common pitfalls and calculation mistakes students make in exams for this?`,
  ]

  const activePrompts = suggestedPrompts.length > 0 ? suggestedPrompts : defaultPrompts

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      {/* Messages stream */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col justify-center items-center text-center max-w-xl mx-auto py-10 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center text-foreground font-mono text-sm font-bold shadow-sm">
              AI
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Academic Tutor: {courseCode}
              </h2>
              <p className="text-xs text-muted-foreground mt-1 max-w-md">
                Grounded in your official syllabus for <strong>{courseTitle}</strong>
                {topicName ? ` · Focus: ${topicName}` : ''} and university previous year question papers.
              </p>
            </div>

            {/* Prompt suggestions */}
            <div className="w-full text-left space-y-2 pt-2">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Exam-oriented prompts to start:
              </div>
              <div className="grid gap-2">
                {activePrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onSendMessage(prompt)}
                    className="p-2.5 text-xs text-left border border-border rounded-lg bg-surface/40 hover:bg-surface hover:border-foreground/20 text-foreground transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-3 max-w-3xl ${m.role === 'user' ? 'ml-auto justify-end' : 'mr-auto justify-start'}`}
            >
              {m.role === 'assistant' && (
                <div className="w-7 h-7 rounded-md bg-muted border border-border flex items-center justify-center shrink-0 text-xs font-mono font-semibold text-foreground mt-0.5">
                  T
                </div>
              )}

              <div
                className={`rounded-xl p-3.5 sm:p-4 text-xs sm:text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground max-w-lg'
                    : 'bg-surface border border-border text-foreground space-y-2'
                }`}
              >
                <div className="whitespace-pre-line break-words font-sans">
                  {m.content}
                </div>
              </div>
            </div>
          ))
        )}

        {isGenerating && (
          <div className="flex gap-3 max-w-3xl mr-auto justify-start">
            <div className="w-7 h-7 rounded-md bg-muted border border-border flex items-center justify-center shrink-0 text-xs font-mono font-semibold text-foreground mt-0.5 animate-pulse">
              T
            </div>
            <div className="rounded-xl p-3.5 bg-surface border border-border text-xs text-muted-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-foreground/60 animate-bounce" />
              <span className="w-2 h-2 rounded-full bg-foreground/60 animate-bounce [animation-delay:0.2s]" />
              <span className="w-2 h-2 rounded-full bg-foreground/60 animate-bounce [animation-delay:0.4s]" />
              <span className="ml-1 font-mono text-[11px]">Grounded synthesis in progress…</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="border-t border-border bg-surface/50 p-3 sm:p-4">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-2">
          <div className="relative border border-border rounded-xl bg-background focus-within:ring-2 focus-within:ring-foreground/10 focus-within:border-foreground/20 transition-all shadow-sm">
            <textarea
              ref={textareaRef}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask anything about ${topicName || courseCode} (e.g. explain normal forms, solve an exam problem...)`}
              className="w-full p-3 text-xs sm:text-sm bg-transparent border-0 focus:outline-none text-foreground placeholder:text-muted-foreground resize-none"
            />
            <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
              <span className="text-[11px] text-muted-foreground hidden sm:inline">
                Press <strong>Enter</strong> to send, <strong>Shift+Enter</strong> for newline
              </span>
              <button
                type="submit"
                disabled={!input.trim() || isGenerating}
                className="ml-auto px-3.5 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
              >
                Send Query
              </button>
            </div>
          </div>
          <div className="text-[10px] text-center text-muted-foreground">
            Explanations are strictly grounded in university syllabus guidelines & historical exam questions.
          </div>
        </form>
      </div>
    </div>
  )
}
