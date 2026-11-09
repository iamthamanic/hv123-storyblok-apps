# Architecture

**Status:** binding  
**Stack:** Next.js 16 App Router · Storyblok Management API

## Purpose

Two Storyblok Space Apps share one Next.js deployment:

| App | Route | Responsibility |
|-----|-------|----------------|
| Seiten-Check | `/seiten-check` | Page SEO/path/redirect/link audit |
| Scriptverwaltung | `/scriptverwaltung` | Script inventory & cookie categories |

## Layers

```
app/                 # routes + API handlers (thin)
components/          # UI (seitencheck, scriptverwaltung, table, shared)
lib/                 # domain: assemble, links, redirects, repository, mapping, auth
lib/mock/            # fixtures + mock store
config/              # field mapping / space config
```

## Data modes

1. **mock** — `.data/mock-store.json` (default without token)
2. **pat** — `STORYBLOK_PAT`
3. **oauth** — installed Space App session

Selection: `lib/repository.ts` (`APP_MODE` / PAT detection).

## UI module map (Seiten-Check)

| Module | Role |
|--------|------|
| `SeitenCheckApp.tsx` | Orchestrator (state, load/save, table views) |
| `PageDrawer.tsx` | Side drawer + broken/link lists |
| `LinkDetailModal.tsx` | Von→Nach link table modal |
| `table-parts.tsx` | Toolbar, filters, cells, column resize |
| `types.ts` / `link-utils.ts` | Shared types and URL helpers |

Shared across apps: `components/table/TableToolsMenu.tsx`, `useColumnWidths.ts`, `lib/table-export.ts`.

## API surface

- `GET/PUT /api/pages`, `POST /api/pages/check-links`, `POST /api/pages/redirects`
- `GET/PUT /api/scripts`, `GET /api/meta`, `POST /api/reset`
- OAuth connect under `/api/connect/{app}/…`

## Boundaries

- Website runtime (Termly load, actual 301, sitemap emit) is **out of scope** — config only in Storyblok
- Do not call Storyblok from client components; use `clientApi` → Route Handlers → `lib/repository`
