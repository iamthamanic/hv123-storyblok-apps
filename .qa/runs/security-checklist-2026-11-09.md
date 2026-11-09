# Security Checklist — halteverbot123-storyblok-apps

- **Date:** 2026-11-09
- **Mode:** audit (full codebase)
- **HEAD SHA:** `4ed2db5b31ed5817a248c755f6ed1828c961cdbf`
- **Stack notes:** Next.js 15 App Router · Storyblok Management API · mock/pat/oauth
- **Verdict:** FAIL (SC-04/SC-05 remain; SC-01/02 mitigated in worktree)
- **Companion:** `@security-auditor` report `.qa/runs/security-auditor-2026-11-09.md` ([security-auditor](7984f663-f572-4c9b-896a-152b45b14344))
- **Worktree mitigations:** SSRF harden, strip script `required`, prod PAT write block

## Summary

| ID | Gate | Result | Severity | Notes |
|----|------|--------|----------|-------|
| SC-01 | Authorization / IDOR | PARTIAL | Critical | Prod PAT writes blocked unless `ALLOW_PAT_WRITES=true`; oauth still lacks Origin/CSRF |
| SC-02 | Never trust the client | PARTIAL | Critical | SSRF host filter hardened; `required` stripped; snippet capped; CSRF/Origin still open |
| SC-03 | Rate limiting | PARTIAL | Important | In-memory 60w/180r exists but XFF-spoofable, non-durable |
| SC-04 | Supply chain | FAIL | Important | Lockfile yes; `npm audit --omit=dev` critical/high on next@15.5.9 |
| SC-05 | Logging & monitoring | FAIL | Important | `console.error` only; no structured security events / alerts |
| SC-06 | Secrets | PASS | Critical | `.env.example` only placeholders; `.env.local` gitignored; no client bundle secrets found |
| SC-07 | Backups & recovery | PARTIAL | Important | Storyblok is SoT (platform backups); app has no documented restore/rollback drill |

## Evidence

### SC-01
- Test performed: code review of `lib/server/context.ts` + all `app/api/**` via `api()`; mock mode unauthenticated by design; PAT attaches `STORYBLOK_PAT` with zero session check; OAuth checks space id.
- Result: **FAIL** for any internet-reachable `pat` deploy. OAuth path is better (session + space bind) but CSRF still open (auditor SEC-004). Multi-user IDOR N/A (single-space ops tool), but unauthenticated write is worse than classic IDOR.

### SC-02
- Hostile fields: `PagePatch` typed allowlist in TS (good) + `explainPageChange` server validation. Scripts: `replaceScripts` → `validateScriptDraft` but accepts client `required: true` / unconstrained `snippet` size (auditor SEC-007).
- SSRF filter `isPublicHttpUrl` allows IPv6-mapped/ULA (auditor live probe) — server acts on client/CMS-supplied URLs in `checkLinks`.
- Result: **FAIL**.

### SC-03
- `lib/server/respond.ts` Map limiter; write routes set `write=true`.
- Result: **PARTIAL** — present but spoofable / process-local (SEC-005).

### SC-04
- `package-lock.json` committed.
- `npm audit --omit=dev`: critical/high on Next 15.5.9 (SEC-003).
- Result: **FAIL**.

### SC-05
- Only `console.error("[api]", …)` / `[link-check]`. No Sentry/Axiom; no auth-abuse alert.
- Result: **FAIL** (audit/launch).

### SC-06
- Secrets only via env; OAuth secrets server-side; no live tokens in tree at audit time.
- Result: **PASS** (rotate if any PAT was ever committed historically — not observed now).

### SC-07
- Data lives in Storyblok; mock store is local `.data`. No app-owned backup/restore rehearsal documented.
- Result: **PARTIAL** — rely on Storyblok platform; document rollback for OAuth app deploy.

## Findings to fix

| ID | Issue | Action |
|----|-------|--------|
| SC-01 | PAT mode open write API | Production oauth-only; refuse `pat` on public hosts |
| SC-02 | SSRF + script `required`/snippet | Harden `isPublicHttpUrl`; strip `required`; cap snippet |
| SC-03 | Spoofable rate limit | Edge/Redis limiter; trust platform IP |
| SC-04 | Next advisories | Upgrade Next to patched release |
| SC-05 | No security monitoring | Add error SDK + auth/429 logs + one alert |
| SC-07 | No restore drill note | Document Storyblok restore + deploy rollback |

## Out of scope / N/A

- Classic multi-tenant user A/B resources — product is single configured Storyblok space.

## Secure-by-Default cross-ref

- Related: B-02/B-03 (authz), B-06/P-05 (rate), B-09 (client trust), P-01 (deps), CWE-918 SSRF
- `@security-review` also run: via **security-auditor** companion (yes)

## Next steps

1. Block public `pat` / require OAuth for mutating routes.
2. Patch Next + re-audit.
3. Fix `isPublicHttpUrl` (resolve + public IP).
4. Origin check on writes; durable rate limits; observability.
