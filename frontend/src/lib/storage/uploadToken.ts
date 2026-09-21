import crypto from 'crypto'

// Short-lived signed token binding a local-upload PUT to the exact s3Key that
// /api/upload/init issued, so /api/local-upload can't be used to write
// arbitrary files without ever going through the passphrase-gated init step.
const TOKEN_TTL_MS = 15 * 60 * 1000 // 15 minutes

function getSecret(): string {
  return process.env.UPLOAD_TOKEN_SECRET || process.env.UPLOAD_PASSPHRASE || ''
}

export function signUploadKey(s3Key: string): string {
  const secret = getSecret()
  const expiry = Date.now() + TOKEN_TTL_MS
  const signature = crypto.createHmac('sha256', secret).update(`${s3Key}.${expiry}`).digest('hex')
  return `${expiry}.${signature}`
}

export function verifyUploadToken(s3Key: string, token: string | null): boolean {
  const secret = getSecret()
  if (!secret || !token) return false

  const [expiryPart, signature] = token.split('.')
  const expiry = Number(expiryPart)
  if (!expiry || !signature || Date.now() > expiry) return false

  const expectedSignature = crypto.createHmac('sha256', secret).update(`${s3Key}.${expiry}`).digest('hex')
  const provided = Buffer.from(signature)
  const expected = Buffer.from(expectedSignature)
  if (provided.length !== expected.length) return false

  return crypto.timingSafeEqual(provided, expected)
}
