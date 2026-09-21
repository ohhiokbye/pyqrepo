import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Serves original uploaded documents (not crops - see /api/crops for those).
const ALLOWED_EXTENSIONS: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: segments } = await params
    if (!segments || segments.length === 0) {
      return NextResponse.json({ error: 'Missing file path' }, { status: 400 })
    }

    const joinedPath = segments.join('/')
    // Prevent path traversal
    const safePath = path.normalize(joinedPath).replace(/^(\.\.(\/|\\|$))+/, '')

    // Only originals under uploads/ are servable here (crops live under crops/, served elsewhere)
    if (!safePath.startsWith('uploads/')) {
      return NextResponse.json({ error: 'Forbidden: Invalid path' }, { status: 403 })
    }

    const baseDir = path.resolve(process.cwd(), '..', 'local_storage')
    const allowedPrefix = baseDir + path.sep
    const fullPath = path.resolve(baseDir, safePath)

    // Strict boundary check: must start with baseDir + path.sep to prevent partial prefix match bypasses
    if (!fullPath.startsWith(allowedPrefix)) {
      return NextResponse.json({ error: 'Forbidden: Invalid path' }, { status: 403 })
    }

    const ext = path.extname(fullPath).toLowerCase()
    const contentType = ALLOWED_EXTENSIONS[ext]
    if (!contentType) {
      return NextResponse.json({ error: 'Invalid file type requested' }, { status: 400 })
    }

    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const fileBuffer = fs.readFileSync(fullPath)

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${path.basename(fullPath)}"`,
        'Cache-Control': 'public, max-age=86400, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('File serve error:', error)
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 })
  }
}
