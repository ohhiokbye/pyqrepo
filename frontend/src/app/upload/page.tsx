'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

type Course = { id: string; code: string; title: string }

function UploadForm() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingAccess, setCheckingAccess] = useState(true)
  const [passphrase, setPassphrase] = useState('')
  const [courses, setCourses] = useState<Course[]>([])
  const [courseId, setCourseId] = useState('')
  const [documentType, setDocumentType] = useState<'PYQ' | 'CURRICULUM' | 'STUDY_MATERIAL'>('PYQ')
  const [title, setTitle] = useState('')
  const [courseCode, setCourseCode] = useState('')
  const [courseTitle, setCourseTitle] = useState('')
  const [examType, setExamType] = useState('CAT1')
  const [year, setYear] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    fetch('/api/auth/session').then((res) => { if (!res.ok) throw new Error(); return res.json() }).then((data) => setIsAdmin(Boolean(data.session?.isAdmin))).catch(() => setIsAdmin(false)).finally(() => setCheckingAccess(false))
    try { localStorage.removeItem('cpyq_contributor_passphrase') } catch { /* restricted browser */ }
    fetch('/api/courses').then((res) => { if (!res.ok) throw new Error('Could not load courses. Reload to try again.'); return res.json() }).then((data) => { setCourses(data.courses); setCourseId(data.courses[0]?.id || '') }).catch((error) => setStatus(error.message)).finally(() => setLoading(false))
  }, [])
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file) return
    if (file.size > 25 * 1024 * 1024 || !file.name.toLowerCase().endsWith('.pdf')) { setStatus('Choose a PDF of at most 25 MB.'); return }
    setBusy(true)
    const form = event.currentTarget
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (!isAdmin) headers['X-Contributor-Passphrase'] = passphrase
      setStatus('Preparing upload…')
      const init = await fetch('/api/upload/init', { method: 'POST', headers, body: JSON.stringify({ fileName: file.name, mimeType: 'application/pdf', fileSize: file.size, documentType }) })
      const data = await init.json()
      if (!init.ok) throw new Error(data.error || 'Could not prepare upload.')
      setStatus('Uploading PDF…')
      const storageHeaders: Record<string, string> = { 'Content-Type': 'application/pdf' }
      if (data.url.startsWith('/api/local-upload?')) storageHeaders['X-Upload-Token'] = data.uploadToken
      else storageHeaders['If-None-Match'] = '*'
      const stored = await fetch(data.url, { method: 'PUT', headers: storageHeaders, body: file })
      if (!stored.ok) throw new Error('PDF upload failed. Try again.')
      setStatus('Adding document to the processing queue…')
      const finalize = await fetch('/api/upload/finalize', { method: 'POST', headers, body: JSON.stringify({ s3Key: data.s3Key, uploadToken: data.uploadToken, documentType, ...(documentType === 'CURRICULUM' ? { courseCode, courseTitle } : documentType === 'STUDY_MATERIAL' ? { courseId, title } : { courseId, examType, ...(year ? { year: Number(year) } : {}) }) }) })
      const result = await finalize.json()
      if (!finalize.ok) throw new Error(result.error || 'Could not queue document.')
      setStatus(`Queued successfully. Job: ${result.jobId}. Processing starts when the worker is online.`)
      setFile(null)
      const fileInput = form.elements.namedItem('pdf')
      if (fileInput instanceof HTMLInputElement) fileInput.value = ''
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Upload failed. Try again.') }
    finally { setBusy(false) }
  }
  const inputClass = 'w-full rounded-md border border-border bg-background p-2 text-sm'
  return <main className="mx-auto max-w-xl space-y-6 p-6">
    <header><h1 className="text-2xl font-semibold">Upload to the library</h1><p className="mt-2 text-sm text-muted-foreground">Passing documents publish automatically. Failed extractions stay private and retry later.</p>{isAdmin && <Link className="mt-2 inline-block underline" href="/admin">Inspect jobs and analytics</Link>}</header>
    {checkingAccess ? <p role="status">Checking upload access…</p> : <>
    <form onSubmit={upload} className="space-y-5">
      {!isAdmin && <label className="block space-y-2"><span>Upload passphrase</span><input className={inputClass} type="password" required autoComplete="off" maxLength={1024} value={passphrase} onChange={(event) => setPassphrase(event.target.value)} /><span className="block text-xs text-muted-foreground">Use the passphrase shared with you. Google sign-in is not required to upload papers.</span></label>}
      {isAdmin && <label className="block space-y-2"><span>Document type</span><select className={inputClass} value={documentType} onChange={(event) => setDocumentType(event.target.value as typeof documentType)}><option value="PYQ">Question paper</option><option value="CURRICULUM">Curriculum</option><option value="STUDY_MATERIAL">Course notes / answer key</option></select></label>}
      {documentType === 'CURRICULUM' ? <>
        <label className="block space-y-2"><span>Course code</span><input className={inputClass} required minLength={2} maxLength={20} value={courseCode} onChange={(event) => setCourseCode(event.target.value.toUpperCase())} /></label>
        <label className="block space-y-2"><span>Course title</span><input className={inputClass} required minLength={2} maxLength={200} value={courseTitle} onChange={(event) => setCourseTitle(event.target.value)} /></label>
      </> : <>
        <label className="block space-y-2"><span>Course</span><select aria-label="Course" className={inputClass} required disabled={loading} value={courseId} onChange={(event) => setCourseId(event.target.value)}>{loading && <option value="">Loading courses…</option>}{courses.map((course) => <option key={course.id} value={course.id}>{course.code} — {course.title}</option>)}</select></label>
        {!loading && !courses.length && <p className="text-sm">Upload a curriculum first to create a course.</p>}
        {documentType === 'STUDY_MATERIAL' ? <label className="block space-y-2"><span>Notes title</span><input className={inputClass} required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} /></label> : <><label className="block space-y-2"><span>Exam</span><select className={inputClass} value={examType} onChange={(event) => setExamType(event.target.value)}>{['CAT1', 'CAT2', 'FAT'].map((exam) => <option key={exam}>{exam}</option>)}</select></label>
        <label className="block space-y-2"><span>Year (optional)</span><input className={inputClass} type="number" min={2000} max={2100} value={year} onChange={(event) => setYear(event.target.value)} /><span className="block text-xs text-muted-foreground">The worker detects the printed year and quarantines conflicting values.</span></label></>}
      </>}
      <label className="block space-y-2"><span>English PDF (up to 25 MB)</span><input name="pdf" className={inputClass} type="file" required accept=".pdf,application/pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
      <button className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50" disabled={busy || !file || (!isAdmin && !passphrase.trim()) || (documentType !== 'CURRICULUM' && !courseId)}>{busy ? 'Uploading…' : 'Upload PDF'}</button>
      {status && <p role="status" className="break-words rounded-md border border-border p-3 text-sm">{status}</p>}
    </form>
    </>}
  </main>
}
export default function UploadPage() { return <UploadForm /> }
