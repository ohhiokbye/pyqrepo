import type { QuestionResult } from '@/lib/types'

type QuestionWithRelations = {
  id: string
  questionNumber: string
  marks: number | null
  extractedText: string
  imageCropS3Key: string | null
  questionTopics: {
    confidence: number | null
    topic: { id: string; topicName: string }
  }[]
}

type PaperInfo = {
  id: string
  examType: string
  year: number | null
  course: { id: string; code: string; title: string }
}

/** Maps a Prisma question row (with its paper/course/topic relations) to the shared API shape. */
export function toQuestionResult(q: QuestionWithRelations, paper: PaperInfo): QuestionResult {
  const primaryTopic = q.questionTopics[0]
  return {
    id: q.id,
    questionNumber: q.questionNumber,
    marks: q.marks,
    extractedText: q.extractedText,
    imageCropS3Key: q.imageCropS3Key,
    cropUrl: q.imageCropS3Key ? `/api/crops/${q.imageCropS3Key}` : null,
    paper: {
      id: paper.id,
      examType: paper.examType,
      year: paper.year,
    },
    course: {
      id: paper.course.id,
      code: paper.course.code,
      title: paper.course.title,
    },
    primaryTopic: primaryTopic
      ? {
          id: primaryTopic.topic.id,
          name: primaryTopic.topic.topicName,
          confidence: primaryTopic.confidence,
        }
      : null,
    topics: q.questionTopics.map((qt) => ({
      id: qt.topic.id,
      name: qt.topic.topicName,
      confidence: qt.confidence,
    })),
  }
}
