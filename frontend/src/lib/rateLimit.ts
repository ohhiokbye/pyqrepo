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
    // Bound memory even when callers present many fresh identifiers.
    if (buckets.size >= 10_000 && !buckets.has(key)) return false
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
  // @ts-expect-error ip property exists in some NextRequest runtimes
  if (req.ip) return req.ip
  const forwardedFor = process.env.VERCEL === '1' ? req.headers.get('x-vercel-forwarded-for') : process.env.TRUST_PROXY_HEADERS === '1' ? req.headers.get('x-forwarded-for') : null
  if (forwardedFor) {
    const parts = forwardedFor.split(',').map((p) => p.trim()).filter(Boolean)
    // The rightmost entry is appended by the immediate trusted reverse proxy, preventing client spoofing
    if (parts.length > 0) return parts[parts.length - 1]
  }
  return '127.0.0.1'
}
