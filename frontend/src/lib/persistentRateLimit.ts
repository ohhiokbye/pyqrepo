import { createHash } from 'crypto'
import { prisma } from '@/lib/db'

/** Atomic shared limits work across serverless instances; raw identities are not stored. */
export async function checkPersistentRateLimit(scope: string, identity: string, limit: number, windowMs: number) {
  const key = createHash('sha256').update(`${scope}:${identity}`).digest('hex')
  const now = new Date()
  const expires = new Date(now.getTime() + windowMs)
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "ApiRateLimit" (key, count, "expiresAt") VALUES (${key}, 1, ${expires})
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN "ApiRateLimit"."expiresAt" <= ${now} THEN 1 ELSE "ApiRateLimit".count + 1 END,
      "expiresAt" = CASE WHEN "ApiRateLimit"."expiresAt" <= ${now} THEN ${expires} ELSE "ApiRateLimit"."expiresAt" END
    WHERE "ApiRateLimit"."expiresAt" <= ${now} OR "ApiRateLimit".count < ${limit}
    RETURNING count`
  // Expired identities need not accumulate on disk.
  await prisma.$executeRaw`DELETE FROM "ApiRateLimit" WHERE "expiresAt" < ${now}`
  return Boolean(rows.length)
}
