import type { ExamPaper } from '@/lib/data/papers'

type Props = {
  papers: ExamPaper[]
}

export function PaperView({ papers }: Props) {
  if (papers.length === 0) {
    return (
      <div className="border border-border border-dashed rounded-xl p-12 text-center bg-surface/30">
        <h3 className="text-sm font-semibold text-foreground mb-1">
          No Examination Papers Found
        </h3>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          No question papers matching this course, exam type, or year have been uploaded yet. You can upload a question paper via the Upload portal.
        </p>
      </div>
    )
  }

  return (
    <div className="border-t border-border">
      {papers.map((paper) => {
        const row = (
          <>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-base font-bold text-foreground">{paper.course.code}</span>
                <span className="text-xs text-muted-foreground truncate">{paper.course.title}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span>{paper.examType}{paper.year ? ` · ${paper.year}` : ''}</span>
                <span>{paper.questionCount} question{paper.questionCount !== 1 ? 's' : ''}</span>
                <span>{paper.totalMarks} marks</span>
              </div>
            </div>
            {paper.pdfUrl ? (
              <span className="shrink-0 text-xs font-medium text-foreground underline underline-offset-2">
                View
              </span>
            ) : (
              <span className="shrink-0 text-xs text-muted-foreground">Unavailable</span>
            )}
          </>
        )

        if (!paper.pdfUrl) {
          return (
            <div
              key={paper.id}
              className="flex items-center justify-between gap-4 py-4 border-b border-border opacity-60"
            >
              {row}
            </div>
          )
        }

        return (
          <a
            key={paper.id}
            href={paper.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-4 py-4 border-b border-border hover:bg-muted/40 transition-colors"
          >
            {row}
          </a>
        )
      })}
    </div>
  )
}
