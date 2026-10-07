import { NextResponse } from 'next/server'
import { RequestBodyError } from './requestBody'

/**
 * Logs the error category server-side and returns a generic, safe message to the
 * client. Never forward `error.message` / stack traces in the response body —
 * they can leak Prisma query internals or file-system paths to callers.
 */
export function apiError(logLabel: string, error: unknown, userMessage: string, status = 500) {
  if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status })
  // Provider errors can contain authenticated URLs or headers. Log categories only.
  console.error(logLabel, { category: error instanceof Error ? error.name : 'Unknown' })
  return NextResponse.json({ error: userMessage }, { status })
}
