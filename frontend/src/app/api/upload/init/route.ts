import { signUploadKey } from '@/lib/storage/uploadToken'
import { requireUploadAccess } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { storage } from '@/lib/storage'
import { z } from 'zod'
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit'
import { apiError } from '@/lib/apiError'
import { checkPersistentRateLimit } from '@/lib/persistentRateLimit'
import { readJsonBody } from '@/lib/requestBody'

// The upload passphrase is a single shared secret with no lockout, so guard
// against brute-force guessing with a per-IP attempt limit.
const PASSPHRASE_ATTEMPT_LIMIT = 10
const PASSPHRASE_ATTEMPT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes

const uploadInitSchema = z.object({
  fileName: z.string().min(1).max(200).regex(/\.pdf$/i),
  mimeType: z.literal('application/pdf'),
  fileSize: z.number().int().positive(),
  documentType: z.enum(['PYQ', 'STUDY_MATERIAL', 'CURRICULUM']),
})

const MAX_PYQ_SIZE = 25 * 1024 * 1024 // 25MB
const MAX_STUDY_SIZE = 25 * 1024 * 1024

export async function POST(req: NextRequest) {
  if (!checkRateLimit(`upload-init:${getClientIdentifier(req)}`, PASSPHRASE_ATTEMPT_LIMIT, PASSPHRASE_ATTEMPT_WINDOW_MS)) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 })
  }

  try {
    if (!await checkPersistentRateLimit('upload-init', getClientIdentifier(req), PASSPHRASE_ATTEMPT_LIMIT, PASSPHRASE_ATTEMPT_WINDOW_MS)) return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 })
    const uploader = requireUploadAccess(req)
    if (uploader instanceof NextResponse) return uploader
    const body = await readJsonBody(req)
    const result = uploadInitSchema.safeParse(body)
    
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid payload', details: result.error.issues }, { status: 400 })
    }

    const { fileName, mimeType, fileSize, documentType } = result.data
    if (!uploader.isAdmin && documentType !== 'PYQ') return NextResponse.json({ error: 'Contributor access allows question papers only.' }, { status: 403 })

    // Enforce size limits
    const maxSize = documentType === 'PYQ' ? MAX_PYQ_SIZE : MAX_STUDY_SIZE
    if (fileSize > maxSize) {
      return NextResponse.json({ 
        error: `File size exceeds the maximum allowed limit of ${maxSize / (1024 * 1024)}MB for ${documentType}` 
      }, { status: 400 })
    }

    const { url, s3Key } = await storage.generateUploadUrl(fileName, mimeType, fileSize)

    return NextResponse.json({ url, s3Key, uploadToken: signUploadKey(s3Key) })
  } catch (error) {
    return apiError('Upload init error:', error, 'Internal server error')
  }
}
