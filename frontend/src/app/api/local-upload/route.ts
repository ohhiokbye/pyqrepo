import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

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

  const baseDir = path.join(process.cwd(), '..', 'local_storage')
  // Prevent directory traversal attacks
  const normalizedS3Key = path.normalize(s3Key).replace(/^(\.\.(\/|\\|$))+/, '')
  const filePath = path.join(baseDir, normalizedS3Key)

  // Ensure directory exists
  fs.mkdirSync(path.dirname(filePath), { recursive: true })

  if (!req.body) {
    return NextResponse.json({ error: 'No body provided' }, { status: 400 })
  }

  const fileStream = fs.createWriteStream(filePath)
  const webStream = req.body

  try {
    const reader = webStream.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        fileStream.write(Buffer.from(value))
      }
    }
    fileStream.end()
    return NextResponse.json({ success: true, key: normalizedS3Key })
  } catch (error) {
    console.error("Local upload failed", error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
