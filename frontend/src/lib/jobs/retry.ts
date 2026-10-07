export const LEASE_MS = 5 * 60 * 1000
export const MAX_ATTEMPTS = 5
export function retryAt(attempt: number, now = Date.now()): Date | null {
  return attempt >= MAX_ATTEMPTS ? null : new Date(now + Math.min(24 * 60 * 60 * 1000, 60_000 * 2 ** Math.max(0, attempt - 1)))
}
