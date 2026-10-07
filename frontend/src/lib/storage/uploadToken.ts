import crypto from 'crypto'

// Short-lived signed token binding a local-upload PUT to the exact s3Key that
// /api/upload/init issued, so /api/local-upload can't be used to write
// arbitrary files without ever going through the passphrase-gated init step.
const TOKEN_TTL_MS = 15 * 60 * 1000 // 15 minutes

function getSecret(): string {
  return process.env.UPLOAD_TOKEN_SECRET || process.env.AUTH_SECRET || ''
}

export function signUploadKey(s3Key: string): string {
  const secret = getSecret()
  if (secret.length < 32) throw new Error('Upload signing secret must be at least 32 characters')
  const expiry = Date.now() + TOKEN_TTL_MS
  const signature = crypto.createHmac('sha256', secret).update(`${s3Key}.${expiry}`).digest('hex')
  return `${expiry}.${signature}`
}

export function verifyUploadToken(s3Key: string, token: string | null): boolean {
  const secret = getSecret()
  if (secret.length < 32 || !token || token.length > 200) return false

  const parts = token.split('.')
  if (parts.length !== 2) return false
  const [expiryPart, signature] = parts
  const expiry = Number(expiryPart)
  if (!Number.isSafeInteger(expiry) || !/^[a-f0-9]{64}$/.test(signature) || Date.now() > expiry || expiry > Date.now() + TOKEN_TTL_MS) return false

  const expectedSignature = crypto.createHmac('sha256', secret).update(`${s3Key}.${expiry}`).digest('hex')
  const provided = Buffer.from(signature)
  const expected = Buffer.from(expectedSignature)
  if (provided.length !== expected.length) return false

  return crypto.timingSafeEqual(provided, expected)
}
