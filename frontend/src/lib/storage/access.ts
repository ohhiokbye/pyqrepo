import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getS3ViewUrl } from '@/lib/storage'
import fs from 'fs/promises'
import path from 'path'

export async function serveStoredFile(request: NextRequest, segments: string[], crop: boolean) {
  if (!segments.length || segments.some((part) => !part || part === '.' || part === '..' || /[\\\x00]/.test(part))) return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  const joined = segments.join('/')
  const key = crop && !joined.startsWith('crops/') ? `crops/${joined}` : joined
  if (!key.startsWith(crop ? 'crops/' : 'uploads/')) return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  const types: Record<string, string> = crop ? { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' } : { '.pdf': 'application/pdf' }
  const contentType = types[path.extname(key).toLowerCase()]
  if (!contentType) return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
  if (!getSession(request)?.isAdmin) {
    const visible = crop
      ? await prisma.question.findFirst({ where: { imageCropS3Key: key, paper: { publicationStatus: 'AUTO_PUBLISHED' } }, select: { id: true } })
      : await prisma.paper.findFirst({ where: { file: { s3Key: key }, publicationStatus: 'AUTO_PUBLISHED' }, select: { id: true } })
    if (!visible) {
      const session = getSession(request)
      const material = !crop && session ? await prisma.studyMaterial.findFirst({ where: { file: { s3Key: key }, publicationStatus: 'AUTO_PUBLISHED' }, select: { id: true } }) : null
      if (!material) return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
  }
  const safeFileName = path.basename(key).replace(/[^a-zA-Z0-9._-]/g, '_')
  const disposition = crop ? 'inline' : `inline; filename="${safeFileName}"`
  const headers = {
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': disposition,
  }
  const url = getS3ViewUrl(key)
  if (url) return new NextResponse(null, { status: 307, headers: { ...headers, Location: url } })
  const base = path.resolve(process.cwd(), '..', 'local_storage')
  const full = await fs.realpath(path.resolve(base, key)).catch(() => null)
  if (!full || !full.startsWith(base + path.sep)) return NextResponse.json({ error: 'File not found' }, { status: 404 })
  return new NextResponse(await fs.readFile(full), { headers: { ...headers, 'Content-Type': contentType } })
}
