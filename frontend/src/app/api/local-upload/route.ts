import { NextRequest, NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { verifyUploadToken } from '@/lib/storage/uploadToken'

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

export async function PUT(req: NextRequest) {
  if (process.env.NODE_ENV === 'production' || process.env.STORAGE_DRIVER === 's3') return NextResponse.json({ error: 'Local uploads are development-only' }, { status: 403 })
  const key = req.nextUrl.searchParams.get('key') || ''
  if (!/^uploads\/submissions\/[a-zA-Z0-9._-]+\.pdf$/i.test(key)) return NextResponse.json({ error: 'Invalid PDF key' }, { status: 400 })
  if (!verifyUploadToken(key, req.headers.get('x-upload-token'))) return NextResponse.json({ error: 'Unauthorized or expired upload token' }, { status: 401 })
  if (!req.body) return NextResponse.json({ error: 'PDF body required' }, { status: 400 })
  if (Number(req.headers.get('content-length')) > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'PDF exceeds 25 MB' }, { status: 413 })
  const base = path.resolve(process.cwd(), '..', 'local_storage')
  const parent = path.resolve(base, 'uploads/submissions')
  const destination = path.resolve(base, key)
  let temporary: string | undefined
  let handle: Awaited<ReturnType<typeof fs.open>> | undefined
  const reader = req.body.getReader()
  try {
    await fs.mkdir(parent, { recursive: true })
    if (await fs.realpath(parent) !== parent || await fs.realpath(base) !== base) return NextResponse.json({ error: 'Invalid storage directory' }, { status: 403 })
    temporary = path.join(parent, `.upload-${randomUUID()}`)
    handle = await fs.open(temporary, 'wx', 0o600)
    let size = 0
    let header = Buffer.alloc(0)
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'PDF exceeds 25 MB' }, { status: 413 })
      if (header.length < 5) header = Buffer.concat([header, Buffer.from(value).subarray(0, 5 - header.length)])
      if (header.length === 5 && header.toString('ascii') !== '%PDF-') return NextResponse.json({ error: 'Invalid PDF content' }, { status: 400 })
      await handle.writeFile(value)
    }
    if (size < 5 || header.toString('ascii') !== '%PDF-') return NextResponse.json({ error: 'Invalid PDF content' }, { status: 400 })
    await handle.close(); handle = undefined
    // Atomic write-once publication; replay cannot replace an existing PDF.
    await fs.link(temporary, destination)
    return NextResponse.json({ success: true, key })
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    return NextResponse.json({ error: code === 'EEXIST' ? 'PDF already uploaded. Prepare a new upload.' : 'Upload processing failed' }, { status: code === 'EEXIST' ? 409 : 500 })
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
    await handle?.close().catch(() => {})
    if (temporary) await fs.unlink(temporary).catch(() => {})
  }
}
