'use client'
import { useEffect, useState } from 'react'

export function AdminAccessGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'loading' | 'admin' | 'student' | 'guest' | 'error'>('loading')
  useEffect(() => {
    fetch('/api/auth/session').then((res) => { if (!res.ok) throw new Error(); return res.json() }).then((session) => setState(session.session?.isAdmin ? 'admin' : session.authenticated ? 'student' : 'guest')).catch(() => setState('error'))
  }, [])
  if (state === 'admin') return children
  return <main className="mx-auto max-w-xl space-y-4 p-8">
    <h1 className="text-xl font-semibold">Library administration</h1>
    <p>{state === 'loading' ? 'Checking administrator access…' : state === 'student' ? 'This account is not on the administrator allowlist.' : state === 'error' ? 'Could not check your session. Reload to try again.' : 'Sign in with your allowlisted Google account to manage the library.'}</p>
    {state === 'guest' && <a href="/api/auth/google" className="inline-block rounded border px-4 py-2">Continue with Google</a>}
    {state === 'student' && <button className="rounded border px-4 py-2" onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/api/auth/google' }}>Switch account</button>}
  </main>
}
