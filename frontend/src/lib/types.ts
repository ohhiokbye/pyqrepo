/** Shared domain types for the CPYQ frontend. */

export type ExamType = 'CAT1' | 'CAT2' | 'FAT'

export type QuestionFilters = {
  courseCode?: string
  examType?: string
  topic?: string
  search?: string
  page?: number
  limit?: number
}

export type QuestionResult = {
  id: string
  questionNumber: string
  marks: number | null
  extractedText: string
  imageCropS3Key: string | null
  cropUrl: string | null
  paper: {
    id: string
    examType: string
    year: number | null
  }
  course: {
    id: string
    code: string
    title: string
  }
  primaryTopic: {
    id: string
    name: string
    confidence: number | null
  } | null
  topics: {
    id: string
    name: string
    confidence: number | null
  }[]
}

export type PaginatedQuestions = {
  total: number
  page: number
  limit: number
  totalPages: number
  questions: QuestionResult[]
}

export type CourseWithModules = {
  id: string
  code: string
  title: string
  credits: number
  questionCount?: number
  modules: {
    id: string
    moduleNo: number
    name: string
    topics: {
      id: string
      topicName: string
    }[]
  }[]
}
