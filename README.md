# CPYQ paper library and tutor

Public exam papers and extracted questions, shared course notes, a Google-login student tutor with revision/practice modes, and a lightweight outbound cloud PDF ingestion worker. Private administration handles curricula, syllabus versions, uploads, processing outcomes, retries, and exam/year-scoped topic analytics.

Start with [notes tutor architecture and upgrade instructions](docs/NOTES-TUTOR.md) and [lightweight setup](docs/LIGHTWEIGHT-SETUP.md). See the [security review](securityChanges.MD) for verified checks and remaining limits. See [v1 hosting setup](docs/V1-LAUNCH.md) for Vercel, Supabase and private S3. Cloud credentials and real document benchmarks are still required before public launch.

For local development, start PostgreSQL with `docker compose up -d`, configure `.env` / `frontend/.env`, apply the schema, and run `npm run dev` from `frontend/`. Keep secrets out of source control. Production uses migrations and S3; local storage is development-only.

From the repository root, start the frontend and worker in separate terminals:

```bash
npm --prefix frontend run dev
```

```bash
worker/venv/bin/uvicorn src.main:app --app-dir worker --host 127.0.0.1 --port 8000
```

Keep the frontend running: the worker polls its job API every 15 seconds. If Next.js starts on another port, update `FRONTEND_URL` in `worker/.env` and restart the worker. `Poll unavailable (ConnectError)` means the frontend connection failed; it is not an extraction startup failure. Check worker health at `http://127.0.0.1:8000/health`. Owner ingestion keys and model settings are described in the lightweight setup guide.

## Upload access

Set `ADMIN_EMAILS` in `frontend/.env` to your Google email (comma-separated for multiple admins). Restart Next.js and reload `/admin`. Administrators manage curricula, processing and analytics through Google sign-in.

Set `UPLOAD_PASSPHRASE` in `frontend/.env` and share `/upload` plus the passphrase with paper contributors. They select the course, exam and optional year and upload a PDF without creating an account or signing in. The passphrase is sent in request headers and kept only in page memory. Contributors can upload question papers only; curricula, shared course notes and administration require an allowlisted Google session. Use the same environment settings in Vercel when publishing.
