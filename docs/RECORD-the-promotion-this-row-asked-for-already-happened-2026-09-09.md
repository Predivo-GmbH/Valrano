# The promotion this row was asking permission for had already happened

**2026-09-09 · Valrano · closes work-board row `signal-Valrano`**

## What the row said

Minted 2026-09-09, `blocked`, owned by `claude`:

> Promote Valrano to production? Staging is green on 728786c, but production still runs dfbead2
> from 04 Sept — every deploy run since has been green with the deploy step SKIPPED, so nothing
> shipped. Shall I promote it?

It never reached Roger. The row carried a `blocked_question` only; the board's gate needs
`ask_question` and `blocked_options` with at least two labelled choices, so the ask bounced back
to `claude` and the row stalled on a machine that could not answer it.

## What is true now

Measured live against the GitHub API:

| what | measurement |
| --- | --- |
| last `workflow_dispatch` promotion | run **34348721095**, head `8c662b7`, 2026-09-09T12:02:07Z |
| its `deploy` job | **success** |
| the promotion before it | run 34317060856, head `e30ba60`, 2026-09-09T05:58:46Z, success |
| the row's "production still runs `dfbead2` from 04 Sept" | run 33923310651 — superseded twice since |
| `promotion-backlog` signal for Valrano | **resolved** 2026-09-09T12:14:05Z, "shipping is caught up again" |

`main` is now `3e0679a` (12:55Z), one commit ahead of the promoted `8c662b7`, which is well inside
the backlog monitor's 24-hour threshold — hence the resolved signal.

## Why the row's premise looked right and was wrong

Valrano's `deploy` job carries `if: github.event_name == 'workflow_dispatch' && github.event.inputs.confirm == 'deploy'`.
On every **push** run, `deploy` is skipped **by design** — that is the promotion gate, not a
failure. A survey that reads push runs and concludes "nothing ever ships" will always say that,
about every product in the fleet, forever. Only the `workflow_dispatch` runs can ever carry a
production deploy, and two of them succeeded today before this row was even looked at.

## What was done

Nothing was deployed. The row closed on measurement.

## The general shape

`gh run list` without `--event workflow_dispatch` cannot see a promotion in a repo whose deploy is
dispatch-gated. Filtering by event, then reading `/actions/runs/<id>/jobs` for the `deploy` job's
own conclusion, is the two-request answer — and it disagreed with the row.
