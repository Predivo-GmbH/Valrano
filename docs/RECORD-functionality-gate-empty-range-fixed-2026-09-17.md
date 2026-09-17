# Valrano functionality gate: the empty range that made it compare main to itself — FIXED, on main, proven

Row: `signal-Valrano:73c3e30:functionality-gate-diffs-main-aga`
Date: 2026-09-17 · Verified live from the Valrano repo and `origin/main` this session.

## What the row claimed

Merge `73c3e30` ("Merge: nothing new ships untested") installed a **BLOCKING** step in the
production-promotion job of `.github/workflows/deploy.yml`:

```yaml
# Nothing new ships untested (installed 2026-09-17). BLOCKING - never continue-on-error.
- name: Nothing new shipped without its test (BLOCKING)
  run: node scripts/check-new-functionality-registered.mjs
```

The row said the gate "compares main to itself on every run, so it can never block". **Confirmed.**

## Measured before believing (Gate 0B)

- `git show 73c3e30 --stat` — the merge adds the gate script, the recogniser, and the deploy step.
- Read `scripts/check-new-functionality-registered.mjs` on `origin/main` (tip `7ccf1ec`, two "Gate
  follow-up" commits past the merge): `defaultRange()` still returned `${base}...HEAD` for the first
  of `origin/main / origin/master / main / master` that resolved. No same-commit guard, no
  `FUNCTIONALITY_GATE_BASE`. The two follow-up commits fixed a `%20` path and a fixture path — **not**
  the empty range.
- The gate is wired only into the `deploy` job (`if: github.event_name == 'workflow_dispatch' && …
  confirm == 'deploy'`) — a production promotion. `actions/checkout@v5` there checks out **main**, so
  `origin/main` == `HEAD` and `origin/main...HEAD` is a commit compared against itself → an EMPTY
  range → `added.total === 0` → `console.log('OK … adds nothing') ; process.exit(0)`. The gate passed
  everything, always. A guaranteed no-op on the exact event it was installed to guard.

Valrano runs the gate from the repository **root** (no `working-directory: app`), so it does **not**
have the sibling products' `app/`-path double-join bug. The empty range was the single defect.

## The fix (same pattern as the Distribution-OS sibling `c62755a`)

`defaultRange()` now:
- **skips any base that resolves to the same commit as HEAD** — an empty range checks nothing;
- **honours `FUNCTIONALITY_GATE_BASE`** (e.g. the last-deployed production sha, if the deploy sets it)
  as the base when present;
- **falls back to `HEAD~1...HEAD`**, which is never empty, when every candidate equals HEAD (the
  normal case on a main deploy).

The CLI body is guarded by `IS_CLI` so `defaultRange` can be unit-imported without the module running
the scan or calling `process.exit`. No behaviour change on a real feature-branch/PR diff, where
`origin/main` ≠ HEAD — only the degenerate main==HEAD case is repaired.

## Definition of finished (this row had none — established here)

Finish-test: `scripts/functionality-gate-diffs.test.mjs` (shipped in this change). Hermetic — it
builds throwaway git repos in the **main == HEAD** production-deploy shape and drives the **real**
scripts. Five checks, each of which fails against the pre-fix code:

1. `defaultRange` yields a non-empty range when `main == HEAD`.
2. `FUNCTIONALITY_GATE_BASE` sets the production baseline.
3. the recogniser resolves the changed `src/` file from the repository root.
4. E2E — the gate **REFUSES** an unregistered new functionality on a main deploy.
5. E2E — the gate **PASSES** when the new functionality has a row and a real test file.

Verified this session on this Windows machine: **5/5, exit 0**. The interstitial `FAIL … REFUSED`
text in the output is the subprocess output of check 4 — i.e. the gate correctly refusing — not a
test failure.

## Where the code landed

`https://github.com/Predivo-GmbH/Valrano/commit/2884ed9ca5381ea13fa6d18c198ca0cafd084c14`
— pushed to `origin/main` (`7ccf1ec..2884ed9`).

## Why there is no deploy-run production_ref

`deploy.yml`'s production job is `workflow_dispatch`-only (fleet standard) — a push to `main` deploys
**staging** only, and the gate step lives in the prod-promotion job, so no deploy exercised it on this
push and none is needed to prove a script fix. Valrano is a customer-facing product, so per the
standing boundary this work stops at staging: the fix is on `main` (staging), and firing the manual
production promotion is deliberately left to a human/authorised session. The sanctioned proof for a
guard/script is its passing finish-test, which is what closes this row.

## Now-live behaviour worth knowing (not a defect)

With the fix on `main`, the gate is no longer a no-op. On the next **manual** production promotion it
checks `HEAD~1...HEAD` (or `FUNCTIONALITY_GATE_BASE…HEAD` if the deploy workflow sets it) and will
BLOCK the promotion if that change added a functionality with no `F-XXX` row and no real test. That is
the intended "nothing new ships untested" enforcement.
