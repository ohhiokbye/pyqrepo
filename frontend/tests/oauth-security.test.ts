import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPair, exportJWK, SignJWT } from 'jose'
import { NextRequest, NextResponse } from 'next/server'
import { verifyGoogleIdentity } from '../src/lib/googleIdentity'
import { setOAuthState, STATE_COOKIE, SESSION_COOKIE, verifyCsrfOrigin } from '../src/lib/auth'
import { GET as callback } from '../src/app/api/auth/google/callback/route'

process.env.AUTH_SECRET = 'validation-secret-at-least-32-characters'
process.env.APP_URL = 'http://localhost:3000'
process.env.GOOGLE_CLIENT_ID = 'test-client'
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'

test('Google login verifies signature, audience, issuer, expiry, email and nonce before issuing a session', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256')
  const jwk = { ...await exportJWK(publicKey), kid: 'test-key', alg: 'RS256', use: 'sig' }
  const nonce = 'test-nonce'
  const claims = { sub: 'test-user', email: 'student@example.com', email_verified: true, nonce }
  const token = (overrides = {}) => new SignJWT({ ...claims, ...overrides }).setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).setIssuedAt().setIssuer('https://accounts.google.com').setAudience('test-client').setExpirationTime('5m').sign(privateKey)
  const originalFetch = global.fetch
  let exchangeToken = await token()
  let calls = 0
  global.fetch = async (url) => {
    calls++
    if (String(url) === 'https://www.googleapis.com/oauth2/v3/certs') return new Response(JSON.stringify({ keys: [jwk] }))
    assert.equal(String(url), 'https://oauth2.googleapis.com/token')
    return new Response(JSON.stringify({ id_token: exchangeToken }))
  }
  try {
    assert.equal(await verifyGoogleIdentity(exchangeToken, 'test-client', nonce), 'student@example.com')
    await assert.rejects(() => verifyGoogleIdentity(exchangeToken, 'other-client', nonce))
    await assert.rejects(() => verifyGoogleIdentity(exchangeToken, 'test-client', 'other-nonce'))
    await assert.rejects(() => verifyGoogleIdentity(exchangeToken.slice(0, -20) + 'invalid', 'test-client', nonce))
    await assert.rejects(() => verifyGoogleIdentity(exchangeToken + '.extra', 'test-client', nonce))
    await assert.rejects(() => verifyGoogleIdentity('a'.repeat(16_385), 'test-client', nonce))
    await assert.rejects(() => token({ email_verified: false }).then((value) => verifyGoogleIdentity(value, 'test-client', nonce)))
    await assert.rejects(() => new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).setIssuedAt().setIssuer('https://evil.example').setAudience('test-client').setExpirationTime('5m').sign(privateKey).then((value) => verifyGoogleIdentity(value, 'test-client', nonce)))
    await assert.rejects(() => new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).setIssuedAt().setIssuer('https://accounts.google.com').setAudience('test-client').setExpirationTime(1).sign(privateKey).then((value) => verifyGoogleIdentity(value, 'test-client', nonce)))

    const state = new NextResponse()
    setOAuthState(state, nonce)
    const request = (providedState = nonce) => new NextRequest(`http://localhost:3000/api/auth/google/callback?code=test-code&state=${providedState}`, { headers: { cookie: `${STATE_COOKIE}=${state.cookies.get(STATE_COOKIE)!.value}` } })
    const response = await callback(request())
    assert.ok(response.cookies.get(SESSION_COOKIE))
    const before = calls
    assert.equal((await callback(request('wrong-state'))).cookies.get(SESSION_COOKIE), undefined)
    assert.equal(calls, before)
    exchangeToken = await token({ nonce: 'wrong-nonce' })
    assert.equal((await callback(request())).cookies.get(SESSION_COOKIE), undefined)
  } finally { global.fetch = originalFetch }
})

test('production mutations require an explicit trusted origin or referer', () => {
  const previous = process.env.NODE_ENV
  Object.assign(process.env, { NODE_ENV: 'production' })
  try {
    const request = (headers: Record<string, string> = {}) => new NextRequest('http://localhost:3000/api/test', { method: 'POST', headers })
    assert.equal(verifyCsrfOrigin(request()), false)
    assert.equal(verifyCsrfOrigin(request({ origin: 'http://localhost:3000' })), true)
    assert.equal(verifyCsrfOrigin(request({ referer: 'http://localhost:3000/upload' })), true)
    assert.equal(verifyCsrfOrigin(request({ origin: 'http://localhost:3000', 'sec-fetch-site': 'cross-site' })), false)
  } finally {
    if (previous === undefined) Reflect.deleteProperty(process.env, 'NODE_ENV')
    else Object.assign(process.env, { NODE_ENV: previous })
  }
})
