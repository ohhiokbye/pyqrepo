import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest, NextResponse } from 'next/server'
import { setSession, getSession, requireAdmin, requireUser, requireUploadAccess, isWorker } from '../src/lib/auth'
import { signUploadKey, verifyUploadToken } from '../src/lib/storage/uploadToken'
import { aggregateTopicMarks } from '../src/lib/analytics'
import { retryAt, MAX_ATTEMPTS } from '../src/lib/jobs/retry'
import fs from 'node:fs'

process.env.AUTH_SECRET = 'validation-secret-at-least-32-characters'
process.env.ADMIN_EMAILS = 'admin@example.com'
process.env.WORKER_INTERNAL_KEY = 'validation-worker-key'
process.env.APP_URL = 'http://localhost:3000'

function request(email?: string, method = 'GET', origin?: string) {
  const response = new NextResponse()
  if (email) setSession(response, email)
  const cookie = response.cookies.get('cpyq_session')
  return new NextRequest('http://localhost:3000/api/test', { method, headers: { ...(cookie ? { cookie: `cpyq_session=${cookie.value}` } : {}), ...(origin ? { origin } : {}) } })
}

test('chat requires Google session; admin allowlist is checked server-side', () => {
  assert.equal((requireUser(request()) as NextResponse).status, 401)
  assert.equal(getSession(request('student@example.com'))?.isAdmin, false)
  assert.equal((requireAdmin(request('student@example.com')) as NextResponse).status, 403)
  assert.equal((requireAdmin(request('admin@example.com')) as { isAdmin: boolean }).isAdmin, true)
  assert.equal((requireAdmin(request('admin@example.com', 'POST', 'https://evil.example')) as NextResponse).status, 403)
})

test('tampered sessions and missing worker credentials fail closed', () => {
  const req = request('admin@example.com')
  req.cookies.set('cpyq_session', req.cookies.get('cpyq_session')!.value + 'x')
  assert.equal(getSession(req), null)
  assert.equal(isWorker(request()), false)
  assert.equal(isWorker(new NextRequest('http://localhost:3000', { headers: { 'x-internal-worker-key': 'validation-worker-key' } })), true)
})

test('upload token authorizes only its issued object', () => {
  const token = signUploadKey('uploads/submissions/one.pdf')
  assert.equal(verifyUploadToken('uploads/submissions/one.pdf', token), true)
  assert.equal(verifyUploadToken('uploads/submissions/two.pdf', token), false)
  assert.equal(verifyUploadToken('uploads/submissions/one.pdf', token + 'x'), false)
})

test('analytics denominator includes unmapped marks and splits multi-topic marks', () => {
  const link = (id: string) => ({ topicId: id, topic: { topicName: id, module: { name: 'Unit 1' } } })
  const result = aggregateTopicMarks([{ marks: 10, questionTopics: [link('A'), link('B')] }, { marks: 5, questionTopics: [link('A')] }, { marks: 5, questionTopics: [] }])
  assert.equal(result.totalPublishedMarks, 20)
  assert.equal(result.topics[0].totalMarks, 10)
  assert.equal(result.topics[0].appearances, 2)
  assert.equal(result.topics[0].averageMarks, 5)
  assert.equal(result.topics[0].markShare, .5)
  assert.equal(result.topics[1].markShare, .25)
})

test('automatic retries back off and stop at attempt limit', () => {
  assert.equal(retryAt(1, 0)?.getTime(), 60_000)
  assert.equal(retryAt(2, 0)?.getTime(), 120_000)
  assert.equal(retryAt(MAX_ATTEMPTS, 0), null)
})

test('browser credentials remain in page memory and are never persisted', () => {
  const source = fs.readFileSync('src/components/tutor/TutorWorkspace.tsx', 'utf8')
  assert.equal(/(?:localStorage|sessionStorage)\.(?:setItem|getItem)/.test(source), false)
  assert.match(source, /setApiKey\(''\); reset\(\)/)
  const route = fs.readFileSync('src/app/api/tutor/chat/route.ts', 'utf8')
  assert.equal(/\?key=/.test(route), false)
  assert.equal(/console\.[^(]+\([^\n]*(?:errBody|res\.text|fetchErr)/.test(route), false)
  const workerLlm = fs.readFileSync('../worker/src/providers/llm.py', 'utf8')
  assert.equal(/\?key=\{self\.api_key\}/.test(workerLlm), false)
})

test('state-changing user requests enforce CSRF origin verification', () => {
  const crossSiteReq = request('student@example.com', 'POST', 'https://evil.example')
  assert.equal((requireUser(crossSiteReq) as NextResponse).status, 403)
  const validSameOriginReq = request('student@example.com', 'POST', 'http://localhost:3000')
  assert.equal((requireUser(validSameOriginReq) as { email: string }).email, 'student@example.com')
})

test('shared upload passphrase grants paper contribution without Google or admin access', () => {
  const previous = process.env.UPLOAD_PASSPHRASE
  process.env.UPLOAD_PASSPHRASE = 'test-contributors'
  const contributor = (passphrase: string, origin = 'http://localhost:3000') => new NextRequest('http://localhost:3000/api/upload/init', {
    method: 'POST', headers: { origin, 'x-contributor-passphrase': passphrase },
  })
  try {
    assert.deepEqual(requireUploadAccess(contributor('test-contributors')), { email: 'shared-passphrase', isAdmin: false })
    assert.equal((requireUploadAccess(contributor('wrong')) as NextResponse).status, 403)
    assert.equal((requireUploadAccess(contributor('')) as NextResponse).status, 403)
    assert.equal((requireUploadAccess(contributor('test-contributors', 'https://evil.example')) as NextResponse).status, 403)
    assert.equal((requireAdmin(contributor('test-contributors')) as NextResponse).status, 403)
    assert.equal((requireUser(contributor('test-contributors')) as NextResponse).status, 401)
    delete process.env.UPLOAD_PASSPHRASE
    assert.equal((requireUploadAccess(contributor('test-contributors')) as NextResponse).status, 503)
    assert.equal((requireUploadAccess(request('admin@example.com', 'POST')) as { isAdmin: boolean }).isAdmin, true)
  } finally {
    if (previous === undefined) delete process.env.UPLOAD_PASSPHRASE
    else process.env.UPLOAD_PASSPHRASE = previous
  }
})
