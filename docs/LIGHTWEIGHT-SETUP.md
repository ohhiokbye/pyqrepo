# Lightweight tutor and cloud paper analysis

For the current notes pipeline, source retrieval, revision/practice modes and repeatable validation, see [notes tutor architecture](NOTES-TUTOR.md). The verification record below describes the earlier paper-ingestion rollout; the current checks and security limits are recorded in [the security review](../securityChanges.MD).

The existing Next.js / PostgreSQL / private storage stack remains. The outbound laptop worker uses Gemini PDF extraction and Groq page vision as fallback. No Paddle, PyTorch, CUDA, OpenCV, embedding models, or crop generation are required. Existing crops and vector columns remain readable.

## Start locally

```sh
python3 -m venv worker/venv
worker/venv/bin/pip install --no-cache-dir -r worker/requirements.txt
npm --prefix frontend install
cd frontend
npx prisma migrate deploy
npx prisma generate
npm run dev
```

In another terminal, from the repository root:

```sh
worker/venv/bin/uvicorn src.main:app --app-dir worker --host 127.0.0.1 --port 8000
```

Run only one worker process. Set `FRONTEND_URL` in `worker/.env` to the running frontend's actual port. The worker polls every 15 seconds, heartbeats its lease every minute, and uses the existing five-attempt bounded queue retries. Failed or incomplete documents stay private. Administration offers Retry and Reanalyse; `/upload` accepts replacement PDFs.

## Owner ingestion keys

Configure these in `worker/.env` (never in `NEXT_PUBLIC_` variables):

```dotenv
FRONTEND_URL=http://localhost:3000
WORKER_INTERNAL_KEY=<same secret as frontend>
INGESTION_GEMINI_API_KEY=<owner Gemini key>
GEMINI_EXTRACTION_MODEL=gemini-3.1-flash-lite
INGESTION_GROQ_API_KEY=<owner Groq key>
GROQ_VISION_MODEL=qwen/qwen3.8-27b
```

`GEMINI_API_KEY`, `GROQ_API_KEY`, and the existing `LLM_FALLBACK_API_KEY` remain compatible owner-key fallbacks. Explicit ingestion keys take priority. Student keys are never used to process the shared library.

Check capabilities and actual account quota during setup:

```sh
worker/venv/bin/python worker/src/check_cloud.py
```

This performs a small PDF-generation probe against Gemini and a small image-generation probe against Groq. It checks real generation permission/quota at that moment; it cannot guarantee future quota. Free tiers are preferred, but availability depends on the account and model. Missing keys or provider failures are reported by category without logging keys, response bodies, or authenticated URLs. Configure account spending limits in the provider consoles when appropriate.

For paper and curriculum extraction, Gemini receives the entire original PDF. Notes use the page-by-page native-text/vision path described in the notes guide. Small PDFs use inline data; larger PDFs use resumable binary upload in chunks matching the provider upload granularity to avoid large base64 requests on slow connections. Temporary provider files are deleted after extraction (provider expiry remains a fallback if cleanup fails). Temporary PyMuPDF page images are held in memory and discarded. The worker rejects encrypted PDFs and documents over 200 pages. Providers have bounded timeouts; provider truncation, unreadable pages, missing question inventory, unknown IDs, stale syllabus versions and invalid structures prevent publication.

Official sources: [Gemini Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite), [Gemini PDF processing](https://ai.google.dev/gemini-api/docs/document-processing), [Groq vision](https://console.groq.com/docs/vision), [Groq models](https://console.groq.com/docs/models).

## Student tutor

Google sign-in gates sending. The same opening shell is visible before sign-in. Students save a Gemini or Groq key in page memory; refresh, sign-out, or explicit removal clears it. No localStorage or server persistence is used. The tutor requires a student key and does not silently use the owner's ingestion key. Model names are configured server-side through `GEMINI_CHAT_MODEL` and `GROQ_CHAT_MODEL`; defaults are `gemini-3.1-flash-lite` and `openai/gpt-oss-20b`.

The opening screen uses the official [React Bits Aurora TypeScript/Tailwind registry component](https://reactbits.dev/r/Aurora-TS-TW.json) with `ogl`, loaded only in the client. Reduced motion, absent WebGL, and rendering failures retain the static background. The canvas is removed after submission. Assistant replies use `react-markdown` with HTML skipped. Provider failures remain outside the conversation, with an explicit retry action.

## Publication and statistics

Upload an actual course syllabus in administration first. A valid cloud extraction publishes it and activates its version. Paper extraction stores exact question text, printed marks, source pages, shared stems/instructions, parent totals, topic IDs and concept-plus-solution-task patterns. Existing patterns are supplied to the classifier for reuse. Exact repeats normalize case and whitespace; semantic patterns remain a separate measure. Topic and pattern IDs must belong to the analysed syllabus.

`GET /api/analysis?courseCode=BCSE302L&examType=CAT2&year=2025` requires a student session. `fromYear` and `toYear` are also supported. The same Postgres calculation is used in tutor grounding and administration.

- Frequency: distinct matching papers / all complete, unique, successfully analysed papers in scope and the active syllabus version.
- Question appearances, repeated patterns, exact text repeats and printed marks distributions remain separate.
- Multi-topic marks split equally only for aggregate topic marks and shares. Unmapped marks remain in the share denominator.
- Parent totals are retained in the printed distribution, but excluded from aggregate marks and appearances. Child marks remain unknown if not printed.
- Alternatives count as appearances. Printed marks sums are not attempted exam totals.
- Failed, incomplete, duplicate, legacy, or other-syllabus analyses do not enter the denominator.
- No eligible papers means insufficient data. Topics with zero matching papers are labelled not observed in uploaded papers only when eligible papers exist.

Legacy papers stay readable. Use Reanalyse after uploading a syllabus before including them in complete coverage statistics. Reanalysis replaces extracted question rows; original PDF and crop files are preserved. Pattern assignments are model judgements and require comparison with actual papers before relying on exam trends.

## Verification record

The additive migration was applied to the local database on 2026-10-06. The 7.6 GB environment was replaced with a roughly 134 MB environment. Obsolete Paddle and embedding model caches also freed about 475 MB, preserving unrelated models. The 594 MB Next build cache was removed; local review regenerates a smaller cache. Git history, uploads, configuration and pre-existing source edits were preserved.

A browser walkthrough verified desktop/mobile opening, sign-in gating, reduced-motion fallback, explicit action chips, focus, opening-to-chat, consecutive messages retaining keys, Markdown HTML suppression, provider errors outside history, New chat and refresh clearing keys. Tutor responses and the signed-in state were simulated during that UI walkthrough; Google OAuth and a live student-key conversation require account verification.

A temporary database fixture, rolled back afterward, verified unique-paper frequency, failed/legacy/duplicate exclusion, multi-topic mark allocation, parent totals, unknown marks, exact repeats, patterns, year filters and an unobserved topic.

The current local library has two legacy published papers for BCSE302L and no uploaded syllabus version. They correctly remain outside coverage statistics. Gemini model access and a small generation probe succeeded. No Groq ingestion key is configured, so the live fallback and its account quota remain unverified. The actual three-page camera-scanned CAT2 paper could not complete its upload on this connection: Python reported write timeouts for inline and binary upload, and an independent curl request also timed out. Actual scan accuracy and semantic grouping across the real papers therefore remain unverified. The original PDFs and existing publication records were preserved. Upload a real syllabus, configure the Groq owner key, and rerun processing from a working connection before relying on coverage statistics.

The final TypeScript check, targeted ESLint check, Python compilation, lightweight worker startup/health, dependency consistency and Git whitespace check passed. Live API checks verified authentication, insufficient-data handling, filter validation, student-key requirements and actual provider-key rejection without a canned answer. Temporary ingestion fixtures verified valid automatic publication, topic/pattern/source persistence, lease replay rejection, identical-file exclusion, pattern reuse, and incomplete/repeated/stale-syllabus quarantine; those fixtures were removed. At that earlier checkpoint no test suites were run. The subsequent notes/security implementation adds and runs the test suites described in the current security review.

Live Gemini verification also passed the full structured extraction schema on a small generated PDF, including source pages and printed marks. A separate live classifier request correctly reused an existing pattern ID for two synthetic wording variants testing the same concept and solution task. These checks verify provider/schema integration; they do not establish extraction accuracy or grouping quality on the actual scanned papers, whose uploads timed out.
