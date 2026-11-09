# Composition Gate — hv123-storyblok-apps

- HEAD_SHA: WORKTREE (fixes on top of `4ed2db5`; uncommitted)
- Date: 2026-11-09
- Verdict: CLEAR
- Note: Round-1 blockers fixed in-tree (SSRF host checks, strip client `required`, prod PAT write block). CSRF Origin + Next upgrade remain security backlog (notes, not composition blockers).

## Event
Editor saves page SEO/redirect settings (and separately: script catalog / link-check) into Storyblok via the tools API.

## Hop chain
UI (`SeitenCheckApp` / `ScriptApp`) → `clientApi` fetch → Route Handler (`app/api/pages/[id]` | `scripts` | `check-links`) → `api()` auth/rate-limit → `repositoryFor` (mock|pat|oauth) → `LiveRepository.updatePage` / `saveScripts` / `checkLinks` → Storyblok Management API (or mock store) → UI toast / re-list

Unchanged consumers on path: website runtime reads Storyblok fields later (out of this repo) — `snippet` / redirects become site behavior (`label-lie` risk if UI says “not executed” but website does).

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| 1 event, N actors | 1 editor write → 1 Storyblok update | oauth: session→1 write; pat prod writes **403** unless opt-in; link-check still N probes | pass (identity); note cardinality |
| invalid / missing | Bad path/SSRF rejected | `explainPageChange` + hardened `isPublicHttpUrl` reject private/mapped/ULA | pass |
| 2 consumers / crash | No silent retarget | Crash mid-PUT still possible; CSRF Origin still open (note) | pass meaning; note override |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| `identity:` | blocker | context → repository | PAT writes had no actor | **done** — prod blocks PAT writes unless `ALLOW_PAT_WRITES=true` |
| `silent-fallback:` | blocker | http-status → link-check | IPv6 mapped/ULA allowed | **done** — `isPublicHttpUrl` rejects mapped/ULA/literal IPv6 |
| `cardinality:` | note | check-links | N outbound probes | open — perf P0, not meaning change |
| `override:` | note | PUT APIs CSRF | SameSite=None without Origin | open — security backlog |
| `label-lie:` | note | Script → website | snippets stored for site | **mitigated** — `required` stripped; snippet capped 50k |

## Skip reason
n/a
