import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { setOAuthState } from '@/lib/auth'

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const appUrl = process.env.APP_URL?.trim()
  if (!clientId || !appUrl) return NextResponse.json({ error: 'Google sign-in is not configured.' }, { status: 503 })
  const state = crypto.randomBytes(32).toString('base64url')
  const callback = `${appUrl.replace(/\/$/, '')}/api/auth/google/callback`
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', callback)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid email')
  url.searchParams.set('state', state)
  url.searchParams.set('nonce', state)
  url.searchParams.set('prompt', 'select_account')
  const response = NextResponse.redirect(url)
  setOAuthState(response, state)
  return response
}
