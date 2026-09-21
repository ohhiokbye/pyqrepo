'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { CourseWithModules, QuestionResult } from '@/lib/types'
import { TutorContextBar, type StudyContext } from './TutorContextBar'
import { TutorChat, type Message } from './TutorChat'
import { ApiKeyModal } from './ApiKeyModal'
import { GroundedQuestionsPanel } from './GroundedQuestionsPanel'

type Props = {
  courses: CourseWithModules[]
  initialCourseCode?: string
}

export function TutorWorkspace({
  courses,
  initialCourseCode,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Find default active course (prefer course with questions, e.g. BCSE302L)
  const defaultCourse = courses.find((c) => c.code === initialCourseCode) ||
    courses.find((c) => (c.questionCount ?? 0) > 0) ||
    courses[0]

  // Context state is seeded from the URL so it survives refreshes and can be shared/bookmarked,
  // consistent with the URL-driven filters used on /papers.
  const [context, setContext] = useState<StudyContext>({
    program: searchParams.get('program') || 'ALL',
    semester: searchParams.get('semester') || 'ALL',
    courseCode: searchParams.get('courseCode') || defaultCourse?.code || 'BCSE302L',
    moduleId: searchParams.get('moduleId') || '',
    topicName: searchParams.get('topicName') || '',
  })

  // Credentials
  const [apiKey, setApiKey] = useState<string>('')
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false)

  // Chat state
  const [messages, setMessages] = useState<Message[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [groundingQuestions, setGroundingQuestions] = useState<QuestionResult[]>([])

  // Load saved API key from localStorage on mount. This must stay an effect (not a
  // render-time read) since localStorage is unavailable during SSR and reading it
  // synchronously during render would cause a hydration mismatch.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing with the localStorage external system, not deriving state from props
      setApiKey(localStorage.getItem('cpyq_student_ai_key') || '')
    } catch {
      // localStorage may fail in restricted browser settings
    }
  }, [])

  const handleSaveApiKey = (newKey: string) => {
    setApiKey(newKey)
    try {
      localStorage.setItem('cpyq_student_ai_key', newKey)
    } catch {
      // ignore
    }
  }

  // Active course object
  const activeCourse = courses.find((c) => c.code === context.courseCode) || defaultCourse

  // Context updates: mirror into the URL so the selection is shareable/bookmarkable
  const handleContextChange = useCallback((updates: Partial<StudyContext>) => {
    setContext((prev) => {
      const next = { ...prev, ...updates }
      if (updates.courseCode && updates.courseCode !== prev.courseCode) {
        next.moduleId = ''
        next.topicName = ''
      }

      const params = new URLSearchParams(searchParams.toString())
      const defaults: Record<string, string> = { program: 'ALL', semester: 'ALL', moduleId: '', topicName: '' }
      for (const [key, value] of Object.entries(next)) {
        if (value && value !== defaults[key]) {
          params.set(key, value)
        } else {
          params.delete(key)
        }
      }
      router.push(`${pathname}?${params.toString()}`)

      return next
    })
  }, [searchParams, pathname, router])

  // Send message to Tutor API
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isGenerating) return

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    }

    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setIsGenerating(true)

    try {
      const res = await fetch('/api/tutor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
          context: {
            courseCode: context.courseCode,
            moduleId: context.moduleId || undefined,
            topicName: context.topicName || undefined,
          },
          apiKey: apiKey || undefined,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.message || errData.error || `Server responded with ${res.status}`)
      }

      const data = await res.json()
      const assistantMessage: Message = {
        id: `msg-${Date.now()}-reply`,
        role: 'assistant',
        content: data.reply || 'I have analyzed your request based on your syllabus.',
        timestamp: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, assistantMessage])
      if (Array.isArray(data.grounding?.relevantQuestions)) {
        setGroundingQuestions(data.grounding.relevantQuestions)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      const errorMessage: Message = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: `**Tutor Notice:** Unable to complete response (${msg}).\n\n*Tip:* Check your API key in the provider settings or verify your network connection.`,
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsGenerating(false)
    }
  }

  const handleAskAboutQuestion = (q: QuestionResult) => {
    const examLabel = `${q.paper.examType}${q.paper.year ? ' ' + q.paper.year : ''}`
    const prompt = `Can you walk me through solving ${q.questionNumber} from the ${examLabel} exam?\n\n"${q.extractedText.slice(0, 500)}"`
    handleSendMessage(prompt)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] overflow-hidden">
      {/* Top Context & Grounding Control Bar */}
      <TutorContextBar
        courses={courses}
        context={context}
        onContextChange={handleContextChange}
        onOpenKeyModal={() => setIsKeyModalOpen(true)}
        hasApiKey={Boolean(apiKey)}
        groundedQuestionCount={activeCourse?.questionCount ?? 0}
      />

      {/* Main Conversational Academic Tutor + Grounding Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        <TutorChat
          messages={messages}
          onSendMessage={handleSendMessage}
          isGenerating={isGenerating}
          courseTitle={activeCourse?.title || 'Course'}
          courseCode={activeCourse?.code || context.courseCode}
          topicName={context.topicName}
        />
        <GroundedQuestionsPanel
          questions={groundingQuestions}
          activeTopicName={context.topicName}
          courseCode={context.courseCode}
          onAskAboutQuestion={handleAskAboutQuestion}
          isLoading={isGenerating && groundingQuestions.length === 0}
        />
      </div>

      {/* AI Key Settings Modal */}
      <ApiKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        onSave={handleSaveApiKey}
        initialKey={apiKey}
      />
    </div>
  )
}
