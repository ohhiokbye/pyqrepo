import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { chunkMaterialPages } from '../src/lib/materials'
import { revisionEvidence, validCitations, retrievalTerms } from '../src/lib/tutor'
import { readJsonBody, RequestBodyError } from '../src/lib/requestBody'
import { signUploadKey, verifyUploadToken } from '../src/lib/storage/uploadToken'
import { PUT as localUpload } from '../src/app/api/local-upload/route'
import { TutorChat } from '../src/components/tutor/TutorChat'
import { isWorker, verifyCsrfOrigin } from '../src/lib/auth'
import type { ExamAnalysis } from '../src/lib/examAnalysis'

process.env.AUTH_SECRET = 'validation-secret-at-least-32-characters'
process.env.APP_URL = 'http://localhost:3000'
process.env.STORAGE_DRIVER = 'local'

test('notes chunks preserve text, page identity, formulas and bounded overlap', () => {
  const text = ('A long paragraph explains hashing.\n\n').repeat(130) + 'E = mc^2\nprint(x)'
  const chunks = chunkMaterialPages([{ pageIndex: 4, text, heading: 'Hashing', method: 'native' }])
  assert.ok(chunks.length > 1)
  assert.ok(chunks.every((chunk) => chunk.text.length <= 3000 && chunk.sourcePages[0] === 4))
  assert.ok(chunks.some((chunk) => chunk.text.includes('E = mc^2\nprint(x)')))
  assert.deepEqual(chunkMaterialPages([{ pageIndex: 0, text: '', heading: '', method: 'blank' }]), [])
})

test('revision order uses distinct papers, then marks, then syllabus order', () => {
  const course = { id: 'course', code: 'C', title: 'Course', credits: 0, modules: [{ id: 'module', name: 'Module', moduleNo: 1, topics: [{ id: 'a', topicName: 'A' }, { id: 'b', topicName: 'B' }, { id: 'c', topicName: 'C' }] }] }
  const stats: ExamAnalysis = { paperCount: 5, excludedPaperCount: 0, questionAppearances: 4, unknownMarksCount: 0, printedMarksSum: 30, repeatedPatterns: [], exactTextRepeats: [], printedMarksDistribution: [], topics: [
    { topicId: 'a', topic: 'A', module: 'Module', matchingPapers: 2, allocatedMarks: 10, frequency: .4, appearances: 2, markShare: .3 },
    { topicId: 'b', topic: 'B', module: 'Module', matchingPapers: 2, allocatedMarks: 20, frequency: .4, appearances: 2, markShare: .6 },
  ] }
  assert.deepEqual(revisionEvidence(stats, course, 60, {}).topics.map((topic) => topic.topic), ['B', 'A', 'C'])
  assert.deepEqual(revisionEvidence({ ...stats, paperCount: 0, topics: [] }, course, 120, {}).topics.map((topic) => topic.topic), ['A', 'B', 'C'])
  assert.equal(revisionEvidence({ ...stats, paperCount: 0 }, course, 120, {}).status, 'insufficient_data')
})

test('source validation rejects invented citations and retrieval terms are bounded', () => {
  assert.equal(validCitations('See [1].', [{ source: 1 }]), true)
  assert.equal(validCitations('See [999].', [{ source: 1 }]), false)
  assert.equal(validCitations('General explanation.', []), true)
  assert.ok(retrievalTerms('Explain hashing collisions. What are the important concepts?').includes('hashing'))
  assert.ok(retrievalTerms(Array.from({ length: 100 }, (_, i) => `word${i}`).join(' ')).length <= 24)
})

test('markdown renders source links but suppresses HTML, remote images and arbitrary links', () => {
  const html = renderToStaticMarkup(React.createElement(TutorChat, { isGenerating: false, messages: [{ id: '1', role: 'assistant', content: '<script>alert(1)</script>\n\n[1] [bad](https://evil.example) ![tracking](https://evil.example/pixel)', citations: [{ id: 'note', source: 1, label: 'Lecture p. 1', url: '/api/files/uploads/submissions/source.pdf#page=1' }] }] }))
  assert.equal(html.includes('<script>'), false)
  assert.equal(html.includes('href="https://evil.example"'), false)
  assert.equal(html.includes('<img'), false)
  assert.ok(html.includes('href="/api/files/uploads/submissions/source.pdf#page=1"'))
})

test('request body limits reject malformed and oversized JSON, including chunked bodies', async () => {
  await assert.rejects(() => readJsonBody(new Request('http://localhost', { method: 'POST', body: '{' })), (error: unknown) => error instanceof RequestBodyError && error.status === 400)
  await assert.rejects(() => readJsonBody(new Request('http://localhost', { method: 'POST', body: '123456' }), 5), (error: unknown) => error instanceof RequestBodyError && error.status === 413)
})

test('local PDF upload handles split magic bytes and cannot overwrite an existing object', async () => {
  const key = `uploads/submissions/${randomUUID()}.pdf`
  const token = signUploadKey(key)
  const bytes = [Buffer.from('%P'), Buffer.from('DF-1.4\nfixture')]
  const request = () => new NextRequest(`http://localhost:3000/api/local-upload?key=${key}`, {
    method: 'PUT', headers: { 'x-upload-token': token },
    body: new ReadableStream({ start(controller) { bytes.forEach((chunk) => controller.enqueue(chunk)); controller.close() } }), duplex: 'half',
  } as ConstructorParameters<typeof NextRequest>[1])
  const file = path.resolve('..', 'local_storage', key)
  try {
    assert.equal((await localUpload(request())).status, 200)
    assert.equal((await localUpload(request())).status, 409)
    assert.equal((await fs.readFile(file)).toString(), '%PDF-1.4\nfixture')
    assert.equal((await localUpload(new NextRequest(`http://localhost:3000/api/local-upload?key=${key}`, { method: 'PUT', body: '%PDF-1.4' }))).status, 401)
  } finally { await fs.unlink(file).catch(() => {}) }
})

test('malformed token lengths and unicode worker headers fail without exceptions', () => {
  const key = 'uploads/submissions/test.pdf'
  assert.equal(verifyUploadToken(key, signUploadKey(key) + '.extra'), false)
  process.env.WORKER_INTERNAL_KEY = 'a'
  assert.equal(isWorker(new NextRequest('http://localhost', { headers: { 'x-internal-worker-key': 'é' } })), false)
  assert.equal(verifyCsrfOrigin(new NextRequest('http://localhost:3000/api/test', { method: 'POST', headers: { origin: 'https://evil.example' } })), false)
})
