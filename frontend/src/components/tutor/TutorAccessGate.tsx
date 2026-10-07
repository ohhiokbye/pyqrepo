'use client'

import { useEffect, useState } from 'react'
import { TutorWorkspace } from './TutorWorkspace'
import type { CourseWithModules } from '@/lib/types'

type Props = { courses: CourseWithModules[]; initialCourseCode?: string }

export function TutorAccessGate(props: Props) {
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    fetch('/api/auth/session').then((response) => response.json()).then((data) => setAuthenticated(Boolean(data.authenticated))).catch(() => setAuthenticated(false)).finally(() => setLoading(false))
  }, [])

  return <TutorWorkspace key={authenticated ? "student" : "visitor"} {...props} authenticated={authenticated} checkingSession={loading} />
}
