# Performance Investigation

## Verdict
Under `next dev` mock mode, the dominant user-visible cost is **first-hit route compilation** (multi-second to tens of seconds) and **`POST /api/pages/check-links`**, which fans out HTTP HEAD/GET to every unique outgoing URL and can stall the Node event loop / starve the UI. Warm API reads after compile are ~0.2–0.4s. No optimization shipped this run — evidence-only audit.

## Test Environment
- Machine: local macOS Darwin; Next.js **15.5.9** `npm run dev` on `http://127.0.0.1:43123`
- Mode: mock (from running app)
- Tools: Next access log timings; curl/urllib samples (warm re-sample interrupted by server stall during concurrent build/check-links)
- Throttling: none
- Depth: interaction + white-box (Mode A + partial B); Mode D/E **not in scope**

## User Journeys Tested
1. Open `/seiten-check` / `/scriptverwaltung` (primary workspaces)
2. Load `/api/meta`, `/api/pages`, `/api/scripts` (boot path of both apps)
3. Save page (`PUT /api/pages/:id`) — white-box critical path
4. Link check (`POST /api/pages/check-links`) — highest latency risk

## Baseline
- Warm-up: prior interactive use in session
- Cold compile captured from Next log while measuring under load
- Sample note: cold timings from server log are **single observations** (flag small-n); warm page HTML n≈ several from log

## Slowest Interactions

| Rank | Interaction | p50 | p95 | Bottleneck | Confidence | Priority |
|------|-------------|-----|-----|------------|------------|----------|
| 1 | Cold compile `/api/meta` under load | ~8.5s (single) | ~26.5s (recompile 10k modules) | Next on-demand compile | STRONG EVIDENCE | P1 (dev) / P3 (prod build) |
| 2 | `POST /api/pages/check-links` | hung / multi-minute under mock+external URLs | — | N× outbound fetch + event-loop contention | STRONG EVIDENCE | P0 |
| 3 | Cold `GET /api/pages` | ~4.2s first compile | — | Compile + assemble pages | STRONG EVIDENCE | P1 (dev) |
| 4 | Warm `GET /api/pages` | ~197–233ms | ~2.3s under contention | Mock assemble | LIKELY | P2 |
| 5 | Warm HTML `/seiten-check` | ~107–191ms | ~4.8s under contention | RSC/dev | LIKELY | P3 |

### Perceived Ready vs Fully Ready
- **Seiten-Check open:** Perceived Ready ≈ shell paint; Fully Ready ≈ meta+pages settled. Cold Fully Ready dominated by first API compile (seconds).
- **Link check:** Perceived Ready (button feedback) immediate; Fully Ready = all URL probes done — can block other API traffic on same Node process (observed server non-responsive during probe storm).

## Critical Paths

### Link check (worst)
```
click → POST /check-links → listPages → unique outgoing URLs
  → mapPool(concurrency=5) fetchHttpStatus (8s timeout each)
  → listPages again → JSON → React table
```
% of wall time: almost entirely **Backend Wait / outbound Network** (+ possible event-loop starvation of unrelated requests).

### Page save (white-box)
```
PUT → updatePage → GET story → PUT story → listPages (full reload)
```
Extra full list after every save: Storyblok round-trips (oauth/pat) or mock re-assemble — measurable amplification vs returning patched row only.

## Proven Bottlenecks

1. **Observation:** Concurrent check-links + build made `/api/meta` time out (curl 3–8s failures); Next log showed 25s+ meta responses during recompile.
   **Evidence:** terminal `346170` timings; curl `000` during stall.
   **Interaction:** Link check / heavy compile.
   **Measured impact:** multi-second to complete unavailability of tools API.
   **Likely root cause:** unbounded fan-out + shared Node process.
   **Confidence:** STRONG EVIDENCE

2. **Observation:** `LiveRepository.updatePage` always re-lists all pages after write.
   **Evidence:** `lib/repository.ts` updatePage → `listPages()`.
   **Interaction:** Save page.
   **Measured impact:** not isolated numerically this run (server stall); expected 2× Storyblok cost vs return-local.
   **Likely root cause:** convenient consistency, not incremental response.
   **Confidence:** HYPOTHESIS for latency magnitude; PROVEN for code shape

## Root Causes
- Dev-only: on-demand compilation of App Router + API chunks.
- Product: `checkLinks` O(unique_urls) network with 8s timeouts, concurrency 5, no global deadline.
- Product: save path re-fetches entire catalog.

## Scaling Behaviour
not in scope (Mode D/E not requested). Data complexity: link-check scales with outgoing URL cardinality (Mode E signal).

## Recommended Optimizations

| ID | Option | Impact | Trade-off |
|----|--------|--------|-----------|
| A | Global deadline + harder concurrency + skip non-public early for check-links | P0 latency/availability | Fewer completed checks per click |
| B | Cache status by href with TTL; incremental recheck | P0/P1 | Stale statuses |
| C | `updatePage` return patched page without full `listPages` | P1 save latency | Must keep link aggregates coherent |
| D | Prefer `next start` / production build for perf claims | Measurement hygiene | Not a product fix |

## Rejected Optimizations
- Reflexive `useMemo` on table cells — no evidence UI render is the critical path vs network/compile.
- Adding Redis for page list in mock — wrong layer.

## Priority Order
- P0: Bound link-check (deadline, concurrency, SSRF-safe URL set)
- P1: Avoid full relist on every save (oauth/pat)
- P2: Warm API assemble cost if catalogs grow
- P3: Dev compile pain (document; use prod build for demos)

## Expected Impact
- P0: prevents tools API hard-stall when many outgoing links
- P1: cuts Storyblok round-trips per save roughly in half on happy path

## Risks / Trade-offs
- Weaker link-check completeness vs responsiveness
- Returning partial page after save may desync incoming/outgoing until refresh

## Unknowns
- Warm p50/p95 after clean restart not re-captured (server restart mid-audit still compiling)
- Production (`next start`) timings not measured
- oauth/pat Storyblok latency not measured (mock only)

## Validation Plan
1. Restart clean `next start` build; n=20 warm GET `/api/pages`, `/api/meta`.
2. Fixture with N={10,50,200} unique outgoing URLs; time check-links before/after P0.
3. Same for PUT save before/after skipping full relist.
