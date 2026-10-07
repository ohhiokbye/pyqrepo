import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

const isProd = process.env.NODE_ENV === 'production'
export const SESSION_COOKIE = isProd ? '__Host-cpyq_session' : 'cpyq_session'
export const STATE_COOKIE = isProd ? '__Host-cpyq_google_state' : 'cpyq_google_state'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 7 days max lifetime
const IDLE_TIMEOUT_MS = 60 * 60 * 24 * 1000 // 24 hours idle timeout

export type Session = { email: string; isAdmin: boolean }

function secret(): string {
  const value = process.env.AUTH_SECRET?.trim()
  if (!value || value.length < 32) throw new Error('AUTH_SECRET must be at least 32 characters')
  return value
}

function sign(value: string): string { return crypto.createHmac('sha256', secret()).update(value).digest('base64url') }

function encode(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${sign(body)}`
}

function decode(value: string | undefined): Record<string, unknown> | null {
  if (!value) return null
  if (value.length > 4096 || value.split('.').length !== 2) return null
  const [body, signature] = value.split('.')
  if (!body || !signature) return null
  const expected = sign(body)
  const provided = Buffer.from(signature)
  const expectedBytes = Buffer.from(expected)
  if (provided.length !== expectedBytes.length || !crypto.timingSafeEqual(provided, expectedBytes)) return null
  try { return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Record<string, unknown> } catch { return null }
}

export function getSession(request: NextRequest): Session | null {
  try {
    const raw = request.cookies.get(SESSION_COOKIE)?.value
    const data = decode(raw)
    if (!data || typeof data.email !== 'string' || typeof data.expiresAt !== 'number' || data.expiresAt < Date.now()) return null
    if (typeof data.lastActive === 'number' && Date.now() - data.lastActive > IDLE_TIMEOUT_MS) return null
    const admins = (process.env.ADMIN_EMAILS || '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean)
    return { email: data.email.toLowerCase(), isAdmin: admins.includes(data.email.toLowerCase()) }
  } catch { return null }
}

export function verifyCsrfOrigin(request: NextRequest): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true
  const secFetchSite = request.headers.get('sec-fetch-site')
  if (secFetchSite === 'cross-site') return false
  const expectedOrigin = new URL(process.env.APP_URL || request.url).origin
  const origin = request.headers.get('origin')
  if (origin) return origin === expectedOrigin
  const referer = request.headers.get('referer')
  if (referer) {
    try { return new URL(referer).origin === expectedOrigin } catch { return false }
  }
  if (process.env.NODE_ENV === 'production') return false
  const host = request.headers.get('host') || request.nextUrl.host
  const expectedHost = new URL(process.env.APP_URL || request.url).host
  if (host && host === expectedHost) return true
  return false
}

export function requireUser(request: NextRequest): Session | NextResponse {
  if (!verifyCsrfOrigin(request)) return NextResponse.json({ error: 'CSRF_REJECTED', message: 'Invalid request origin' }, { status: 403 })
  return getSession(request) ?? NextResponse.json({ error: 'AUTH_REQUIRED', message: 'Sign in with Google to use the tutor.' }, { status: 401 })
}

export function requireAdmin(request: NextRequest): Session | NextResponse {
  if (!verifyCsrfOrigin(request)) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  const session = getSession(request)
  return session?.isAdmin ? session : NextResponse.json({ error: 'ADMIN_REQUIRED' }, { status: 403 })
}

/** Shared contributors can upload papers; all administration still requires Google. */
export function requireUploadAccess(request: NextRequest): Session | NextResponse {
  if (!verifyCsrfOrigin(request)) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  const session = getSession(request)
  if (session?.isAdmin) return session
  const expected = process.env.UPLOAD_PASSPHRASE?.trim()
  const supplied = request.headers.get('x-contributor-passphrase')?.trim()
  if (!expected) return NextResponse.json({ error: 'Contributor uploads are not configured. Ask the library administrator.' }, { status: 503 })
  if (!supplied || supplied.length > 1024 || !crypto.timingSafeEqual(
    crypto.createHash('sha256').update(expected).digest(),
    crypto.createHash('sha256').update(supplied).digest(),
  )) return NextResponse.json({ error: 'Enter the correct upload passphrase.' }, { status: 403 })
  return { email: 'shared-passphrase', isAdmin: false }
}

export function setSession(response: NextResponse, email: string): void {
  const payload = { email, expiresAt: Date.now() + MAX_AGE_SECONDS * 1000, lastActive: Date.now() }
  response.cookies.set(SESSION_COOKIE, encode(payload), {
    httpOnly: true, secure: isProd, sameSite: 'lax', path: '/', maxAge: MAX_AGE_SECONDS,
  })
}

export function setOAuthState(response: NextResponse, state: string): void {
  response.cookies.set(STATE_COOKIE, encode({ state, expiresAt: Date.now() + 10 * 60 * 1000 }), {
    httpOnly: true, secure: isProd, sameSite: 'lax', path: '/', maxAge: 600,
  })
}

export function consumeOAuthState(request: NextRequest, state: string): boolean {
  const raw = request.cookies.get(STATE_COOKIE)?.value
  const data = decode(raw)
  return Boolean(data && data.state === state && typeof data.expiresAt === 'number' && data.expiresAt > Date.now())
}

export function clearOAuthState(response: NextResponse): void {
  response.cookies.delete(STATE_COOKIE)
  response.cookies.delete('cpyq_google_state')
}

export function isWorker(request: NextRequest): boolean {
  const expected = process.env.WORKER_INTERNAL_KEY
  const provided = request.headers.get('x-internal-worker-key')
  if (!expected || !provided || provided.length > 512) return false
  const a = Buffer.from(expected), b = Buffer.from(provided)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
