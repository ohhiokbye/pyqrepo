# Security review — 2026-10-07

The working tree has passed the checks below and is ready for the owner to review, commit and push. No staging, commit or push was performed. Existing user edits were preserved. This is a source/dependency review and local test record, not a claim that every vulnerability has been eliminated or that production accounts have been penetration tested.

## Implemented protections

- Google OAuth state and nonce binding; signed ID-token verification with cached Google public keys, RS256 only, expected audience/issuer, expiration and verified email. Production sessions use HTTP-only, Secure, SameSite cookies with the `__Host-` prefix and no legacy-cookie fallback. Malformed signatures and unequal UTF-8 byte lengths fail without exceptions. Signing secrets require at least 32 characters.
- User mutations enforce same-origin checks, including rejecting missing origin/referer in production. Administration uses the server-side email allowlist. Shared-passphrase contributors cannot upload curricula/notes or access administration. Worker endpoints require the internal secret, and checkpoints/context/results require an active job lease.
- Bounded streaming JSON bodies and validated identifiers; PDF upload size limits, header tokens, scoped paths and signed object names. Local uploads reject symlink paths, use exclusive temporary files, clean failed writes and publish atomically without overwrite. Worker storage resolves real paths and blocks escapes. Production disables local upload storage.
- S3 PUT signatures include declared content length and `If-None-Match: *`; private downloads require publication/access checks before short-lived signed URLs are issued. Draft notes remain private, published shared notes require a student session, and anonymous clients cannot read them.
- Durable PostgreSQL tutor/upload limits survive server restarts and multiple instances. Identities are hashed in rate-limit rows. Proxy headers are trusted only on the configured trusted deployment path; fallback limits are shared when a client address is unavailable. Production proxies must overwrite forwarding headers.
- Ingestion rejects incomplete/truncated/schema-invalid extraction, incorrect syllabus memberships and stale lease results. Per-page notes checkpoints are hash/version bound; published chunks are replaced atomically only after complete-page validation.
- Tutor Markdown ignores HTML and suppresses remote images/arbitrary links. Citations use server-provided source URLs; unavailable source numbers and truncated replies fail. Reference text is marked untrusted in the system prompt. Student keys remain in page memory and are not persisted. Provider endpoints are fixed, redirects are rejected and provider errors are logged by category without keys, response bodies or authenticated URLs.
- Production CSP excludes `unsafe-eval`, prohibits objects and framing, and sets a restrictive base/form origin. Standard transport, MIME and referrer headers are present.
- RLS is enabled on notes pages/chunks, rate-limit rows and the previously missing QuestionPattern table. New private tables have no client-access policies. Prisma uses the server database role; that role must never be exposed to browsers.
- Environment files, local uploads, environments, builds and AWS credential folders are ignored. The secret checker scans commit candidates and local Git history without exposing matched values. It detects common provider tokens, private-key markers and database credential URLs; it is a pattern check, not exhaustive secret discovery.

## Dependencies

The npm audit initially reported high-severity dependency findings. The unpatched `braces` dependency chain was removed by replacing the Next lint preset with directly configured TypeScript, React, Hooks and accessibility plugins. Patched `deepmerge-ts`, `sharp` and `source-map-js` versions are enforced by overrides. The small dependency-free `jose` library supplies JWT verification. The npm lockfile records the resulting dependency tree; worker runtime remains seven direct dependencies with no local ML stack.

At verification time, `npm audit` (including development dependencies) and `pip-audit` on the installed worker environment reported **zero known vulnerabilities**. These results are advisory snapshots; CI audits future installs. Worker requirements use version ranges, so a fresh install can resolve differently from this checked environment.

## Verification

- 20 Node tests passed with no skips, including real PostgreSQL fixtures for claim races, stale leases, checkpoint reuse, incomplete publication, course/source scoping, older-paper retrieval, private file access, durable limiter concurrency and RLS. Provider responses are mocked in tutor tests.
- 32 Python tests passed, including native-PDF extraction, vision/schema failure handling, checkpoint reuse/hash changes, quota backoff, topic membership and storage path attacks. Cloud provider responses are mocked.
- Browser walkthroughs at 375 px and 1280 px passed notes upload, revision minutes/evidence, source links, consecutive-message key retention, refresh clearing keys, absence of key persistence, no horizontal overflow and no browser runtime errors. Google session, provider and storage responses were mocked.
- TypeScript, full ESLint, the Webpack production build, dependency consistency and Git whitespace checks passed. The fresh validation database and existing local app database both accepted the migrations; no app records were replaced.
- Secret-pattern scanning of candidate files and local history found no matches. Real `.env` files, local PDFs and installed environments are ignored. No credentials were included in this report.

## Remaining deployment and accuracy limits

Live Google sign-in, production S3 CORS/signatures, hosting behavior, provider quota and real scanned-document accuracy must still be checked in the configured accounts. The supplied S3 CORS change must accompany deployment. A published signed URL remains usable by its holder until expiry.

CSP still permits inline scripts/styles for the existing Next rendering setup. Markdown restrictions mitigate generated-content injection, but a nonce/hash CSP would provide stronger defense in depth and needs a separate rendering/deployment change. Sessions are signed stateless cookies without an individual revocation store; rotate the signing secret to invalidate all sessions, and use short configured lifetimes if requirements change. The existing seven-day maximum and 24-hour idle-age bound remain.

PDF parsing occurs in the local worker. Keep that worker unprivileged and its dependencies current; schema/size/render checks do not provide process isolation against an unknown native-parser vulnerability. Leaked contributor passphrases permit bounded paper submissions; rotate them when membership changes.

AI prompt injection and semantic hallucinations cannot be eliminated by prompts or valid citation numbers. The broad tutor behavior permits general explanations when evidence is missing. Historical statistics come from deterministic database calculations, but OCR/transcription, topic mappings, pattern groupings and worked solutions remain fallible. Real course benchmarks are required before asserting low major-error rates or publishing accuracy claims.

Official implementation references: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), [jose JWT verification](https://github.com/panva/jose), [S3 conditional writes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html).

See [notes tutor architecture and upgrade instructions](docs/NOTES-TUTOR.md) and [hosting setup](docs/V1-LAUNCH.md).
