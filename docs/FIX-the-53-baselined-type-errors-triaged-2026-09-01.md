# The 53 baselined edge-function type errors — triaged 2026-09-01

Board item: `valrano-53-baselined-type-errors` ("Valrano carries 53 old typing mistakes, now frozen
in place"). Origin: `C:\Business\Audits\CLOSEOUT-valrano-three-defects-2026-08-25.md` §3, which
added the `gate-edge-typecheck` ratchet and froze the count at 53.

## The question, and the answer

**Are the 53 real defects or noise? Answer: 52 are noise, 1 was a real, silent, money-wasting
production bug — and it is now fixed.** The baseline is the right call for the other 52, for
reasons given per class below.

## How the number was obtained, and what it counts

Roger's warning is on the record and it is correct: `deno` on the office machine exits with no
output and returns 0 from Git Bash, so a local check on Windows **cannot tell a pass from a
failure**. Everything below was run inside **WSL Ubuntu with deno 2.9.5**, using the *exact* command
`gate-edge-typecheck` runs.

> **53 counts TypeScript diagnostics, not files and not defects.** They come from **49 `.ts` files**
> under `supabase/functions`, and they concentrate in **13 files** — four of which carry 41 of the
> 53 between them.

## The 53, bucketed by CAUSE rather than by error code

| # | cause | count | real defect? |
|---|---|---|---|
| 1 | supabase-js client generic variance — `SupabaseClient<any,"public",any>` vs `SupabaseClient<unknown,never,GenericSchema>` where a `_shared` helper is typed against a differently-parameterised client | 14 | no |
| 2 | an embedded **to-one** relation typed as an array | 6 | no — see below |
| 3 | an untyped value (`unknown` / `{}`, from `await resp.json()` or an untyped row) passed into a typed slot | 26 | no |
| 4 | `PromiseSettledResult` not narrowed | 1 | no — see below |
| 5 | esm.sh module interop: `jszip` bundled `.d.ts` declares no default export | 2 | no |
| 6 | property read off an untyped `{}` (`company-lookup` `.label` / `.description`) | 2 | no |
| 7 | pdfjs `TextItem \| TextMarkedContent` union narrowed to `{ str?: string }`, already handled with `?? ''` | 1 | no |
| 8 | **`.catch()` on a Postgrest query builder** | **1** | **YES — fixed** |
|   | **total** | **53** | |

### Why class 2 is noise, checked rather than assumed

Six `TS2352` errors say a cast like
`doc?.benchmark_rules as { created_by: string | null } | null` is wrong because the value is
`{ created_by: any }[]` — an array. That looks exactly like "a cast that lies about the shape the
database returns", which would be a real defect.

**It is the compiler that is wrong, and the schema proves it.**
`benchmark_documents.benchmark_rule_id` is declared
`uuid NOT NULL REFERENCES public.benchmark_rules(id) ON DELETE CASCADE`
(`supabase/migrations/20260504300000_benchmark_documents.sql:36`). That is a **many-to-one** foreign
key, and PostgREST embeds a to-one relation as a **single object**, not an array. The client is typed
`SupabaseClient<any, "public", any>` — this project has no generated database types — so
supabase-js's select-string parser cannot know the cardinality and defaults every embed to an array.
The developer's `as` is telling the compiler the truth. Removing these casts would break working
code.

### Why class 4 is noise

`scan-ir-page/index.ts:622` reads
`fileSizes[i].status === 'fulfilled' ? fileSizes[i].value : null`. The guard **is already there**.
TypeScript simply cannot narrow through a repeated index expression (`fileSizes[i]` is a fresh
expression each time). Correct code the compiler cannot see is correct.

## The one real defect — `fetch-company-news`, and it was costing money

```ts
await admin.from('api_request_logs').insert({ ... }).catch(() => {})   // BEFORE
```

`TS2551: Property 'catch' does not exist on type 'PostgrestFilterBuilder<...>'. Did you mean 'match'?`

A Postgrest query builder is a **thenable, not a Promise**: it implements `then` and nothing else.
Verified at runtime against the exact imported version rather than reasoned about — a probe script
importing `@supabase/supabase-js@2.49.4` reports:

```
typeof builder.then    : function
typeof builder.catch   : undefined
typeof builder.finally : undefined
```

So `.catch(...)` threw a `TypeError` **synchronously, before the `await`**. `fetchFromIrPage` wraps
its whole body in `try { ... } catch (err) { console.error(...); return 0 }`, so the throw was caught
by the function's own handler and reported as a generic *"IR page fetch error"*.

**The consequence.** The throw sits immediately after a **successful, paid Firecrawl scrape**
(`api.firecrawl.dev/v1/scrape`) and immediately before the Gemini extraction. So on every IR-page
news source: we paid Firecrawl, received the markdown, and then discarded it without extracting a
single press release — returning `0` items, every time, silently. A line written to make logging
harmless was the thing breaking the feature.

**The fix.** Await it and read the error, because a builder *resolves* with `{ error }` rather than
rejecting — it could never have thrown for the reason the `.catch` was defending against:

```ts
const { error: usageLogError } = await admin.from('api_request_logs').insert({ ... })
if (usageLogError) console.error(`api_request_logs insert failed for ${source.source_name}:`, usageLogError.message)
```

`fetch-company-news/index.ts:213` was the **only** `.catch()` on a Postgrest builder in the whole
functions tree — the other eleven `.catch(...)` calls are on genuine Promises (`req.json()`,
`res.text()`, `fetch(...)`, async helpers) and are fine.

## Baseline lowered 53 → 52, in the same commit

That is the documented contract of this ratchet: when the count drops, the baseline drops with it so
the debt cannot grow back.

**Proven against the gate's own comparison logic, run in WSL:**

| scenario | result |
|---|---|
| count 52 vs committed baseline 52 | `type errors: 52 baseline: 52` → **GREEN** |
| count 52 vs a deliberately wrong baseline of 51 | `::error::type errors went UP: 51 -> 52` → **RED, exit 1** |
| `npm run lint` (CI runs lint before build) | exit 0 |

One honest nuance about the gate: a count **below** the baseline only emits a `::warning::`, it does
not fail. So lowering the baseline is a discipline the gate *asks for* and does not *enforce* — which
is exactly why it was done here in the same commit rather than left for later.

## What was deliberately not done

- **The other 52 were not "fixed".** Every one traces to the absence of generated Supabase types.
  The real remedy is to generate and commit `Database` types and type the client with them, which
  would retire classes 1, 2, 3 and 6 — **44 of the 53** — in one move. That is a substantial change
  to a customer-facing product and is its own piece of work, not a line item inside a triage.
- **Not promoted to production.** Valrano is customer-facing: this proves itself on staging and
  Roger promotes it himself.
