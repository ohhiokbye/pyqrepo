'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AdminAccessGate } from '@/components/admin/AdminAccessGate'

type Job = { id: string; status: string; stage: string | null; errorCategory: string | null; retryCount: number; nextRetryAt: string | null; qualityResult: { checks: Record<string, unknown>; questionCount: number } | null; attempts: { id: string; status: string; provider: string }[] }
type Submission = { id: string; file: { jobs: Job[]; papers: { course: { code: string }; examType: string }[]; syllabusVersions: { course: { code: string } }[]; materials: { title: string; course: { code: string } }[] } }
type Version = { id: string; version: number; status: string; modules: { id: string; name: string; topics: { topicName: string }[] }[]; course: { code: string; activeSyllabusVersionId: string | null } }
type Metrics = Awaited<ReturnType<typeof import('@/lib/examAnalysis').calculateExamAnalysis>>

async function readJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed. Try again.')
  return data as T
}
function Dashboard() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [versions, setVersions] = useState<Version[]>([])
  const [courses, setCourses] = useState<{ code: string; title: string }[]>([])
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [course, setCourse] = useState('')
  const [exam, setExam] = useState('')
  const [fromYear, setFromYear] = useState('')
  const [toYear, setToYear] = useState('')
  const [status, setStatus] = useState('Loading job outcomes and syllabus versions…')
  const [busy, setBusy] = useState(false)
  const reload = useCallback(async () => {
    try {
      const [jobs, syllabi, catalogue] = await Promise.all([readJson<{ submissions: Submission[] }>('/api/submissions'), readJson<{ versions: Version[] }>('/api/admin/syllabus'), readJson<{ courses: { code: string; title: string }[] }>('/api/courses')])
      setSubmissions(jobs.submissions); setVersions(syllabi.versions); setCourses(catalogue.courses); setStatus('')
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not load administration data.') }
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- loads server data after mount
  useEffect(() => { void reload() }, [reload])
  async function action(url: string, body: object) {
    setBusy(true)
    try { await readJson(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); await reload() }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Action failed.') }
    finally { setBusy(false) }
  }
  async function loadMetrics(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMetrics(null)
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries({ courseCode: course, examType: exam, fromYear, toYear })) if (value) params.set(key, value)
    try { setMetrics(await readJson<Metrics>(`/api/admin/analytics?${params}`)); setStatus('') }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Could not load analytics.') }
    finally { setBusy(false) }
  }
  const field = 'rounded-md border border-border bg-background p-2 text-sm'
  return <main className="mx-auto max-w-6xl space-y-8 p-4 sm:p-6">
    <header className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-2xl font-semibold">Library administration</h1><div className="flex gap-4"><Link href="/upload" className="underline">Upload PDF</Link><button onClick={() => void reload()} className="underline">Refresh outcomes</button></div></header>
    {status && <p role="status" className="rounded-md border border-border p-3 text-sm">{status}</p>}
    <section className="space-y-4"><h2 className="text-lg font-semibold">Processing jobs</h2><p className="text-sm text-muted-foreground">The latest 100 uploads. Failed extractions stay private; automatic retries stop after five attempts. Retry after correcting a worker or syllabus problem.</p>
      {!submissions.length && !status && <p>No uploads yet. Upload a curriculum, paper or course notes to start.</p>}
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Course / exam', 'Status', 'Attempts', 'Quality / outcome', 'Action'].map((label) => <th key={label} className="border-b p-2">{label}</th>)}</tr></thead><tbody>{submissions.flatMap((submission) => submission.file.jobs.map((job) => <tr key={job.id} className="align-top"><td className="border-b p-2">{submission.file.papers[0]?.course.code || submission.file.syllabusVersions[0]?.course.code || submission.file.materials[0]?.course.code}<br />{submission.file.papers[0]?.examType || submission.file.materials[0]?.title || 'Curriculum'}</td><td className="border-b p-2">{job.status}<p className="text-xs text-muted-foreground">{job.stage}</p>{job.nextRetryAt && job.status === 'RETRY_PENDING' && <p className="text-xs">Retry: {new Date(job.nextRetryAt).toLocaleString()}</p>}</td><td className="border-b p-2">{job.retryCount}<details><summary>History</summary>{job.attempts.map((attempt) => <p key={attempt.id}>{attempt.provider}: {attempt.status}</p>)}</details></td><td className="max-w-sm border-b p-2">{job.qualityResult && <details><summary>Structural checks · {job.qualityResult.questionCount} questions</summary><pre className="whitespace-pre-wrap break-words text-xs">{JSON.stringify(job.qualityResult.checks, null, 2)}</pre><p className="text-xs">These checks do not establish transcription accuracy.</p></details>}<p className="break-words">{job.errorCategory || 'No quality failures recorded'}</p></td><td className="border-b p-2">{['RETRY_PENDING', 'FAILED', 'AUTO_PUBLISHED', 'COMPLETED'].includes(job.status) && <button disabled={busy} className="rounded border px-3 py-1 disabled:opacity-50" onClick={() => void action('/api/admin/retry', { jobId: job.id, reanalyse: ['AUTO_PUBLISHED', 'COMPLETED'].includes(job.status) })}>{['AUTO_PUBLISHED', 'COMPLETED'].includes(job.status) ? 'Reanalyse' : 'Retry'}</button>}</td></tr>))}</tbody></table></div>
    </section>
    <section className="space-y-4"><h2 className="text-lg font-semibold">Syllabus versions</h2>{!versions.length && <p>No uploaded syllabus versions yet.</p>}<ul className="space-y-3">{versions.map((version) => <li key={version.id} className="rounded-md border border-border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span>{version.course.code} · v{version.version} · {version.status} {version.course.activeSyllabusVersionId === version.id ? '· Active' : ''}</span>{version.status === 'AUTO_PUBLISHED' && version.course.activeSyllabusVersionId !== version.id && <button disabled={busy} className="rounded border px-3 py-1" onClick={() => void action('/api/admin/syllabus', { versionId: version.id })}>Use this version</button>}</div><details className="mt-2 text-sm"><summary>Modules and topics</summary>{version.modules.map((module) => <p key={module.id} className="mt-2"><strong>{module.name}</strong>: {module.topics.map((topic) => topic.topicName).join('; ')}</p>)}</details></li>)}</ul></section>
    <section className="space-y-4"><h2 className="text-lg font-semibold">Topic marks and appearances</h2><form onSubmit={loadMetrics} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">Course<select className={field} value={course} onChange={(event) => setCourse(event.target.value)}><option value="">Choose a course</option>{courses.map((item) => <option key={item.code} value={item.code}>{item.code} — {item.title}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-sm">Exams<select className={field} value={exam} onChange={(event) => setExam(event.target.value)}>{[['','All exams'],['CAT1','CAT1'],['CAT2','CAT2'],['FAT','FAT']].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-sm">From year<input className={`${field} w-28`} type="number" min={2000} max={2100} value={fromYear} onChange={(event) => setFromYear(event.target.value)} /></label>
      <label className="flex flex-col gap-1 text-sm">To year<input className={`${field} w-28`} type="number" min={2000} max={2100} value={toYear} onChange={(event) => setToYear(event.target.value)} /></label>
      <button disabled={busy} className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">{busy ? 'Working…' : 'Calculate'}</button>
    </form><p className="text-xs text-muted-foreground">Complete cloud analyses for the active syllabus only. Failed, incomplete, legacy and duplicate-file uploads are excluded. Multi-topic aggregate marks split equally; printed alternatives are appearances, not attempted exam totals.</p>
    {metrics && <>
      <p className="text-sm">{metrics.paperCount} analysed papers · {metrics.questionAppearances} question appearances · {metrics.excludedPaperCount} excluded papers · {metrics.unknownMarksCount} appearances without printed marks.</p>
      {!metrics.paperCount ? <p>Insufficient data. Upload a syllabus and analyse papers for this scope. Use Reanalyse for legacy papers.</p> : <>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Topic', 'Module', 'Matching papers / all papers', 'Appearances', 'Allocated marks', 'Marks share'].map((label) => <th key={label} className="border-b p-2">{label}</th>)}</tr></thead><tbody>{metrics.topics.map((row) => <tr key={row.topicId}>{[row.topic, row.module, `${row.matchingPapers} / ${metrics.paperCount} (${(row.frequency * 100).toFixed(1)}%)`, row.appearances, row.allocatedMarks.toFixed(1), `${(row.markShare * 100).toFixed(1)}%`].map((value, index) => <td key={index} className="border-b p-2">{value}</td>)}</tr>)}</tbody></table></div>
        <p className="text-sm">Syllabus topics not observed in uploaded papers: {metrics.notObservedTopics.map((row) => row.topic).join('; ') || 'None in this scope'}.</p>
        <details><summary>Repeated question patterns ({metrics.repeatedPatterns.length})</summary><ul className="mt-2 space-y-2">{metrics.repeatedPatterns.map((row) => <li key={row.id}>{row.description} · {row.matchingPapers} papers · {row.appearances} appearances</li>)}</ul></details>
        <details><summary>Exact text repeats ({metrics.exactTextRepeats.length})</summary><ul className="mt-2 space-y-2">{metrics.exactTextRepeats.map((row) => <li key={row.textHash}>{row.text} · {row.matchingPapers} papers · {row.appearances} appearances</li>)}</ul></details>
        <details><summary>Printed marks distribution</summary><ul className="mt-2 space-y-2">{metrics.printedMarksDistribution.map((row) => <li key={`${row.marks}-${row.marksScope}`}>{row.marks} marks · {row.appearances} appearances{row.marksScope === 'PARENT_TOTAL' ? ' (parent totals; excluded from aggregate topic shares)' : ''}</li>)}</ul></details>
      </>}
    </>}
    </section>
  </main>
}
export default function AdminPage() { return <AdminAccessGate><Dashboard /></AdminAccessGate> }
