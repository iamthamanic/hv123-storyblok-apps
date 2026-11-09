# Agent notes — Halteverbot123 Storyblok Apps

## Stack

- Next.js 16 (App Router), React 19, TypeScript, Vitest
- Storyblok Management API (mock / PAT / OAuth)
- Apps: `/seiten-check`, `/scriptverwaltung`

## Commands

```bash
npm run dev          # http://127.0.0.1:43123
npm test
npm run typecheck
npm run lint
npm run build
```

## Non-negotiables

- Secrets only in `.env.local` (never commit tokens)
- Domain logic lives in `lib/`; UI in `components/`
- Table export/columns: `lib/table-export.ts` + `components/table/*` (shared)
- Seiten-Check UI modules under `components/seiten-check/` — do not re-merge into one god file
- Prefer mock mode for local UI work without Storyblok credentials

## Security checklist

- No secrets in client bundles
- OAuth callbacks only under `/api/connect/*/callback`
- Validate redirect/canonical paths via `lib/page-rules` / `lib/redirects`
- Public deploy: `APP_MODE=oauth` only (PAT/mock writes blocked in production)
- Mutating APIs: Origin / Sec-Fetch-Site checks in `lib/server/security.ts`
- Link checks: `isPublicHttpUrl` + DNS pin in `lib/link-check.ts`

## Docs

- Product overview: `README.md`
- Architecture: `docs/ARCHITECTURE.md`
- UI tokens/patterns: `docs/UI_STYLEGUIDE.md`
- Agent workflow config: `.qa/project.yaml`

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
