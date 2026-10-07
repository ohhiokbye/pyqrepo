/** One-off cleanup explicitly authorized by the user. Retains courses and syllabi. */
import fs from 'node:fs/promises'
import path from 'node:path'
import { prisma } from '../frontend/src/lib/db'

async function main() {
  process.loadEnvFile('.env')
  const target = new URL(process.env.DATABASE_URL || '')
  if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.pathname !== '/cpyq') throw new Error('Refusing an unexpected database target')
  const root = path.resolve(process.cwd(), '..')
  const cutoff = new Date((await fs.stat(path.join(root, 'scripts/upgrade-existing-v1.sql'))).mtimeMs)
  const storageRoot = path.join(root, 'local_storage')
  const counts = async () => ({ courses: await prisma.course.count(), modules: await prisma.module.count(), topics: await prisma.topic.count(), syllabi: await prisma.syllabusVersion.count(), materials: await prisma.studyMaterial.count() })
  const before = await counts()
  const outcome = await prisma.$transaction(async (tx) => {
    const papers = await tx.paper.findMany({ where: { publicationStatus: 'RETRY_PENDING', file: { uploadedAt: { lte: cutoff } } }, include: { file: true, questions: { select: { imageCropS3Key: true } } } })
    const paperIds = papers.map((paper) => paper.id)
    const fileIds = [...new Set(papers.map((paper) => paper.fileId))]
    const cropKeys = papers.flatMap((paper) => paper.questions.map((question) => question.imageCropS3Key).filter((key): key is string => Boolean(key)))
    const removedQuestions = await tx.question.deleteMany({ where: { paperId: { in: paperIds } } })
    const removedPapers = await tx.paper.deleteMany({ where: { id: { in: paperIds } } })
    // Files shared with a syllabus, material, or retained paper remain intact.
    const unusedFiles = await tx.file.findMany({ where: { id: { in: fileIds }, syllabusVersions: { none: {} }, materials: { none: {} }, papers: { none: {} } }, select: { id: true, s3Key: true } })
    const unusedIds = unusedFiles.map((file) => file.id)
    const removedJobs = await tx.processingJob.deleteMany({ where: { fileId: { in: unusedIds } } })
    const removedSubmissions = await tx.submission.deleteMany({ where: { fileId: { in: unusedIds } } })
    await tx.file.deleteMany({ where: { id: { in: unusedIds } } })
    const after = { courses: await tx.course.count(), modules: await tx.module.count(), topics: await tx.topic.count(), syllabi: await tx.syllabusVersion.count(), materials: await tx.studyMaterial.count() }
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Preserved catalogue counts changed; rolling back')
    return { papers: removedPapers.count, questions: removedQuestions.count, jobs: removedJobs.count, submissions: removedSubmissions.count, originals: unusedFiles.map((file) => file.s3Key), cropKeys, preserved: after }
  }, { isolationLevel: 'Serializable', timeout: 60_000 })
  let deletedObjects = 0
  let missingObjects = 0
  const retainedObjects: string[] = []
  const failedObjects: string[] = []
  for (const key of new Set([...outcome.originals, ...outcome.cropKeys])) {
    if (await prisma.file.count({ where: { s3Key: key } }) || await prisma.question.count({ where: { imageCropS3Key: key } })) { retainedObjects.push(key); continue }
    if (!/^(?:uploads|crops)\//.test(key) || key.split('/').some((part) => !part || part === '..' || part === '.' || part.includes('\\'))) { failedObjects.push(key); continue }
    if (process.env.STORAGE_DRIVER !== 'local') { failedObjects.push(key); continue }
    try {
      const physical = await fs.realpath(path.resolve(storageRoot, key))
      if (!physical.startsWith(storageRoot + path.sep)) { failedObjects.push(key); continue }
      await fs.unlink(physical)
      deletedObjects++
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') missingObjects++
      else failedObjects.push(key)
    }
  }
  const result = { removed: { papers: outcome.papers, questions: outcome.questions, jobs: outcome.jobs, submissions: outcome.submissions, storedFiles: deletedObjects }, preserved: outcome.preserved, missingObjects, retainedSharedObjects: retainedObjects.length, failedObjects, remainingPapers: await prisma.paper.count(), remainingQuestions: await prisma.question.count() }
  await fs.writeFile('/tmp/cpyq-legacy-cleanup-result.json', JSON.stringify(result, null, 2), { mode: 0o600 })
  console.log(JSON.stringify(result, null, 2))
  if (failedObjects.length) throw new Error('Database cleanup succeeded; some unreferenced stored files could not be deleted')
}
main().catch((error) => { console.error(error instanceof Error ? error.message : 'Cleanup failed'); process.exitCode = 1 }).finally(async () => { await prisma.$disconnect() })
