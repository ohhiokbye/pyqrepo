import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { signUploadKey } from './uploadToken'

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
    const cleanFileName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_')
    const s3Key = `uploads/submissions/${uuidv4()}-${cleanFileName}`
    // In local dev, we return an endpoint in our own Next.js app that will handle the file write.
    // A short-lived signed token binds the PUT to this exact key so the write
    // endpoint can't be used directly without going through this (passphrase-gated) init step.
    const token = signUploadKey(s3Key)
    const url = `http://localhost:3000/api/local-upload?key=${encodeURIComponent(s3Key)}&token=${encodeURIComponent(token)}`

    return { url, s3Key }
  }
}

export class S3StorageProvider implements StorageProvider {
  async generateUploadUrl(fileName: string, mimeType: string, maxSizeInBytes: number): Promise<{ url: string; s3Key: string }> {
    // To be implemented using AWS SDK (S3 Presigned URLs)
    throw new Error('S3 provider not implemented yet.')
  }
}

export const storage: StorageProvider = 
  process.env.STORAGE_DRIVER === 's3' 
    ? new S3StorageProvider() 
    : new LocalFileSystemProvider()
