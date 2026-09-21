import { NextRequest, NextResponse } from 'next/server'
import { storage } from '@/lib/storage'
import { z } from 'zod'
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit'

// The upload passphrase is a single shared secret with no lockout, so guard
// against brute-force guessing with a per-IP attempt limit.
const PASSPHRASE_ATTEMPT_LIMIT = 10
const PASSPHRASE_ATTEMPT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes

const uploadInitSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.enum([
    'application/pdf', 
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]),
  fileSize: z.number().positive(),
  documentType: z.enum(['PYQ', 'STUDY_MATERIAL']),
})

const MAX_PYQ_SIZE = 25 * 1024 * 1024 // 25MB
const MAX_STUDY_SIZE = 50 * 1024 * 1024 // 50MB

export async function POST(req: NextRequest) {
  if (!checkRateLimit(`upload-init:${getClientIdentifier(req)}`, PASSPHRASE_ATTEMPT_LIMIT, PASSPHRASE_ATTEMPT_WINDOW_MS)) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 })
  }

  // Authorization
  const authHeader = req.headers.get('authorization')
  const expectedPassphrase = process.env.UPLOAD_PASSPHRASE

  if (!expectedPassphrase || authHeader !== `Bearer ${expectedPassphrase}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const result = uploadInitSchema.safeParse(body)
    
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid payload', details: result.error.issues }, { status: 400 })
    }

    const { fileName, mimeType, fileSize, documentType } = result.data

    // Enforce size limits
    const maxSize = documentType === 'PYQ' ? MAX_PYQ_SIZE : MAX_STUDY_SIZE
    if (fileSize > maxSize) {
      return NextResponse.json({ 
        error: `File size exceeds the maximum allowed limit of ${maxSize / (1024 * 1024)}MB for ${documentType}` 
      }, { status: 400 })
    }

    const { url, s3Key } = await storage.generateUploadUrl(fileName, mimeType, fileSize)

    return NextResponse.json({ url, s3Key })
  } catch (error) {
    console.error("Upload init error", error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
