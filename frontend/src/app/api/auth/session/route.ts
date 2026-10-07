import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const session = getSession(request)
  return NextResponse.json({ authenticated: Boolean(session), session }, { headers: { 'Cache-Control': 'private, no-store' } })
}
