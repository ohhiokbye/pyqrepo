import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024 // 50MB maximum payload
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.pptx', '.png', '.jpg', '.jpeg'])

// This endpoint is ONLY for local development to simulate S3 direct uploads
export async function PUT(req: NextRequest) {
  if (process.env.STORAGE_DRIVER === 's3') {
    return NextResponse.json({ error: 'Not available in S3 mode' }, { status: 403 })
  }

  const searchParams = req.nextUrl.searchParams
  const s3Key = searchParams.get('key')
  
  if (!s3Key) {
    return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 })
  }

  // Enforce base directory boundary and path traversal protection
  const baseDir = path.resolve(process.cwd(), '..', 'local_storage')
  const allowedPrefix = baseDir + path.sep
  const resolvedPath = path.resolve(baseDir, s3Key)

  if (!resolvedPath.startsWith(allowedPrefix)) {
    return NextResponse.json({ error: 'Forbidden: Path traversal detected' }, { status: 403 })
  }

  // Validate allowed file extensions
  const ext = path.extname(resolvedPath).toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: 'Invalid file extension' }, { status: 400 })
  }

  if (!req.body) {
    return NextResponse.json({ error: 'No body provided' }, { status: 400 })
  }

  // Ensure target directory exists
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true })

  const fileStream = fs.createWriteStream(resolvedPath)
  const webStream = req.body
  let totalBytes = 0

  try {
    const reader = webStream.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        totalBytes += value.byteLength
        if (totalBytes > MAX_UPLOAD_BYTES) {
          fileStream.destroy()
          if (fs.existsSync(resolvedPath)) {
            fs.unlinkSync(resolvedPath)
          }
          return NextResponse.json(
            { error: `File exceeds maximum allowed size of ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB` },
            { status: 413 }
          )
        }
        fileStream.write(Buffer.from(value))
      }
    }
    fileStream.end()
    return NextResponse.json({ success: true, key: s3Key })
  } catch (error) {
    fileStream.destroy()
    if (fs.existsSync(resolvedPath)) {
      try { fs.unlinkSync(resolvedPath) } catch { /* ignore */ }
    }
    console.error("Local upload failed", error)
    return NextResponse.json({ error: 'Upload processing failed' }, { status: 500 })
  }
}
