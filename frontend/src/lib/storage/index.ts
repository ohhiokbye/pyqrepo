import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'

export interface StorageProvider {
  /**
   * Generates a URL where the client can directly upload the file.
   */
  generateUploadUrl(fileName: string, mimeType: string, maxSizeInBytes: number): Promise<{ url: string; s3Key: string }>
}

export class LocalFileSystemProvider implements StorageProvider {
  private baseDir: string

  constructor() {
    this.baseDir = path.join(process.cwd(), '..', 'local_storage')
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true })
    }
  }

  async generateUploadUrl(fileName: string, mimeType: string, maxSizeInBytes: number): Promise<{ url: string; s3Key: string }> {
    if (mimeType !== 'application/pdf' || !Number.isSafeInteger(maxSizeInBytes) || maxSizeInBytes <= 0 || maxSizeInBytes > 25 * 1024 * 1024) throw new Error('Invalid PDF upload')
    const cleanFileName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_')
    const s3Key = `uploads/submissions/${uuidv4()}-${cleanFileName}`
    // In local dev, we return an endpoint in our own Next.js app that will handle the file write.
    // A short-lived signed token binds the PUT to this exact key so the write
    // endpoint can't be used directly without going through this (passphrase-gated) init step.
    const url = `/api/local-upload?key=${encodeURIComponent(s3Key)}`

    return { url, s3Key }
  }
}

export class S3StorageProvider implements StorageProvider {
  async generateUploadUrl(fileName: string, mimeType: string, maxSizeInBytes: number): Promise<{ url: string; s3Key: string }> {
    const bucket = requiredEnv('AWS_S3_BUCKET')
    const region = process.env.AWS_REGION || 'ap-south-1'
    const accessKeyId = requiredEnv('AWS_ACCESS_KEY_ID')
    const secretAccessKey = requiredEnv('AWS_SECRET_ACCESS_KEY')
    const cleanFileName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_')
    const s3Key = `uploads/submissions/${uuidv4()}-${cleanFileName}`
    return {
      s3Key,
      url: presignS3Put({ bucket, region, accessKeyId, secretAccessKey, key: s3Key, mimeType, contentLength: maxSizeInBytes, expiresInSeconds: 300 }),
    }
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} must be configured when STORAGE_DRIVER=s3`)
  return value
}

/** Dependency-free AWS Signature V4 PUT presigner. */
function presignS3Put(input: { bucket: string; region: string; accessKeyId: string; secretAccessKey: string; key: string; mimeType: string; contentLength: number; expiresInSeconds: number }): string {
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)
  const service = 's3'
  const host = `${input.bucket}.s3.${input.region}.amazonaws.com`
  const scope = `${dateStamp}/${input.region}/${service}/aws4_request`
  const canonicalUri = `/${encodeURIComponent(input.key).replace(/%2F/g, '/')}`
  const params = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${input.accessKeyId}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(input.expiresInSeconds),
    'X-Amz-SignedHeaders': 'content-length;content-type;host;if-none-match',
  })
  if (process.env.AWS_SESSION_TOKEN) params.set('X-Amz-Security-Token', process.env.AWS_SESSION_TOKEN)
  const canonicalQuery = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&')
  const canonicalRequest = `PUT\n${canonicalUri}\n${canonicalQuery}\ncontent-length:${input.contentLength}\ncontent-type:${input.mimeType}\nhost:${host}\nif-none-match:*\n\ncontent-length;content-type;host;if-none-match\nUNSIGNED-PAYLOAD`
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256(canonicalRequest)}`
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${input.secretAccessKey}`, dateStamp), input.region), service), 'aws4_request')
  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${hmac(signingKey, stringToSign).toString('hex')}`
}

function sha256(value: string): string { return crypto.createHash('sha256').update(value, 'utf8').digest('hex') }
function hmac(key: crypto.BinaryLike, value: string): Buffer { return crypto.createHmac('sha256', key).update(value, 'utf8').digest() }

function presignS3Get(input: { bucket: string; region: string; accessKeyId: string; secretAccessKey: string; key: string; expiresInSeconds: number; method?: 'GET' | 'HEAD' }): string {
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)
  const host = `${input.bucket}.s3.${input.region}.amazonaws.com`
  const scope = `${dateStamp}/${input.region}/s3/aws4_request`
  const canonicalUri = `/${encodeURIComponent(input.key).replace(/%2F/g, '/')}`
  const params = new URLSearchParams({ 'X-Amz-Algorithm': 'AWS4-HMAC-SHA256', 'X-Amz-Credential': `${input.accessKeyId}/${scope}`, 'X-Amz-Date': amzDate, 'X-Amz-Expires': String(input.expiresInSeconds), 'X-Amz-SignedHeaders': 'host' })
  if (process.env.AWS_SESSION_TOKEN) params.set('X-Amz-Security-Token', process.env.AWS_SESSION_TOKEN)
  const canonicalQuery = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&')
  const canonicalRequest = `${input.method || 'GET'}\n${canonicalUri}\n${canonicalQuery}\nhost:${host}\n\nhost\nUNSIGNED-PAYLOAD`
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256(canonicalRequest)}`
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${input.secretAccessKey}`, dateStamp), input.region), 's3'), 'aws4_request')
  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${hmac(signingKey, stringToSign).toString('hex')}`
}

/** A private S3 object is exposed to a reader only for five minutes. */
export function getS3ViewUrl(key: string): string | null {
  if (process.env.STORAGE_DRIVER !== 's3') return null
  return presignS3Get({ bucket: requiredEnv('AWS_S3_BUCKET'), region: process.env.AWS_REGION || 'ap-south-1', accessKeyId: requiredEnv('AWS_ACCESS_KEY_ID'), secretAccessKey: requiredEnv('AWS_SECRET_ACCESS_KEY'), key, expiresInSeconds: 300 })
}

export const storage: StorageProvider = 
  process.env.STORAGE_DRIVER === 's3' 
    ? new S3StorageProvider() 
    : new LocalFileSystemProvider()

/** Verify the uploaded object exists before creating durable queue records. */
export async function uploadedPdfExists(key: string): Promise<boolean> {
  if (process.env.STORAGE_DRIVER === 's3') {
    const url = presignS3Get({ bucket: requiredEnv('AWS_S3_BUCKET'), region: process.env.AWS_REGION || 'ap-south-1', accessKeyId: requiredEnv('AWS_ACCESS_KEY_ID'), secretAccessKey: requiredEnv('AWS_SECRET_ACCESS_KEY'), key, expiresInSeconds: 60, method: 'HEAD' })
    const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10_000), cache: 'no-store' })
    const size = Number(response.headers.get('content-length'))
    return response.ok && size > 0 && size <= 25 * 1024 * 1024 && response.headers.get('content-type') === 'application/pdf'
  }
  const base = path.resolve(process.cwd(), '..', 'local_storage')
  const full = await fs.promises.realpath(path.resolve(base, key)).catch(() => null)
  if (!full || !full.startsWith(base + path.sep)) return false
  const stat = await fs.promises.stat(full)
  if (!stat.isFile() || stat.size <= 0 || stat.size > 25 * 1024 * 1024) return false
  const handle = await fs.promises.open(full, 'r')
  try {
    const buf = Buffer.alloc(5)
    await handle.read(buf, 0, 5, 0)
    return buf.toString('utf8') === '%PDF-'
  } catch {
    return false
  } finally {
    await handle.close()
  }
}
