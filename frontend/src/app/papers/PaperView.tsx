import type { ExamPaper } from '@/lib/data/papers'
import { CropPreview } from '@/app/questions/CropPreview'
import { ExpandableText } from '@/app/questions/ExpandableText'

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
    <div className="space-y-10">
      {papers.map((paper, paperIdx) => (
        <article
          key={paper.id}
          className="border border-border rounded-2xl bg-surface/40 overflow-hidden shadow-sm"
        >
          {/* Official University Exam Header Sheet */}
          <div className="border-b border-border bg-surface p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block">
                  Official Examination Paper #{paperIdx + 1}
                </span>
                <h2 className="text-lg font-bold text-foreground tracking-tight mt-0.5">
                  {paper.course.code} — {paper.course.title}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-primary text-primary-foreground text-xs font-bold font-mono rounded-md">
                  {paper.examType}
                </span>
                {paper.year && (
                  <span className="px-2.5 py-1 bg-muted border border-border text-foreground text-xs font-mono font-medium rounded-md">
                    {paper.year}
                  </span>
                )}
              </div>
            </div>

            {/* Exam metadata grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 bg-background border border-border rounded-lg">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Exam Category</span>
                <span className="font-semibold text-foreground mt-0.5 block">{paper.examType} Examination</span>
              </div>
              <div className="p-2.5 bg-background border border-border rounded-lg">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Maximum Marks</span>
                <span className="font-semibold text-foreground mt-0.5 block">{paper.totalMarks} Marks</span>
              </div>
              <div className="p-2.5 bg-background border border-border rounded-lg">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Total Questions</span>
                <span className="font-semibold text-foreground mt-0.5 block">{paper.questionCount} Questions</span>
              </div>
              <div className="p-2.5 bg-background border border-border rounded-lg">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Academic Session</span>
                <span className="font-semibold text-foreground mt-0.5 block">{paper.year ? `Academic Year ${paper.year}` : 'Winter Session'}</span>
              </div>
            </div>
          </div>

          {/* Questions Stream */}
          <div className="p-5 sm:p-6 space-y-6 divide-y divide-border/60">
            {paper.questions.map((q, qIndex) => {
              const cleanedText = cleanText(q.extractedText)

              return (
                <div
                  key={q.id}
                  className={`space-y-3 ${qIndex > 0 ? 'pt-6' : ''}`}
                >
                  {/* Question header row */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold font-mono text-foreground px-2 py-0.5 bg-muted rounded">
                        {q.questionNumber}
                      </span>
                      {q.marks != null && (
                        <span className="text-xs px-2 py-0.5 bg-muted border border-border rounded text-foreground font-semibold tabular-nums">
                          {q.marks} marks
                        </span>
                      )}
                    </div>

                    {q.primaryTopic && (
                      <span className="text-xs px-2 py-0.5 border border-border rounded-md text-muted-foreground bg-muted/30">
                        {q.primaryTopic.name}
                      </span>
                    )}
                  </div>

                  {/* Problem Statement */}
                  <ExpandableText text={cleanedText} />

                  {/* Original High-Resolution Question Paper Crop */}
                  {q.cropUrl && (
                    <div className="pt-1">
                      <CropPreview
                        cropUrl={q.cropUrl}
                        alt={`${paper.course.code} ${paper.examType} ${q.questionNumber}`}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </article>
      ))}
    </div>
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
