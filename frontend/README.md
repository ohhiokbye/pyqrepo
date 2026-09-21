# CPYQ Lib — Frontend

Next.js (App Router) application for CPYQ Lib. See the [repository root README](../README.md) for the full project overview, architecture, and quick-start instructions.

## Development

```bash
npm install
npx prisma db push   # sync schema against the local Postgres instance
npm run dev
```

Copy `.env.example` to `.env` and fill in the required values before running.

Before opening a PR, run:

```bash
npx tsc --noEmit
npm run lint
```
