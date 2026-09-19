# Functionality gate checked only the tip commit on a production promotion — fixed 2026-09-19

Row: `monitor-valrano-6143648-functionality-gate-tip-61f4896e` (`934e84f8-5bf6-4ef7-bd00-badce8a5d749`)
Fleet signal: `commit-review/Valrano:6143648:functionality-gate-tip-commit-only-on-promotion`

## The defect (live, confirmed at origin/main HEAD 6143648)

The BLOCKING gate "Nothing new shipped without its test" (`.github/workflows/deploy.yml`,
`deploy` job — the `workflow_dispatch` production promotion) ran
`node scripts/check-new-functionality-registered.mjs` with **no `FUNCTIONALITY_GATE_BASE` set**.

A production promotion is a `workflow_dispatch` off `main`, so the checkout IS `main`
(`origin/main === HEAD`). The script's `defaultRange()` skips a base that equals HEAD (that fix,
6143648 + its parents, closed the earlier *empty-range* bug) and then falls back to
`HEAD~1...HEAD` — **the tip commit only**. So a promotion made after N pushes checked commit N and
shipped commits 1..N−1 **unchecked**. The gate looked green while never inspecting most of what it
was promoting.

This was the deliberately-deferred half of the 6143648 fix, which only addressed the empty range and
the fetch-depth, and left `FUNCTIONALITY_GATE_BASE` set nowhere.

## The fix

A new step in the `deploy` job, immediately before the gate, resolves the commit **currently live in
production** — the `head_sha` of the last successful `workflow_dispatch` run of `deploy.yml` (a real
prod promotion; a `push` run is only a staging deploy) — using the same fail-closed `curl` helper the
staging-gate step uses. It:

1. Queries `.../actions/workflows/deploy.yml/runs?branch=main&event=workflow_dispatch&status=success&per_page=1`
   (green runs only, newest first; the in-flight run is not yet "success" so it never self-matches),
   reads the first `head_sha`.
2. Exports `FUNCTIONALITY_GATE_BASE=<sha>` to `$GITHUB_ENV`, so the gate diffs `base...HEAD` —
   **every** commit shipping in this promotion, not just the tip.
3. **Fails closed** (`exit 1`) when the base cannot be resolved (no prior successful prod promotion,
   or the API request failed) or when that commit is not present in the fetched history — never lets
   the gate fall back silently to the tip-only range.

## Proof

`scripts/functionality-gate-diffs.test.mjs` — extended from 6 to **7** checks. The 7th asserts the
deploy job resolves the base from a successful `workflow_dispatch` run, exports
`FUNCTIONALITY_GATE_BASE`, fails closed on an empty base, and does so BEFORE the gate step. It fails
against the pre-fix workflow (which set the base nowhere). Run:

```
node scripts/functionality-gate-diffs.test.mjs   # 7/7 checks passed, exit 0
```

## Boundary

Edit + commit + push only (monitor/CI-class). Valrano is a customer-facing product, so the PROD
PROMOTION that deploys this workflow change stays Roger's gate — this change is staged for release,
not promoted.
