import type { QuestionResult } from '@/lib/types'
import { ExpandableText } from './ExpandableText'
import { CropPreview } from './CropPreview'

type Props = {
  question: QuestionResult
}

export function QuestionCard({ question }: Props) {
  const q = question
  const yearLabel = q.paper.year ? String(q.paper.year) : null
  const cleanedText = cleanExtractedText(q.extractedText)

  return (
    <article className="border border-border rounded-lg p-4 hover:bg-surface transition-colors">
      {/* Header row: question number, marks, metadata */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground font-mono">
            {q.questionNumber}
          </span>
          {q.marks != null && (
            <span className="text-xs px-1.5 py-0.5 bg-muted rounded text-muted-foreground tabular-nums">
              {q.marks} marks
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
          <span className="font-medium text-foreground">{q.course.code}</span>
          <span className="text-border">·</span>
          <span>{q.paper.examType}</span>
          {yearLabel && (
            <>
              <span className="text-border">·</span>
              <span>{yearLabel}</span>
            </>
          )}
        </div>
      </div>

      {/* Topic tags */}
      {q.topics.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {q.topics.map((t) => (
            <span
              key={t.id}
              className="text-xs px-2 py-0.5 border border-border rounded-md text-muted-foreground bg-muted/20"
            >
              {t.name}
            </span>
          ))}
        </div>
      ) : q.primaryTopic ? (
        <div className="mb-3">
          <span className="text-xs px-2 py-0.5 border border-border rounded-md text-muted-foreground bg-muted/20">
            {q.primaryTopic.name}
          </span>
        </div>
      ) : null}

      {/* Question text with copy & expandable control */}
      <ExpandableText text={cleanedText} />

      {/* Crop image with full lightbox modal preview */}
      {q.cropUrl && (
        <CropPreview
          cropUrl={q.cropUrl}
          alt={`${q.course.code} ${q.paper.examType} ${q.questionNumber}`}
        />
      )}
    </article>
  )
}

/**
 * Clean up OCR artifacts from extracted text.
 * Remove page boundary markers and excessive whitespace.
 */
function cleanExtractedText(text: string): string {
  return text
    .replace(/---\s*Question Paper Page \d+\s*---/g, '')
    .replace(/---\s*Slide\/Page \d+\s*---/g, '')
    .replace(/---\s*Page \d+\s*---/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
