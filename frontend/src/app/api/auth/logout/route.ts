import { NextRequest, NextResponse } from 'next/server'
import { verifyCsrfOrigin, SESSION_COOKIE } from '@/lib/auth'

export async function POST(req: NextRequest) {
  if (!verifyCsrfOrigin(req)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }
  const response = NextResponse.json({ success: true })
  response.cookies.delete(SESSION_COOKIE)
  response.cookies.delete('cpyq_session')
  response.cookies.delete('__Host-cpyq_session')
  return response
}
