# Security Audit — hv123-storyblok-apps

| Field | Value |
| --- | --- |
| Date | 2026-11-09 |
| Scope | Entire codebase (Next.js 15 App Router / Storyblok Space Apps) |
| Path | `/Users/halteverbotsocialmacpro/Desktop/arsvivai/2-DEV-PROJEKTE/hv123-storyblok-apps` |
| Auditor | security-auditor (adversarial) |
| Product code modified | No (report-only) |

## 1. Verdict: **FAIL**

Production-ready OAuth wiring, space binding, and secret hygiene are largely sound, but the audit fails on:

1. **Unauthenticated Management-API proxy when `APP_MODE=pat`** (documented deployment option).
2. **SSRF filter bypasses** in link checking (`isPublicHttpUrl`).
3. **Critical/high `npm audit` findings** on installed `next@15.5.9` (and transitive deps).

Mock-only local use is acceptable; any internet-reachable deploy with `pat` or unpatched Next is not.

---

## 2. Findings

### Critical

#### SEC-001 — PAT mode exposes full write API without authentication
| Field | Content |
| --- | --- |
| **CWE** | CWE-306 Missing Authentication for Critical Function |
| **Severity** | Critical |
| **Location** | `lib/server/context.ts:24-30`, all `app/api/**/route.ts` via `lib/server/respond.ts:26-35`; encouraged in `README.md:46` |
| **Evidence** | In `pat` mode, `repositoryFor()` always attaches `process.env.STORYBLOK_PAT` and never checks a session/cookie. `api()` then runs `listPages` / `updatePage` / `saveScripts` / `createRedirect` / `checkLinks` for any caller who can reach the host. |
| **Exploit scenario** | Attacker discovers the public tools host (or LAN host bound to `0.0.0.0`), `PUT /api/pages/{id}` or `PUT /api/scripts` and rewrites SEO, redirects, or injects tracking snippets into Storyblok using the server’s PAT. |
| **Fix** | Never deploy `APP_MODE=pat` on a public URL. Require OAuth (or a separate network ACL + shared secret / mTLS) for any mutating route. Treat PAT as local-only; refuse writes unless `Authorization` matches a server-side gate, or disable the HTTP surface when mode is `pat`. |

#### SEC-002 — SSRF allowlist bypass via IPv6 / incomplete host checks
| Field | Content |
| --- | --- |
| **CWE** | CWE-918 Server-Side Request Forgery (SSRF) |
| **Severity** | Critical (High if link-check URLs are only trusted CMS content and PAT is never public) |
| **Location** | `lib/http-status.ts:22-37`, sink `lib/link-check.ts:7-25` ← `LiveRepository.checkLinks` `lib/repository.ts:200-206` ← `POST /api/pages/check-links` |
| **Evidence** | Live probe of `isPublicHttpUrl` (2026-11-09): |
| | `http://[::ffff:127.0.0.1]/` → **allowed** |
| | `http://[fc00::1]/` → **allowed** |
| | `http://[fe80::1]/` → **allowed** |
| | Decimal/hex IPv4 and `169.254.169.254` correctly blocked; `.internal` suffix blocks GCP metadata hostname. No DNS resolution / pin-after-resolve. |
| **Exploit scenario** | Authenticated (or PAT-unauth) caller triggers link check against content URLs that use IPv6-mapped loopback or ULA addresses (or a public hostname that rebinds to a private IP), causing the Node server to probe internal services. |
| **Fix** | Resolve hostname, reject non-public A/AAAA results, block IPv4-mapped IPv6, ULA (`fc00::/7`), link-local, and metadata ranges; optionally allowlist only `*.halteverbot123.de` + known externals. |

#### SEC-003 — Next.js 15.5.9 has critical advisories (`npm audit --omit=dev`)
| Field | Content |
| --- | --- |
| **CWE** | Multiple (CWE-400/770 DoS, CWE-918 SSRF, CWE-288 middleware bypass, CWE-22/RCE image optimizer on some platforms, etc.) |
| **Severity** | Critical (dependency) |
| **Location** | `package.json` → `next@^15.5.9` (installed **15.5.9**) |
| **Evidence** | `npm audit --omit=dev`: **3** issues (**1 critical, 2 high**) aggregating many Next advisories (e.g. GHSA-h25m-26qc-wcjf, GHSA-p293-qw3h-jr36, GHSA-2xp9-vwfh-vxw4, GHSA-26hh-7cqf-hhc6, …), plus high `postcss` / `sharp`. Full audit (incl. dev): **12** vulns (7 moderate, 2 high, 3 critical) including Vitest/`tinypool` RCE gadgets. |
| **Exploit scenario** | Depends on advisory; several require Server Actions / Image Optimization / middleware — this app uses few of those, but middleware-bypass and DoS classes remain relevant on self-hosted Node. Unpatched Next on the public internet fails the bar. |
| **Fix** | Upgrade `next` (and `eslint-config-next`) to the latest patched 15.x/16.x per advisories; re-run `npm audit`. Upgrade `vitest` in lockstep for CI hosts. |

---

### Important

#### SEC-004 — CSRF / missing Origin checks on state-changing App Router APIs (OAuth mode)
| Field | Content |
| --- | --- |
| **CWE** | CWE-352 Cross-Site Request Forgery |
| **Severity** | Important |
| **Location** | `app/api/pages/[id]/route.ts`, `app/api/scripts/route.ts`, `app/api/pages/redirects/route.ts`, `app/api/pages/check-links/route.ts`; session cookies from `@storyblok/app-extension-auth` (`samesite=none; secure; httponly; partitioned`) |
| **Evidence** | Mutating routes trust cookie session only; no CSRF token, no `Origin`/`Sec-Fetch-Site` validation. Library cookies are intentionally `SameSite=None` for iframe use. |
| **Exploit scenario** | If the session cookie is partitioned to the tools origin (top-level OAuth) or CHIPS does not apply, a malicious site can induce authenticated writes (redirect / script catalog). Risk is reduced for pure Storyblok-iframe partitions but not eliminated by app code. |
| **Fix** | Require `Origin` ∈ `{APP_URL, https://app.storyblok.com}` (and preview hosts) on write methods; or double-submit CSRF token bound to session. |

#### SEC-005 — In-memory rate limit is spoofable and non-durable
| Field | Content |
| --- | --- |
| **CWE** | CWE-770 Allocation of Resources Without Limits / CWE-290 |
| **Severity** | Important |
| **Location** | `lib/server/respond.ts:10-24` |
| **Evidence** | Key = `x-forwarded-for` first hop (client-controllable if edge does not overwrite) or `"local"`; Map resets per process; limits 180 r / 60 w per minute. |
| **Exploit scenario** | Attacker rotates spoofed XFF to bypass limits, or exhausts Storyblok API / SSRF workers via `checkLinks` fan-out (`mapPool` concurrency 5 over all outgoing URLs). |
| **Fix** | Trust only platform-provided client IP; use Redis/edge rate limits; stricter cap on `check-links`; require auth before expensive work (already true in oauth; not in pat — see SEC-001). |

#### SEC-006 — Unauthenticated `/api/meta` information disclosure
| Field | Content |
| --- | --- |
| **CWE** | CWE-200 Exposure of Sensitive Information |
| **Severity** | Important (Low–Medium in isolation) |
| **Location** | `app/api/meta/route.ts:12-27` |
| **Evidence** | Public JSON: `mode`, `spaceId`, domains, field keys, catalog slugs, schema-gap hints. No auth. |
| **Exploit scenario** | Recon for targeted Storyblok / phishing / PAT brute against a known space ID and field layout. |
| **Fix** | Gate behind auth, or strip to non-sensitive health fields in production. |

#### SEC-007 — Script `snippet` stored without size/content policy; becomes site XSS if website executes it
| Field | Content |
| --- | --- |
| **CWE** | CWE-79 Stored XSS (downstream) / CWE-20 |
| **Severity** | Important (Critical under SEC-001) |
| **Location** | `lib/order.ts:58-86` (no snippet validation), `lib/scripts.ts:24-30`, `PUT /api/scripts` |
| **Evidence** | `validateScriptDraft` checks name/details/URLs/enums only; `snippet` is opaque text. App UI does not execute it (good); website example `examples/nextjs/read-halteverbot-config.ts` is designed to load scripts for the public site. |
| **Exploit scenario** | With write access (OAuth editor or unauth PAT), attacker plants malicious JS in the catalog; once published and rendered by the website, visitors execute attacker code. |
| **Fix** | Keep snippets out of untrusted writers; require OAuth + Storyblok role checks; optional allowlist / length caps; never combine with public PAT. |

#### SEC-008 — No security headers / frame-ancestors policy
| Field | Content |
| --- | --- |
| **CWE** | CWE-1021 Improper Restriction of Rendered UI Layers (clickjacking) |
| **Severity** | Important |
| **Location** | `next.config.ts` (no headers); `app/layout.tsx` |
| **Evidence** | No CSP / `frame-ancestors` / HSTS / Referrer-Policy configured in app. Embedding in Storyblok is required, so blanket `X-Frame-Options: DENY` is wrong — but open framing from any origin is also wrong. |
| **Exploit scenario** | Hostile page iframes `/seiten-check` and overlays UI to trick an already-authenticated Storyblok user. |
| **Fix** | `Content-Security-Policy: frame-ancestors 'self' https://app.storyblok.com https://*.storyblok.com;` plus HSTS on HTTPS deploys. |

#### SEC-009 — OAuth session fallback to `getAll()[0]` without `space_id`/`user_id`
| Field | Content |
| --- | --- |
| **CWE** | CWE-384 Session Fixation / CWE-863 |
| **Severity** | Important (Low if client always sends both params) |
| **Location** | `lib/auth/session.ts:21-28` |
| **Evidence** | If query lacks both `space_id` and `user_id`, code uses first session from cookie store. Client normally appends iframe search (`components/shared/client-api.ts:7-8`). |
| **Exploit scenario** | Multi-space cookie jar or missing params selects the wrong session; combined with weak client assumptions, wrong-space operations until `expectedSpaceId()` 403. Space mismatch is checked (`context.ts:34-36`) — mitigates cross-space writes to foreign spaces not equal to configured ID, but still picks an arbitrary session. |
| **Fix** | Require `space_id` + `user_id`; fail closed if missing; never default to `all[0]`. |

---

### Minor

#### SEC-010 — Verbose error bodies on API failures
| Field | Content |
| --- | --- |
| **CWE** | CWE-209 Generation of Error Message Containing Sensitive Information |
| **Severity** | Minor |
| **Location** | `lib/server/respond.ts:36-46` |
| **Evidence** | Non-AppError paths return `error.message` to the client (may include Storyblok upstream text). |
| **Fix** | Generic client message + server-side log with request id. |

#### SEC-011 — Mock mode unauthenticated filesystem mutation / reset
| Field | Content |
| --- | --- |
| **CWE** | CWE-306 |
| **Severity** | Minor (Critical if mock deployed publicly) |
| **Location** | `lib/mock/store.ts`, `app/api/reset/route.ts`, `resolveMode` default |
| **Evidence** | Mock writes `.data/mock-store.json`; `POST /api/reset` allowed in mock (blocked in live: `repository.ts:229-230`). Dev binds `0.0.0.0` (`package.json` scripts). |
| **Fix** | Ensure production `APP_MODE=oauth`; bind local to `127.0.0.1` by default. |

#### SEC-012 — Hardcoded space ID / domain map in repo
| Field | Content |
| --- | --- |
| **CWE** | CWE-200 |
| **Severity** | Minor |
| **Location** | `config/field-mapping.json:1-10`, `.env.example` |
| **Evidence** | Space ID and hostnames are public config for this product; still aids targeting. |
| **Fix** | Acceptable; keep secrets out (already done). |

#### SEC-013 — Shared OAuth client fallback across apps
| Field | Content |
| --- | --- |
| **CWE** | CWE-250 / least privilege |
| **Severity** | Minor |
| **Location** | `lib/auth/params.ts:11-12` |
| **Evidence** | Per-app IDs fall back to `STORYBLOK_CLIENT_ID/SECRET`. README notes this as emergency only. |
| **Fix** | Prefer distinct OAuth apps; alert if fallback used in production. |

---

## 3. Positive controls (not findings)

- No `NEXT_PUBLIC_*` secrets; PAT / OAuth secrets only via server env (`.env.local` gitignored).
- OAuth callbacks only under `pages/api/connect/{app}/[...slug].ts` with hardcoded `successCallback` paths.
- OAuth mode enforces `session.spaceId === expectedSpaceId()` (`lib/server/context.ts:34-36`).
- Redirect/canonical validation via `lib/page-rules.ts` / `lib/redirects.ts` (path or https only; loop detection).
- Link checker refuses many private IPv4 forms; timeout 8s; `redirect: "manual"`.
- Live `reset()` returns 403.
- Snippets not executed in this app’s React UI.
- `poweredByHeader: false` in `next.config.ts`.

---

## 4. npm audit summary

### Production (`npm audit --omit=dev`)
| Severity | Count |
| --- | --- |
| critical | 1 (package `next`, many advisories rolled up) |
| high | 2 (`postcss`, `sharp` via Next) |
| moderate / low | 0 |
| **total** | **3** |

Installed: **next@15.5.9**.

Notable Next advisories include DoS (RSC / image / connections), middleware/proxy bypasses, SSRF in server actions/rewrites/WebSocket, image-optimizer RCE classes on some configs/platforms, cache poisoning / XSS variants. Not all are reachable in this app’s feature set; upgrade still required.

### Full tree (`npm audit`)
| Severity | Count |
| --- | --- |
| critical | 3 (includes `next`, `tinypool` via Vitest) |
| high | 2 |
| moderate | 7 |
| **total** | **12** |

Dev-only: Vitest mocker path traversal / code injection; `tinypool` prototype-pollution → RCE gadgets; typescript-eslint → minimatch. Fix with `npm audit fix` / Vitest major bump on CI agents.

**Secrets scan:** `.env.local` gitignored; only `.env.example` tracked; no live tokens in `.env.local` at audit time (empty PAT/client secrets). No committed PEM/credential files.

---

## 5. Recommended fix priority

1. **P0 — Deploy posture:** Production must be `APP_MODE=oauth` only; network-deny or disable HTTP APIs when mode is `pat`/`mock`. Update README so PAT is never a public “interne Pflege” option without VPN/authz.
2. **P0 — Patch Next:** Upgrade `next` (+ eslint-config-next) to current patched release; re-audit.
3. **P0 — Harden `isPublicHttpUrl`:** DNS resolve + public-IP check; block IPv6 ULA/link-local/v4-mapped; optional host allowlist for link checks.
4. **P1 — CSRF/Origin:** Validate `Origin`/`Sec-Fetch-Site` on PUT/POST; fail closed.
5. **P1 — Rate limit:** Non-spoofable IP + durable limiter; special budget for `check-links`.
6. **P1 — Headers:** CSP `frame-ancestors` for Storyblok; HSTS.
7. **P1 — Session:** Require `space_id`+`user_id`; remove `getAll()[0]` fallback.
8. **P2 — `/api/meta` auth or shrink; generic 500 messages; Vitest upgrade; bind `127.0.0.1` in `npm run dev`.

---

## 6. Attack surface map (API)

| Route | Methods | Auth in oauth | Auth in pat/mock |
| --- | --- | --- | --- |
| `/api/pages` | GET | Session + space match | **None** (PAT/mock) |
| `/api/pages/[id]` | PUT | Session | **None** |
| `/api/pages/redirects` | POST | Session | **None** |
| `/api/pages/check-links` | POST | Session | **None** (+ SSRF sink) |
| `/api/scripts` | GET, PUT | Session | **None** |
| `/api/reset` | POST | 403 live / open mock | Mock only |
| `/api/meta` | GET | **None** | **None** |
| `/api/connect/*` | OAuth | Storyblok library | N/A if unconfigured (501) |

---

## 7. Residual risk / assumptions

- Assumes Storyblok Partner OAuth apps use least scopes documented (`stories` + `components` read/write).
- Assumes website sanitizes or intentionally executes catalog snippets under consent — out of this repo’s runtime but in the trust chain.
- CHIPS/`Partitioned` cookies reduce classic third-party CSRF for iframe-only sessions; do not treat as a complete CSRF control.

**End of report.**
