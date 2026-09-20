import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const ALLOWED_EXTENSIONS: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
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
    
    // Check local_storage directory
    const baseDir = path.resolve(process.cwd(), '..', 'local_storage')
    const allowedPrefix = baseDir + path.sep
    let fullPath = path.resolve(baseDir, safePath)

    // Also support prefix 'crops/' if already in segments
    if (!fs.existsSync(fullPath)) {
      fullPath = path.resolve(baseDir, 'crops', safePath)
    }

    // Strict boundary check: must start with baseDir + path.sep to prevent partial prefix match bypasses
    if (!fullPath.startsWith(allowedPrefix)) {
      return NextResponse.json({ error: 'Forbidden: Invalid path' }, { status: 403 })
    }

    // Validate extension against strict image allow-list
    const ext = path.extname(fullPath).toLowerCase()
    const contentType = ALLOWED_EXTENSIONS[ext]
    if (!contentType) {
      return NextResponse.json({ error: 'Invalid file type requested' }, { status: 400 })
    }

    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      return NextResponse.json({ error: 'Crop image not found' }, { status: 404 })
    }

    const fileBuffer = fs.readFileSync(fullPath)

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('Crop serve error:', error)
    return NextResponse.json({ error: 'Failed to serve crop image' }, { status: 500 })
  }
}
