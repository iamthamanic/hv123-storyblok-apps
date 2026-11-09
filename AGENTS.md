# Agent notes — Halteverbot123 Storyblok Apps

## Stack

- Next.js 15 (App Router), React 19, TypeScript, Vitest
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
