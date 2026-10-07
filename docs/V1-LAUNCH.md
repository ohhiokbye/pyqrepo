# CPYQ v1 launch

The Next.js frontend targets Vercel. The worker polls outbound from your PC; do not expose its port to the internet.

## Vercel and Supabase

1. Create a dedicated Supabase project and enable `vector`. Use the session pooler connection with `connection_limit=3` for `DATABASE_URL` in Vercel. Run migrations through the direct/session connection, not the transaction pooler. Keep this connection server-side.
2. For a **new empty database**, run `npx prisma migrate deploy` from `frontend/` with the target connection in the environment. The initial migration creates the schema; subsequent migrations add indexes, notes checkpoints/chunks, durable limits and RLS. Apply all migrations before running the current frontend. These tables have no PostgREST policies; only the server database role should access them. Do not blindly apply the initial migration to an existing populated database. Existing installations need a migration/baseline matching their actual schema and an audit of legacy publication statuses.
3. Import the repo in Vercel with **Root Directory `frontend`**. The build generates the Prisma client. Schema migrations are a separate release step, not a concurrent build action.
4. Set `STORAGE_DRIVER=s3`, `DATABASE_URL`, `APP_URL`, `AUTH_SECRET`, `UPLOAD_TOKEN_SECRET`, `ADMIN_EMAILS`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `WORKER_INTERNAL_KEY`, `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY`. Use separate random 32+ byte signing/internal secrets. Do not use `NEXT_PUBLIC_` for credentials. Optional temporary AWS credentials also need `AWS_SESSION_TOKEN`.
5. Configure Google OAuth with the exact production origin and callback `https://YOUR-APP/api/auth/google/callback`. `ADMIN_EMAILS` contains your Google email. Verify the OAuth consent screen allows intended student accounts, not only test users. Set `UPLOAD_PASSPHRASE` for trusted paper contributors and share `/upload`; they do not need Google accounts. This grants paper uploads only, while curricula and administration require an allowlisted Google session.
6. Students provide their own Gemini or Groq keys for the current page session. Configure `GEMINI_CHAT_MODEL` and `GROQ_CHAT_MODEL` server-side; owner ingestion keys belong on the laptop worker.

## Private S3 and budget

Create a bucket in the same region as the server where practical. Enable Block Public Access and default encryption. Grant narrowly scoped `s3:GetObject`, `s3:PutObject` on its `uploads/submissions/*` and `crops/*` namespaces; the worker needs the same object permissions. The app checks publication before issuing five-minute download URLs. Anyone already holding a signed URL can use it until expiration.

Replace the production origin in `deploy/s3-cors.json` and apply it to the bucket. Allow the `if-none-match` request header in CORS: new signed PUTs include `If-None-Match: *` and the declared content length to prevent overwrites. Only PDFs up to 25 MB are finalized. The server verifies the stored size before enqueueing; signed PUTs are still upload capabilities until they expire.

Before launch, deploy `deploy/aws-budget.yaml` with your alert email and monthly USD budget (default $5). It alerts at 80% actual and 100% forecasted spend; it does not stop spending. This template has been prepared, not deployed. Preserve source PDFs. Add orphan-crop cleanup only after checking database references: duplicate papers can legitimately share crop objects.

## Laptop worker and validation

Use the [lightweight setup guide](LIGHTWEIGHT-SETUP.md) for owner cloud keys, capability/quota checks, PDF extraction, queue leases, automatic publication, and database statistics. The worker no longer uses the old GPU, OCR, crop, or embedding pipeline. Historical GPU notes are retained only for reference.

Run one worker process without reload. No inbound worker port is required. Queue uploads continue while the laptop is offline. Use actual papers to verify numbering, printed marks, shared instructions, alternatives, source pages and pattern assignments before relying on trends. Google OAuth, Vercel timeouts, S3 signatures/CORS and AWS budget alerts still require verification in the configured accounts.

Syllabus versions preserve their own modules/topics. Statistics include only complete cloud-v2 analyses for the active syllabus. Reanalyse legacy papers after uploading an actual syllabus.
