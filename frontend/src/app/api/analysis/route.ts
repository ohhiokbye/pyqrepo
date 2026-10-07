import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { analysisFiltersSchema, calculateExamAnalysis } from '@/lib/examAnalysis'
import { apiError } from '@/lib/apiError'

export async function GET(req: NextRequest) {
  const session = requireUser(req)
  if (session instanceof NextResponse) return session
  const parsed = analysisFiltersSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) return NextResponse.json({ error: 'Choose a course and valid exam/year filters.' }, { status: 400 })
  try { return NextResponse.json(await calculateExamAnalysis(parsed.data), { headers: { 'Cache-Control': 'no-store' } }) }
  catch (error) { return apiError('Exam analysis failed', error, 'Could not calculate exam statistics. Please retry.') }
}
