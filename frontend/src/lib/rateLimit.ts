import type { NextRequest } from 'next/server'

type Bucket = { count: number; windowStart: number }
const buckets = new Map<string, Bucket>()

/**
 * Simple in-memory sliding-window rate limiter. Good enough for a single-process
 * deployment; namespace `key` per call site (e.g. `upload-init:${ip}`) to keep
 * limits independent across endpoints.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()

  if (buckets.size > 1000) {
    for (const [k, bucket] of buckets) {
      if (now - bucket.windowStart > windowMs) buckets.delete(k)
    }
  }

  const bucket = buckets.get(key)
  if (!bucket || now - bucket.windowStart > windowMs) {
    buckets.set(key, { count: 1, windowStart: now })
    return true
  }
  if (bucket.count >= limit) return false
  bucket.count += 1
  return true
}

export function getClientIdentifier(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}
