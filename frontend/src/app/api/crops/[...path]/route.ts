import { NextRequest, NextResponse } from 'next/server'
import { serveStoredFile } from '@/lib/storage/access'

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try { return await serveStoredFile(request, (await params).path, true) }
  catch { return NextResponse.json({ error: 'Could not serve file' }, { status: 500 }) }
}
