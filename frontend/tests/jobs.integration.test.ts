import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID, createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../src/lib/db'
import { setSession } from '../src/lib/auth'
import { POST as claim } from '../src/app/api/jobs/claim/route'
import { POST as poll } from '../src/app/api/jobs/poll/route'
import { POST as update } from '../src/app/api/jobs/update/route'
import { POST as heartbeat } from '../src/app/api/jobs/heartbeat/route'
import { POST as checkpoint } from '../src/app/api/jobs/material-page/route'
import { GET as context } from '../src/app/api/jobs/context/route'
import { POST as tutor } from '../src/app/api/tutor/chat/route'
import { calculateExamAnalysis } from '../src/lib/examAnalysis'
import { retrieveTutorSources } from '../src/lib/tutor'
import { checkPersistentRateLimit } from '../src/lib/persistentRateLimit'
import { serveStoredFile } from '../src/lib/storage/access'
import fs from 'node:fs/promises'
import path from 'node:path'

const enabled = process.env.CPYQ_INTEGRATION === '1'
process.env.AUTH_SECRET = 'validation-secret-at-least-32-characters'
process.env.ADMIN_EMAILS = 'admin@example.com'
process.env.WORKER_INTERNAL_KEY = 'validation-worker-key'
process.env.STORAGE_DRIVER = 'local'
process.env.APP_URL = 'http://localhost:3000'

function worker(body?: object, lease?: string) {
  return new NextRequest('http://localhost:3000/api/jobs/test', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-internal-worker-key': 'validation-worker-key', ...(lease ? { 'x-job-lease': lease } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
}
function user(url: string, email?: string, body?: object) {
  const response = new NextResponse()
  if (email) setSession(response, email)
  const cookie = response.cookies.get('cpyq_session')
  return new NextRequest(`http://localhost:3000${url}`, { method: body ? 'POST' : 'GET', headers: { ...(cookie ? { cookie: `cpyq_session=${cookie.value}` } : {}), 'Content-Type': 'application/json', origin: 'http://localhost:3000' }, ...(body ? { body: JSON.stringify(body) } : {}) })
}
after(async () => { await prisma.$disconnect() })

test('leases, notes checkpoints, publication, retrieval, tutor and historical evidence', { skip: !enabled }, async () => {
  assert.equal(new URL(process.env.DATABASE_URL!).pathname, '/cpyq_notes_validation')
  const code = `TEST${randomUUID().slice(0, 8)}`
  const course = await prisma.course.create({ data: { code, title: 'Database algorithms', credits: 0 } })
  const files: string[] = []
  const storedPaths: string[] = []
  const syllabusFile = await prisma.file.create({ data: { s3Key: `uploads/submissions/${randomUUID()}.pdf` } })
  files.push(syllabusFile.id)
  const syllabus = await prisma.syllabusVersion.create({ data: { courseId: course.id, fileId: syllabusFile.id, version: 1 } })
  await prisma.course.update({ where: { id: course.id }, data: { activeSyllabusVersionId: syllabus.id } })
  const module = await prisma.module.create({ data: { courseId: course.id, syllabusVersionId: syllabus.id, moduleNo: 1, name: 'Algorithms', topics: { create: [{ topicName: 'Hashing' }, { topicName: 'Sorting' }] } }, include: { topics: true } })
  const hashing = module.topics.find((topic) => topic.topicName === 'Hashing')!
  const createFile = async (notes = false, year = 2025) => {
    const file = await prisma.file.create({ data: { s3Key: `uploads/submissions/${randomUUID()}.pdf`, ...(notes ? { materials: { create: { courseId: course.id, title: 'Hashing lecture', documentType: 'NOTES' } } } : { papers: { create: { courseId: course.id, examType: 'CAT2', year } } }), submissions: { create: { status: 'PENDING' } }, jobs: { create: { status: 'PENDING' } } }, include: { jobs: true, papers: true, materials: true } })
    files.push(file.id)
    return file
  }
  const originalFetch = global.fetch
  try {
    const file = await createFile()
    const claims = await Promise.all([claim(worker({ jobId: file.jobs[0].id })), claim(worker({ jobId: file.jobs[0].id }))])
    const claimed = await Promise.all(claims.map((res) => res.json()))
    assert.equal(claimed.filter((item) => item.claimed).length, 1)
    const leaseToken = claimed.find((item) => item.claimed).leaseToken
    assert.equal((await heartbeat(worker({ jobId: file.jobs[0].id, leaseToken }))).status, 200)
    assert.equal((await heartbeat(worker({ jobId: file.jobs[0].id, leaseToken: randomUUID() }))).status, 409)
    const payload = { jobId: file.jobs[0].id, leaseToken, status: 'AUTO_PUBLISHED', fileHash: createHash('sha256').update(file.id).digest('hex'), extractionVersion: 'cloud-v2', syllabusVersionId: syllabus.id, analysisComplete: true, pageCount: 1, reviewedPages: [0], questions: [{ questionNumber: 'Q1', extractedText: 'Explain hashing collisions with a worked example.', marks: 5, sourcePages: [0], topicIds: [hashing.id], patternDescription: 'Hashing collision resolution' }] }
    assert.equal((await update(worker({ ...payload, leaseToken: randomUUID() }))).status, 409)
    assert.equal((await update(worker(payload))).status, 200)
    assert.equal((await update(worker(payload))).status, 409)
    assert.equal((await prisma.paper.findUniqueOrThrow({ where: { id: file.papers[0].id } })).publicationStatus, 'AUTO_PUBLISHED')
    const stats = await calculateExamAnalysis({ courseCode: code, examType: 'CAT2' })
    assert.equal(stats.paperCount, 1)
    assert.equal(stats.topics.find((topic) => topic.topicId === hashing.id)?.allocatedMarks, 5)
    assert.equal((await calculateExamAnalysis({ courseCode: code, year: 2024 })).paperCount, 0)

    // Older relevant questions must remain searchable beyond the most recent 40 papers.
    const recentIds = Array.from({ length: 45 }, () => randomUUID())
    await prisma.paper.createMany({ data: recentIds.map((id) => ({ id, fileId: file.id, courseId: course.id, examType: 'CAT2', year: 2026, publicationStatus: 'AUTO_PUBLISHED' })) })
    await prisma.question.createMany({ data: recentIds.map((paperId) => ({ paperId, questionNumber: 'Q1', extractedText: 'Explain merge sorting algorithms.', sourcePages: [0] })) })
    assert.equal((await retrieveTutorSources({ courseId: course.id, query: 'hashing collisions' })).some((source) => source.kind === 'question'), true)
    const excludedStats = await calculateExamAnalysis({ courseCode: code })
    assert.equal(excludedStats.paperCount, 1)
    assert.equal(excludedStats.excludedPaperCount, 45)

    const rls = await prisma.$queryRaw<{ relname: string; relrowsecurity: boolean }[]>`SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('QuestionPattern', 'MaterialPage', 'MaterialChunk', 'ApiRateLimit') AND relnamespace = 'public'::regnamespace`
    assert.equal(rls.length, 4)
    assert.ok(rls.every((table) => table.relrowsecurity))

    const notes = await createFile(true)
    const material = notes.materials[0]
    const noteClaim = await (await claim(worker({ jobId: notes.jobs[0].id }))).json()
    const notePayload = { jobId: notes.jobs[0].id, leaseToken: noteClaim.leaseToken, fileHash: createHash('sha256').update(notes.id).digest('hex'), extractionVersion: 'notes-v1', pageCount: 2 }
    const page = { pageIndex: 0, text: 'Hashing resolves collisions using chaining. The zebra example uses a bucket array.', heading: 'Hashing collisions', method: 'native' }
    assert.equal((await checkpoint(worker({ ...notePayload, page, leaseToken: randomUUID() }))).status, 409)
    assert.equal((await checkpoint(worker({ ...notePayload, page }))).status, 200)
    assert.equal((await checkpoint(worker({ ...notePayload, page }))).status, 200)
    assert.equal(await prisma.materialPage.count({ where: { materialId: material.id } }), 1)
    const getContext = new NextRequest(`http://localhost:3000/api/jobs/context?jobId=${notes.jobs[0].id}`, { headers: { 'x-internal-worker-key': 'validation-worker-key', 'x-job-lease': noteClaim.leaseToken } })
    assert.equal((await (await context(getContext)).json()).material.pages.length, 1)
    assert.equal((await update(worker({ ...notePayload, status: 'AUTO_PUBLISHED', materialComplete: true, reviewedPages: [0, 1] }))).status, 200)
    assert.equal((await prisma.studyMaterial.findUniqueOrThrow({ where: { id: material.id } })).publicationStatus, 'RETRY_PENDING')
    assert.equal(await prisma.materialChunk.count({ where: { materialId: material.id } }), 0)
    await prisma.processingJob.update({ where: { id: notes.jobs[0].id }, data: { nextRetryAt: new Date() } })
    const resumed = await (await claim(worker({ jobId: notes.jobs[0].id }))).json()
    notePayload.leaseToken = resumed.leaseToken
    assert.equal((await checkpoint(worker({ ...notePayload, page: { ...page, pageIndex: 1, text: 'The expected lookup time is O(1), while worst-case lookup is O(n).' } }))).status, 200)
    assert.equal((await update(worker({ ...notePayload, status: 'AUTO_PUBLISHED', materialComplete: true, reviewedPages: [0, 1] }))).status, 200)
    assert.equal(await prisma.materialChunk.count({ where: { materialId: material.id } }), 2)
    const stale = await update(worker({ ...notePayload, leaseToken: randomUUID(), status: 'AUTO_PUBLISHED', materialComplete: true, reviewedPages: [0, 1] }))
    assert.equal(stale.status, 409)
    assert.equal(await prisma.materialChunk.count({ where: { materialId: material.id } }), 2)

    const stored = path.resolve('..', 'local_storage', notes.s3Key)
    await fs.mkdir(path.dirname(stored), { recursive: true }); await fs.writeFile(stored, '%PDF-1.4 fixture')
    storedPaths.push(stored)
    assert.equal((await serveStoredFile(user('/'), notes.s3Key.split('/'), false)).status, 404)
    assert.equal((await serveStoredFile(user('/', 'student@example.com'), notes.s3Key.split('/'), false)).status, 200)
    const retrieved = await retrieveTutorSources({ courseId: course.id, query: 'hashing collisions', examType: 'CAT2' })
    assert.equal(retrieved.some((source) => source.kind === 'notes'), true)
    assert.equal(retrieved.some((source) => source.kind === 'question'), true)
    assert.equal((await retrieveTutorSources({ courseId: 'unrelated-course', query: 'hashing collisions' })).length, 0)
    assert.equal((await retrieveTutorSources({ courseId: course.id, query: 'hashing', year: 2024 })).every((source) => source.kind === 'notes'), true)
    await prisma.studyMaterial.update({ where: { id: material.id }, data: { publicationStatus: 'PROCESSING' } })
    assert.equal((await retrieveTutorSources({ courseId: course.id, query: 'hashing' })).some((source) => source.kind === 'notes'), false)
    assert.equal((await serveStoredFile(user('/', 'student@example.com'), notes.s3Key.split('/'), false)).status, 404)
    await prisma.studyMaterial.update({ where: { id: material.id }, data: { publicationStatus: 'AUTO_PUBLISHED' } })

    let receivedSystem = ''
    global.fetch = async (_url, options) => {
      const sent = JSON.parse(String(options?.body))
      receivedSystem = sent.systemInstruction.parts[0].text
      assert.equal((options?.headers as Record<string, string>)['x-goog-api-key'], 'student-fixture-key')
      return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Start with hashing collisions. See the teaching notes [1].' }] } }] }), { status: 200 })
    }
    const request = { messages: [{ role: 'user', content: 'Help me prioritize hashing revision' }], context: { courseCode: code, examType: 'CAT2' }, apiKey: 'student-fixture-key', intent: 'revision', minutes: 60 }
    const reply = await tutor(user('/api/tutor/chat', 'student@example.com', request))
    assert.equal(reply.status, 200)
    const body = await reply.json()
    assert.equal(body.revision.minutes, 60)
    assert.equal(body.revision.topics[0].topic, 'Hashing')
    assert.equal(body.revision.topics[0].matchingPapers, 1)
    assert.match(receivedSystem, /Hashing resolves collisions/)
    assert.equal(reply.headers.get('cache-control'), 'private, no-store')
    global.fetch = async () => new Response(JSON.stringify({ candidates: [{ finishReason: 'MAX_TOKENS' }] }), { status: 200 })
    assert.equal((await tutor(user('/api/tutor/chat', 'student@example.com', request))).status, 502)
    global.fetch = async () => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Fake reference [999]' }] } }] }), { status: 200 })
    assert.equal((await tutor(user('/api/tutor/chat', 'student@example.com', request))).status, 502)
    assert.equal((await tutor(user('/api/tutor/chat', undefined, request))).status, 401)

    const expired = await createFile()
    const old = await (await claim(worker({ jobId: expired.jobs[0].id }))).json()
    await prisma.processingJob.update({ where: { id: expired.jobs[0].id }, data: { leaseExpiresAt: new Date(0) } })
    await poll(worker())
    assert.equal((await prisma.processingJob.findUniqueOrThrow({ where: { id: expired.jobs[0].id } })).status, 'RETRY_PENDING')
    assert.equal((await update(worker({ ...payload, jobId: expired.jobs[0].id, leaseToken: old.leaseToken }))).status, 409)
    const rateIdentity = randomUUID()
    const limits = await Promise.all(Array.from({ length: 8 }, () => checkPersistentRateLimit('integration', rateIdentity, 3, 60_000)))
    assert.equal(limits.filter(Boolean).length, 3)
  } finally {
    global.fetch = originalFetch
    for (const stored of storedPaths) await fs.unlink(stored).catch(() => {})
    await prisma.studyMaterial.deleteMany({ where: { courseId: course.id } })
    await prisma.question.deleteMany({ where: { paper: { courseId: course.id } } })
    await prisma.questionPattern.deleteMany({ where: { courseId: course.id } })
    await prisma.paper.deleteMany({ where: { courseId: course.id } })
    await prisma.submission.deleteMany({ where: { fileId: { in: files } } })
    await prisma.processingJob.deleteMany({ where: { fileId: { in: files } } })
    await prisma.topic.deleteMany({ where: { moduleId: module.id } })
    await prisma.module.delete({ where: { id: module.id } })
    await prisma.syllabusVersion.delete({ where: { id: syllabus.id } })
    await prisma.file.deleteMany({ where: { id: { in: files } } })
    await prisma.course.delete({ where: { id: course.id } })
    await prisma.apiRateLimit.deleteMany({})
  }
})
