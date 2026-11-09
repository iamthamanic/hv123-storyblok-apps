# Security Checklist — after remediation

- **Date:** 2026-11-09
- **Mode:** audit (post-fix)
- **HEAD SHA:** WORKTREE
- **Verdict:** PARTIAL (SC-04 residual postcss via Next 15; SC-05 structured logs only, no pager)

| ID | Result | Notes |
|----|--------|-------|
| SC-01 | PASS* | Prod blocks PAT/mock writes; oauth + space bind |
| SC-02 | PASS* | Origin check, SSRF+DNS, required strip, snippet cap, generic 500s |
| SC-03 | PARTIAL | Stricter buckets + TRUST_PROXY; still in-memory (ok for single node) |
| SC-04 | PARTIAL | next@15.5.29 (critical Next advisories cleared); nested postcss needs Next 16 |
| SC-05 | PARTIAL | JSON `securityLog` events; no external alert sink yet |
| SC-06 | PASS | unchanged |
| SC-07 | PARTIAL | Storyblok SoT; documented oauth-only deploy |
