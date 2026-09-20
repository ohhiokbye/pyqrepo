'use client'

import type { QuestionResult } from '@/lib/types'
import { CropPreview } from '@/app/questions/CropPreview'
import { useState } from 'react'

type Props = {
  questions: QuestionResult[]
  activeTopicName?: string
  courseCode: string
  onAskAboutQuestion: (question: QuestionResult) => void
  isLoading?: boolean
}

export function GroundedQuestionsPanel({
  questions,
  activeTopicName,
  courseCode,
  onAskAboutQuestion,
  isLoading = false,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <aside className="w-full lg:w-96 shrink-0 border-t lg:border-t-0 lg:border-l border-border bg-surface/30 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-3.5 border-b border-border bg-surface flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Exam Grounding
            </h3>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Actual university PYQs matching your session
          </p>
        </div>
        <span className="text-xs font-mono px-2 py-0.5 bg-muted rounded text-foreground font-medium">
          {questions.length} PYQs
        </span>
      </div>

      {/* Questions list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {isLoading ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border border-border rounded-lg p-3 space-y-2 bg-background animate-pulse">
                <div className="h-4 w-24 bg-muted rounded" />
                <div className="h-3 w-full bg-muted rounded" />
                <div className="h-3 w-3/4 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : questions.length > 0 ? (
          questions.map((q) => {
            const isExpanded = expandedId === q.id
            const text = cleanText(q.extractedText)
            const isLong = text.length > 160
            const previewText = isLong && !isExpanded ? text.slice(0, 160) + '…' : text

            return (
              <article
                key={q.id}
                className="border border-border rounded-lg p-3 bg-background hover:border-foreground/20 transition-all text-xs space-y-2"
              >
                {/* Header row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-semibold text-foreground">
                      {q.questionNumber}
                    </span>
                    {q.marks != null && (
                      <span className="px-1.5 py-0.2 bg-muted rounded text-[10px] text-muted-foreground tabular-nums">
                        {q.marks} marks
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    <span>{q.paper.examType}</span>
                    {q.paper.year && <span> · {q.paper.year}</span>}
                  </div>
                </div>

                {/* Topic badge */}
                {q.primaryTopic && (
                  <div>
                    <span className="text-[10px] px-1.5 py-0.5 border border-border rounded text-muted-foreground bg-muted/40">
                      {q.primaryTopic.name}
                    </span>
                  </div>
                )}

                {/* Question body */}
                <p className="text-foreground leading-relaxed whitespace-pre-line break-words text-[11px]">
                  {previewText}
                </p>

                {isLong && (
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : q.id)}
                    className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2"
                  >
                    {isExpanded ? 'Collapse' : 'Expand full text'}
                  </button>
                )}

                {/* Crop preview */}
                {q.cropUrl && (
                  <CropPreview
                    cropUrl={q.cropUrl}
                    alt={`${q.course.code} ${q.paper.examType} ${q.questionNumber}`}
                  />
                )}

                {/* Action button: Ask tutor */}
                <div className="pt-1.5 border-t border-border/50 flex justify-end">
                  <button
                    type="button"
                    onClick={() => onAskAboutQuestion(q)}
                    className="text-[10px] font-medium text-foreground hover:bg-muted px-2 py-1 rounded border border-border transition-colors flex items-center gap-1"
                  >
                    <span>Ask tutor to solve</span>
                    <span>→</span>
                  </button>
                </div>
              </article>
            )
          })
        ) : (
          <div className="py-8 text-center p-4 border border-border border-dashed rounded-lg">
            <p className="text-xs font-medium text-foreground mb-1">
              No direct PYQs found
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {activeTopicName
                ? `No specific questions indexed yet under "${activeTopicName}". The tutor will still use general ${courseCode} syllabus knowledge.`
                : `Select a course with uploaded question papers to see real exam questions.`}
            </p>
          </div>
        )}
      </div>
    </aside>
  )
}

function cleanText(text: string): string {
  return text
    .replace(/---\s*Question Paper Page \d+\s*---/g, '')
    .replace(/---\s*Slide\/Page \d+\s*---/g, '')
    .replace(/---\s*Page \d+\s*---/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
