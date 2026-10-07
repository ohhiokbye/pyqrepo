import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { CropPreview } from '@/app/questions/CropPreview'

export default async function PaperPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const paper = await prisma.paper.findFirst({ where: { id, publicationStatus: 'AUTO_PUBLISHED' }, include: { course: true, file: true, questions: { orderBy: { questionNumber: 'asc' }, include: { questionTopics: { include: { topic: true } } } } } })
  if (!paper) notFound()
  return <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
    <Link href="/papers" className="text-sm underline">Back to papers</Link>
    <header className="space-y-2"><h1 className="text-xl font-semibold">{paper.course.code} — {paper.course.title}</h1><p>{paper.examType} {paper.year} · {paper.questions.filter((question) => question.marksScope !== 'PARENT_TOTAL').length} question appearances</p><a className="inline-block rounded-md border border-border px-4 py-2 text-sm" href={`/api/files/${paper.file.s3Key}`} target="_blank" rel="noopener noreferrer">View original PDF</a></header>
    {paper.sharedInstructions && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{paper.sharedInstructions}</p>}
    {paper.questions.map((question) => <article key={question.id} id={`question-${question.id}`} className="scroll-mt-16 space-y-3 border-t border-border py-5"><h2 className="font-medium">{question.questionNumber} {question.marks != null ? `· ${question.marks} marks` : ''}</h2>{question.sharedInstructions && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{question.sharedInstructions}</p>}{question.sourcePages.length > 0 && <p className="text-xs text-muted-foreground">Source pages: {question.sourcePages.map((page) => page + 1).join(', ')}</p>}<p className="whitespace-pre-wrap text-sm">{question.extractedText}</p>{question.questionTopics.length > 0 && <p className="text-xs text-muted-foreground">Topics: {question.questionTopics.map((link) => link.topic.topicName).join(', ')}</p>}{question.imageCropS3Key && <CropPreview alt={`Original crop for ${question.questionNumber}`} cropUrl={`/api/crops/${question.imageCropS3Key}`} />}</article>)}
  </main>
}
