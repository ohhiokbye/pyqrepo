'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { CourseWithModules, TutorSource } from '@/lib/types'
import { TutorContextBar, type StudyContext } from './TutorContextBar'
import { TutorChat, type Message } from './TutorChat'
import { TutorComposer } from './TutorComposer'
import { TutorBackground } from './TutorBackground'
import { ApiKeyModal } from './ApiKeyModal'

type Props = { courses: CourseWithModules[]; initialCourseCode?: string; authenticated: boolean; checkingSession: boolean }
export function TutorWorkspace({ courses, initialCourseCode, authenticated, checkingSession }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const defaultCourse = courses.find((course) => course.code === initialCourseCode) || courses[0]
  const selectedCode = searchParams.get('courseCode') || defaultCourse?.code || ''
  const activeCourse = courses.find((course) => course.code === selectedCode) || defaultCourse
  const context: StudyContext = {
    program: searchParams.get('program') || 'ALL', semester: searchParams.get('semester') || 'ALL',
    courseCode: activeCourse?.code || '', moduleId: searchParams.get('moduleId') || '', topicName: searchParams.get('topicName') || '',
    examType: searchParams.get('examType') || '', year: searchParams.get('year') || '',
  }
  const [apiKey, setApiKey] = useState('')
  const [provider, setProvider] = useState<'gemini' | 'groq'>('gemini')
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [started, setStarted] = useState(false)
  const [failedPrompt, setFailedPrompt] = useState('')
  const [failedOptions, setFailedOptions] = useState<{ intent: 'explain' | 'revision' | 'practice'; minutes: number } | undefined>()
  const request = useRef<AbortController | null>(null)
  const requestId = useRef(0)
  const previousCourse = useRef(context.courseCode)
  const reset = () => {
    requestId.current++
    request.current?.abort()
    setMessages([]); setError(''); setIsGenerating(false); setStarted(false); setFailedPrompt('')
  }
  useEffect(() => {
    try { localStorage.removeItem('cpyq_student_ai_key') } catch { /* restricted browser */ }
    const open = () => setIsKeyModalOpen(true)
    window.addEventListener('cpyq-provider-settings', open)
    return () => { window.removeEventListener('cpyq-provider-settings', open); request.current?.abort() }
  }, [])
  useEffect(() => {
    if (previousCourse.current !== context.courseCode) {
      previousCourse.current = context.courseCode
      requestId.current++; request.current?.abort()
      setMessages([]); setError(''); setIsGenerating(false); setStarted(false); setFailedPrompt('')
    }
  }, [context.courseCode])

  const changeContext = (updates: Partial<StudyContext>) => {
    const next = { ...context, ...updates }
    if (updates.courseCode && updates.courseCode !== context.courseCode) { next.moduleId = ''; next.topicName = ''; reset() }
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(next)) {
      if (value && value !== 'ALL') params.set(key, value)
      else params.delete(key)
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }
  const send = async (text: string, options?: { intent: 'explain' | 'revision' | 'practice'; minutes: number }) => {
    if (isGenerating || !authenticated || !activeCourse) return
    if (!apiKey) { setError('Add your Gemini or Groq key in provider settings to ask the tutor.'); setIsKeyModalOpen(true); return }
    const updated = [...messages, { id: crypto.randomUUID(), role: 'user' as const, content: text }]
    setMessages(updated); setError(''); setFailedPrompt(''); setStarted(true); setIsGenerating(true)
    const id = ++requestId.current
    request.current = new AbortController()
    try {
      const response = await fetch('/api/tutor/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: request.current.signal,
        body: JSON.stringify({ messages: updated.slice(-9).map(({ role, content }) => ({ role, content })), context: { ...context, year: context.year ? Number(context.year) : undefined }, apiKey, provider, ...options }),
      })
      const data = await response.json()
      if (id !== requestId.current) return
      if (!response.ok) {
        if (response.status === 401) setApiKey('')
        throw new Error(data.message || data.error || 'The tutor could not respond. Please retry.')
      }
      if (typeof data.reply !== 'string' || !data.reply.trim()) throw new Error('The provider returned an empty response. Please retry.')
      const citations = (data.sources || []).map((source: TutorSource) => ({ id: source.id, source: source.source, label: source.label, url: source.url }))
      setMessages([...updated, { id: crypto.randomUUID(), role: 'assistant', content: data.reply, citations, revision: data.revision }])
    } catch (failure) {
      if (id === requestId.current) { setMessages(updated.slice(0, -1)); setFailedPrompt(text); setFailedOptions(options); setError(failure instanceof Error ? failure.message : 'Could not reach the tutor. Please retry.') }
    } finally { if (id === requestId.current) setIsGenerating(false) }
  }
  const opening = !started
  const studyControls = <TutorContextBar courses={courses} context={context} onContextChange={changeContext} disabled={isGenerating} />
  const credential = <button type="button" className="text-xs underline underline-offset-4" onClick={() => setIsKeyModalOpen(true)}>{provider === 'groq' ? 'Groq' : 'Gemini'} · {apiKey ? 'Page-session key set' : 'Key required'}</button>
  return <main className={`tutor-shell ${opening ? 'tutor-opening' : 'tutor-conversation'}`}>
    {opening && <TutorBackground />}
    <div className="tutor-content">
      <div className="flex flex-wrap justify-between items-center gap-3 py-5 text-xs">
        <span>{opening ? 'Your syllabus. Your past papers.' : `${activeCourse?.code || 'Choose a course'} · ${context.topicName || 'Entire syllabus'}`}</span>
        <div className="flex flex-wrap gap-4 items-center">{credential}{!opening && <button type="button" onClick={reset} className="underline underline-offset-4">New chat</button>}{authenticated && <button type="button" className="underline underline-offset-4" onClick={async () => { setApiKey(''); reset(); await fetch('/api/auth/logout', { method: 'POST' }); window.location.reload() }}>Sign out</button>}</div>
      </div>
      {opening ? <div className="tutor-introduction">
        <h1>Prepare for exams—with a tutor that knows <em>your papers.</em></h1>
        <p className="mt-6 mb-8 text-sm sm:text-base max-w-xl">Understand your syllabus, explore past questions, and decide what to study next.</p>
        {studyControls}
        <div className="mt-5"><TutorComposer key={context.courseCode} onSend={send} busy={isGenerating} disabled={!authenticated || !activeCourse} opening subject={context.topicName || activeCourse?.title || 'my course'} /></div>
        {checkingSession ? <p className="mt-5 text-sm" role="status">Checking student sign-in…</p> : !authenticated && <p className="mt-5 text-sm"><a href="/api/auth/google" className="tutor-sign-in">Continue with Google</a><span className="block mt-2">Sign in to send questions. The paper library is public.</span></p>}
        {!courses.length && <p className="mt-4 text-sm">No courses are available yet. Add a syllabus in administration to begin.</p>}
      </div> : <>
        <details className="mb-3"><summary className="text-xs cursor-pointer">Study context · {context.examType || 'All exams'}{context.year && ` · ${context.year}`}</summary><div className="mt-3">{studyControls}</div></details>
        <TutorChat messages={messages} isGenerating={isGenerating} />
        <div className="tutor-composer-dock"><TutorComposer onSend={send} busy={isGenerating} disabled={!authenticated} opening={false} subject={context.topicName || activeCourse?.title || 'my course'} /></div>
      </>}
      {error && <p className="tutor-error" role="alert">{error}{failedPrompt && <button type="button" disabled={isGenerating} className="block mt-2 underline underline-offset-4" onClick={() => send(failedPrompt, failedOptions)}>Retry question</button>}</p>}
    </div>
    {isKeyModalOpen && <ApiKeyModal isOpen onClose={() => setIsKeyModalOpen(false)} onSave={(key, nextProvider) => { setApiKey(key); setProvider(nextProvider) }} initialKey={apiKey} initialProvider={provider} />}
  </main>
}
