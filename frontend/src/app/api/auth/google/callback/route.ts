import { NextRequest, NextResponse } from 'next/server'
import { clearOAuthState, consumeOAuthState, setSession } from '@/lib/auth'
import { verifyGoogleIdentity } from '@/lib/googleIdentity'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  const appUrl = process.env.APP_URL?.trim()
  if (!code || !state || !clientId || !clientSecret || !appUrl || !consumeOAuthState(request, state)) {
    return NextResponse.redirect(new URL('/?login=failed', request.url))
  }
  try {
    const redirectUri = `${appUrl.replace(/\/$/, '')}/api/auth/google/callback`
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
      signal: AbortSignal.timeout(10_000), cache: 'no-store', redirect: 'error',
    })
    const token = await tokenResponse.json()
    if (!tokenResponse.ok || typeof token.id_token !== 'string') throw new Error('Token exchange failed')
    const email = await verifyGoogleIdentity(token.id_token, clientId, state)
    const response = NextResponse.redirect(new URL('/', request.url))
    clearOAuthState(response)
    setSession(response, email)
    return response
  } catch {
    return NextResponse.redirect(new URL('/?login=failed', request.url))
  }
}
