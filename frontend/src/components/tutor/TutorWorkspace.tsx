'use client'

import { useState, useEffect } from 'react'
import type { CourseWithModules } from '@/lib/types'
import { TutorContextBar, type StudyContext } from './TutorContextBar'
import { TutorChat, type Message } from './TutorChat'
import { ApiKeyModal } from './ApiKeyModal'

type Props = {
  courses: CourseWithModules[]
  initialCourseCode?: string
}

export function TutorWorkspace({
  courses,
  initialCourseCode,
}: Props) {
  // Find default active course (prefer course with questions, e.g. BCSE302L)
  const defaultCourse = courses.find((c) => c.code === initialCourseCode) ||
    courses.find((c) => (c.questionCount ?? 0) > 0) ||
    courses[0]

  const [context, setContext] = useState<StudyContext>({
    program: 'ALL',
    semester: 'ALL',
    courseCode: defaultCourse?.code || 'BCSE302L',
    moduleId: '',
    topicName: '',
  })

  // Credentials
  const [apiKey, setApiKey] = useState<string>('')
  const [provider, setProvider] = useState<string>('gemini')
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false)

  // Chat state
  const [messages, setMessages] = useState<Message[]>([])
  const [isGenerating, setIsGenerating] = useState(false)

  // Load saved API key from localStorage on mount
  useEffect(() => {
    try {
      const savedKey = localStorage.getItem('cpyq_student_ai_key') || ''
      const savedProvider = localStorage.getItem('cpyq_student_ai_provider') || 'gemini'
      setApiKey(savedKey)
      setProvider(savedProvider)
    } catch {
      // localStorage may fail in restricted browser settings
    }
  }, [])

  // Save credentials to localStorage
  const handleSaveCredentials = (newProvider: string, newKey: string) => {
    setProvider(newProvider)
    setApiKey(newKey)
    try {
      localStorage.setItem('cpyq_student_ai_provider', newProvider)
      localStorage.setItem('cpyq_student_ai_key', newKey)
    } catch {
      // ignore
    }
  }

  // Active course object
  const activeCourse = courses.find((c) => c.code === context.courseCode) || defaultCourse

  // Context updates
  const handleContextChange = (updates: Partial<StudyContext>) => {
    setContext((prev) => {
      const next = { ...prev, ...updates }
      // If course changed, reset module and topic
      if (updates.courseCode && updates.courseCode !== prev.courseCode) {
        next.moduleId = ''
        next.topicName = ''
      }
      return next
    })
  }

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
          provider,
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

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] overflow-hidden">
      {/* Top Context & Grounding Control Bar */}
      <TutorContextBar
        courses={courses}
        context={context}
        onContextChange={handleContextChange}
        onOpenKeyModal={() => setIsKeyModalOpen(true)}
        hasApiKey={Boolean(apiKey)}
        provider={provider}
        groundedQuestionCount={activeCourse?.questionCount ?? 0}
      />

      {/* Main Conversational Academic Tutor (Clean Full Width View) */}
      <div className="flex-1 flex overflow-hidden">
        <TutorChat
          messages={messages}
          onSendMessage={handleSendMessage}
          isGenerating={isGenerating}
          courseTitle={activeCourse?.title || 'Course'}
          courseCode={activeCourse?.code || context.courseCode}
          topicName={context.topicName}
        />
      </div>

      {/* AI Key & Provider Settings Modal */}
      <ApiKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        onSave={handleSaveCredentials}
        initialProvider={provider}
        initialKey={apiKey}
      />
    </div>
  )
}
