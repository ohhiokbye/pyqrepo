import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { NextRequest } from 'next/server'
import { prisma } from '../src/lib/db'
import { POST as init } from '../src/app/api/upload/init/route'
import { POST as finalize } from '../src/app/api/upload/finalize/route'

process.env.AUTH_SECRET = 'validation-secret-at-least-32-characters'
process.env.UPLOAD_PASSPHRASE = 'test-contributors'
process.env.STORAGE_DRIVER = 'local'
process.env.APP_URL = 'http://localhost:3000'

function request(endpoint: string, body: object, passphrase = 'test-contributors') {
  return new NextRequest(`http://localhost:3000/api/upload/${endpoint}`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', 'x-contributor-passphrase': passphrase },
    body: JSON.stringify(body),
  })
}

after(async () => { await prisma.$disconnect() })

test('contributor endpoints reject curriculum and material uploads before creating records', { skip: process.env.CPYQ_INTEGRATION !== '1' }, async () => {
  for (const documentType of ['CURRICULUM', 'STUDY_MATERIAL']) {
    assert.equal((await init(request('init', { fileName: 'test.pdf', mimeType: 'application/pdf', fileSize: 20, documentType }))).status, 403)
    assert.equal((await finalize(request('finalize', { s3Key: 'uploads/submissions/test.pdf', uploadToken: 'test', documentType }))).status, 403)
  }
})

test('passphrase contributor queues a private paper without a Google session', { skip: process.env.CPYQ_INTEGRATION !== '1' }, async () => {
  assert.equal(new URL(process.env.DATABASE_URL!).pathname, '/cpyq_notes_validation')
  const course = await prisma.course.create({ data: { code: `CONTRIB${randomUUID().slice(0,8)}`, title: 'Contributor validation', credits: 0 } })
  let storedPath: string | undefined
  let fileId: string | undefined
  try {
    const body = { fileName: `${randomUUID()}.pdf`, mimeType: 'application/pdf', fileSize: 20, documentType: 'PYQ' }
    assert.equal((await init(request('init', body, 'incorrect'))).status, 403)
    const prepared = await init(request('init', body))
    assert.equal(prepared.status, 200)
    const upload = await prepared.json()
    assert.equal(new URL(upload.url, 'http://localhost:3000').searchParams.has('token'), false)
    storedPath = path.resolve('..', 'local_storage', upload.s3Key)
    await fs.mkdir(path.dirname(storedPath), { recursive: true })
    await fs.writeFile(storedPath, '%PDF-1.4\n%%EOF\n')
    const metadata = { ...upload, documentType: 'PYQ', courseId: course.id, examType: 'CAT1', year: 2024 }
    assert.equal((await finalize(request('finalize', { ...metadata, uploadToken: 'tampered' }))).status, 403)
    const queued = await finalize(request('finalize', metadata))
    assert.equal(queued.status, 200)
    const file = await prisma.file.findUniqueOrThrow({ where: { s3Key: upload.s3Key }, include: { papers: true, submissions: true, jobs: true } })
    fileId = file.id
    assert.equal(file.papers[0].publicationStatus, 'PROCESSING')
    assert.equal(file.papers[0].examType, 'CAT1')
    assert.equal(file.jobs[0].status, 'PENDING')
    assert.equal(file.submissions[0].contributorId, 'shared-passphrase')
  } finally {
    if (fileId) {
      await prisma.paper.deleteMany({ where: { fileId } })
      await prisma.submission.deleteMany({ where: { fileId } })
      await prisma.processingJob.deleteMany({ where: { fileId } })
      await prisma.file.delete({ where: { id: fileId } })
    }
    if (storedPath) await fs.unlink(storedPath).catch(() => {})
    await prisma.course.delete({ where: { id: course.id } })
  }
})
