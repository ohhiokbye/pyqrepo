import { NextResponse } from 'next/server'

/**
 * Logs the full error server-side and returns a generic, safe message to the
 * client. Never forward `error.message` / stack traces in the response body —
 * they can leak Prisma query internals or file-system paths to callers.
 */
export function apiError(logLabel: string, error: unknown, userMessage: string, status = 500) {
  console.error(logLabel, error)
  return NextResponse.json({ error: userMessage }, { status })
}
