'use client'

import { useState, useEffect } from 'react'

interface Course {
  id: string
  code: string
  title: string
  credits: number
}

export default function Home() {
  const [courses, setCourses] = useState<Course[]>([])
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [selectedCourseId, setSelectedCourseId] = useState<string>('')
  
  // Document Type selection: Theory Exam Paper (Scanned) vs Study Material (Notes/Slides)
  const [documentType, setDocumentType] = useState<'PYQ' | 'STUDY_MATERIAL'>('PYQ')
  
  // PYQ fields
  const [examType, setExamType] = useState<string>('CAT1')
  
  // Study Material fields
  const [materialTitle, setMaterialTitle] = useState<string>('')
  
  // Contributor authentication passphrase
  const [passphrase, setPassphrase] = useState<string>('')
  
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<string>('')
  const [errorDetails, setErrorDetails] = useState<string>('')
  const [loadingCourses, setLoadingCourses] = useState<boolean>(true)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  const loadCourses = async () => {
    try {
      setLoadingCourses(true)
      const res = await fetch('/api/courses')
      const data = await res.json()
      if (res.ok && data.courses && data.courses.length > 0) {
        setCourses(data.courses)
        setSelectedCourseId(data.courses[0].id)
      } else if (data.details || data.error) {
        setErrorDetails(data.details || data.error)
      }
    } catch (err: unknown) {
      console.error('Error fetching courses:', err)
      setErrorDetails(err instanceof Error ? err.message : String(err))
    } finally {
      setLoadingCourses(false)
    }
  }

  useEffect(() => {
    loadCourses()
    // Load previously remembered passphrase if available
    try {
      const savedPass = localStorage.getItem('cpyq_contributor_passphrase')
      if (savedPass) setPassphrase(savedPass)
    } catch {
      // localStorage may be restricted in some environments
    }
  }, [])

  const handlePassphraseChange = (val: string) => {
    setPassphrase(val)
    try {
      localStorage.setItem('cpyq_contributor_passphrase', val)
    } catch {
      // ignore
    }
  }

  const filteredCourses = courses.filter((c) =>
    `${c.code} ${c.title}`.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleUpload = async () => {
    if (!file) return
    if (!selectedCourseId) {
      setStatus('Please select a course.')
      return
    }
    if (!passphrase.trim()) {
      setStatus('Please enter the contributor passphrase.')
      return
    }
    if (documentType === 'STUDY_MATERIAL' && !materialTitle.trim()) {
      setStatus('Please enter a title for the study notes/slides.')
      return
    }

    setIsSubmitting(true)
    setStatus('1/3: Authorizing & initializing upload...')
    setErrorDetails('')
    
    try {
      // 1. Pre-flight API Call with contributor passphrase
      const initRes = await fetch('/api/upload/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${passphrase.trim()}`
        },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || 'application/pdf',
          fileSize: file.size,
          documentType
        })
      })

      if (!initRes.ok) {
        const err = await initRes.json().catch(() => ({}))
        if (initRes.status === 401) {
          throw new Error('Unauthorized: Incorrect contributor passphrase.')
        }
        throw new Error(err.error || err.details || `Upload init failed (${initRes.status})`)
      }
      
      const { url, s3Key } = await initRes.json()
      setStatus('2/3: Uploading directly to storage...')

      // 2. Direct Upload to Storage Provider
      const uploadRes = await fetch(url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type || 'application/pdf'
        }
      })

      if (!uploadRes.ok) {
        throw new Error(`Upload to storage failed with status ${uploadRes.status}`)
      }

      // 3. Finalize & Automatically Dispatch to Worker Pipeline
      setStatus('3/3: Registering document and triggering ingestion pipeline...')
      const finalizeRes = await fetch('/api/upload/finalize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${passphrase.trim()}`
        },
        body: JSON.stringify({
          s3Key,
          documentType,
          courseId: selectedCourseId,
          examType: documentType === 'PYQ' ? examType : undefined,
          title: documentType === 'STUDY_MATERIAL' ? materialTitle : undefined
        })
      })

      const finalizeData = await finalizeRes.json().catch(() => ({}))

      if (!finalizeRes.ok) {
        throw new Error(finalizeData.details || finalizeData.error || `Finalize failed (${finalizeRes.status})`)
      }
      
      setStatus(`✓ Upload Complete! Document registered (Job ID: ${finalizeData.jobId}). Processing pipeline triggered autonomously.`)
      setFile(null)
      setMaterialTitle('')
    } catch (e: unknown) {
      console.error('Upload error:', e)
      const msg = e instanceof Error ? e.message : String(e)
      setStatus(`Error: ${msg}`)
      setErrorDetails(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-neutral-900 text-neutral-100 p-6 md:p-12 font-sans flex flex-col justify-center items-center">
      <div className="w-full max-w-xl space-y-6">
        
        {/* Header */}
        <header className="text-center pb-2">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">Academic Intelligence Platform</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white">CPYQ Lib</h1>
          <p className="text-neutral-400 text-sm mt-1">Contributor Document Upload Portal</p>
        </header>

        {/* Error Alert */}
        {errorDetails && (
          <div className="p-4 bg-rose-950/70 border border-rose-800 text-rose-200 rounded-2xl text-xs font-mono break-all">
            <strong className="block text-rose-300 font-bold mb-1">Diagnostic Alert:</strong>
            {errorDetails}
          </div>
        )}

        {/* Upload Form Card */}
        <section className="bg-neutral-950 border border-neutral-800 p-8 rounded-3xl shadow-2xl space-y-6">
          
          {/* Document Type Selector Tabs */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
              Document Category
            </label>
            <div className="grid grid-cols-2 gap-2 p-1.5 bg-neutral-900 border border-neutral-800 rounded-xl">
              <button
                type="button"
                onClick={() => setDocumentType('PYQ')}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  documentType === 'PYQ'
                    ? 'bg-white text-neutral-950 shadow'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Question Paper (PYQ)
              </button>
              <button
                type="button"
                onClick={() => setDocumentType('STUDY_MATERIAL')}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  documentType === 'STUDY_MATERIAL'
                    ? 'bg-white text-neutral-950 shadow'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Study Material (Notes/PPT)
              </button>
            </div>
          </div>

          {/* Course Selector with Search */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Theory Course
              </label>
              <input
                type="text"
                placeholder="Filter courses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="text-xs bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1 text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-400"
              />
            </div>

            {loadingCourses ? (
              <div className="w-full p-3 text-sm text-neutral-500 bg-neutral-900 border border-neutral-800 rounded-xl animate-pulse">
                Loading official syllabus courses...
              </div>
            ) : filteredCourses.length > 0 ? (
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="w-full p-3.5 text-sm font-medium text-white bg-neutral-900 border border-neutral-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-400 cursor-pointer shadow-inner"
              >
                {filteredCourses.map((course) => (
                  <option key={course.id} value={course.id} className="bg-neutral-900 text-white py-1">
                    {course.code} — {course.title} ({course.credits} cr)
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-amber-400 p-2">No matching course found for &quot;{searchTerm}&quot;.</p>
            )}
          </div>

          {/* Conditional Field: Exam Type for PYQ */}
          {documentType === 'PYQ' ? (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
                Exam Type
              </label>
              <select
                value={examType}
                onChange={(e) => setExamType(e.target.value)}
                className="w-full p-3.5 text-sm font-medium text-white bg-neutral-900 border border-neutral-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-400 cursor-pointer shadow-inner"
              >
                <option value="CAT1" className="bg-neutral-900 text-white">CAT 1 (Continuous Assessment 1)</option>
                <option value="CAT2" className="bg-neutral-900 text-white">CAT 2 (Continuous Assessment 2)</option>
                <option value="FAT" className="bg-neutral-900 text-white">FAT (Final Assessment Test)</option>
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
                Document Title
              </label>
              <input
                type="text"
                placeholder="e.g. Module 3 Transactions Notes"
                value={materialTitle}
                onChange={(e) => setMaterialTitle(e.target.value)}
                className="w-full p-3.5 text-sm font-medium text-white bg-neutral-900 border border-neutral-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-400 shadow-inner"
              />
            </div>
          )}

          {/* File Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
              Select Document ({documentType === 'PYQ' ? 'Scanned PDF' : 'Digital PDF/PPTX'})
            </label>
            <input 
              type="file" 
              accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation" 
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-neutral-300 border border-neutral-700 rounded-xl cursor-pointer bg-neutral-900 focus:outline-none p-3 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-neutral-800 file:text-neutral-200 hover:file:bg-neutral-700" 
            />
            <span className="block text-xs text-neutral-500 mt-1.5">
              {documentType === 'PYQ'
                ? 'Processed automatically via Scanned Image OCR + Question Segmentation pipeline.'
                : 'Processed automatically via PyMuPDF Text Extractor.'}
            </span>
          </div>

          {/* Contributor Passphrase Input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
              Contributor Passphrase
            </label>
            <input
              type="password"
              placeholder="Enter your contributor passphrase..."
              value={passphrase}
              onChange={(e) => handlePassphraseChange(e.target.value)}
              className="w-full p-3.5 text-sm font-medium text-white bg-neutral-900 border border-neutral-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-400 shadow-inner"
            />
            <span className="block text-[11px] text-neutral-500 mt-1">Saved locally in your browser for convenience.</span>
          </div>

          {/* Submit button */}
          <button 
            onClick={handleUpload}
            disabled={!file || !selectedCourseId || isSubmitting}
            className="w-full py-4 bg-white text-neutral-950 font-bold text-sm tracking-wide rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-200 active:scale-[0.99] transition-all"
          >
            {isSubmitting ? 'Uploading & Dispatching...' : 'Upload Document'}
          </button>

          {/* Status message */}
          {status && (
            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
              <p className="text-xs font-mono text-neutral-200 leading-relaxed">{status}</p>
            </div>
          )}
        </section>

      </div>
    </main>
  )
}
