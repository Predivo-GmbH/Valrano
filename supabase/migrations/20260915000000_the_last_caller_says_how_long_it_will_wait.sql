-- ─────────────────────────────────────────────────────────────────────────────
-- 20260915000000_the_last_caller_says_how_long_it_will_wait.sql
--
-- THE ONE HTTP CALLER LEFT ON THIS DATABASE THAT STILL THROWS THE ANSWER AWAY.
--
-- `net.http_post` takes `timeout_milliseconds` and DEFAULTS IT TO 5000. Past that, pg_net stops
-- listening and discards the response — and the call returns a request id the moment it is
-- DISPATCHED, so the caller sees success whatever happens afterwards. A slow answer and a fast one
-- are indistinguishable from inside the database.
--
-- Migration 20260909200000 fixed Valrano's cron job command and `monitor-publications`, and set
-- this database's number at `timeout_milliseconds := 60000`. It did not fix
-- `public.fire_edge_function`, which dispatches HTTP OUTSIDE pg_cron and is therefore invisible to
-- the fleet heartbeat: the heartbeat reads `cron.job_run_details`, so a function nobody schedules
-- never appears in it. That is the whole reason this one was missed — and it is the THIRD time in
-- the fleet the same shape has been missed for the same reason:
--
--     ChannelMover 20260914120000  header says "ALL FOUR CALLERS ARE CHANGED" — there were five
--     BackOffice   173             fixed the three cron jobs, left handle_send_email
--     Valrano      20260909200000  fixed the cron job, left fire_edge_function   <- this file
--
-- MEASURED 2026-09-14 across all six production databases, read-only through the Management API
-- with a `select 1` canary answering first on each so a zero means "nothing matched" and not
-- "nothing answered": 27 pg_net callers, of which exactly two had no timeout — BackOffice's
-- `public.handle_send_email` and this one. Valrano is NOT failing: 188 HTTP calls in the retained
-- window, 0 with no answer. This closes a LATENT fault, not a live outage.
--
-- ══ WHY THIS FILE REWRITES THE LIVE BODY INSTEAD OF DECLARING A NEW ONE ══════════════════════
--
-- The obvious way to write this is `CREATE OR REPLACE FUNCTION` with the body copied out of
-- `20260529100000_fire_edge_function.sql` and one argument added. That is exactly how Cockpit's
-- sql/153 silently reverted sql/151 for nine deploys: a re-declared function body is a silent
-- revert of every change made to that function since the copy was taken, and nothing anywhere
-- reports it. The rule that came out of it is that the body must be taken from
-- `pg_get_functiondef` ON THE DATABASE BEING MIGRATED — never from a repo copy.
--
-- This file obeys that rule literally: it reads the live definition AT MIGRATION TIME, inserts one
-- named argument into the one `net.http_post` call, and proves — before executing anything — that
-- the ONLY difference between the new text and the live text is that argument. If the function
-- has drifted from what this file expects, every check below RAISES rather than guessing, so the
-- deploy stops instead of half-rewriting a live function.
--
-- It is also idempotent and self-skipping: a database that already states a timeout is left alone.
--
-- 60000, not some third opinion: it is the number migration 20260909200000 already chose for this
-- database, and it is what ReplyFlow (065) and ChannelMover's relay use for the same shape.
-- ─────────────────────────────────────────────────────────────────────────────

DO $migration$
DECLARE
  n_defs    int;
  live_def  text;
  new_def   text;
  n_post    int;
  n_timeout int;
  ADDITION  constant text := ', timeout_milliseconds := 60000';
BEGIN
  -- ── 1. exactly one function by this name, or stop ─────────────────────────────────────────
  SELECT count(*) INTO n_defs
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'fire_edge_function' AND p.prokind = 'f';

  IF n_defs = 0 THEN
    RAISE EXCEPTION
      '20260915000000: public.fire_edge_function does not exist on this database. It is created by '
      '20260529100000_fire_edge_function.sql; this migration rewrites it and cannot run before it.';
  END IF;
  IF n_defs > 1 THEN
    RAISE EXCEPTION
      '20260915000000: public.fire_edge_function has % overloads. This migration rewrites exactly '
      'one definition and will not guess which; fix the overloads or narrow this file by signature.',
      n_defs;
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO live_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'fire_edge_function' AND p.prokind = 'f';

  -- ── 2. already done? then do nothing, and say so ──────────────────────────────────────────
  IF live_def ILIKE '%timeout_milliseconds%' THEN
    RAISE NOTICE
      '20260915000000: public.fire_edge_function already states a timeout — nothing to do.';
    RETURN;
  END IF;

  -- ── 3. the live body must be the shape this edit understands ──────────────────────────────
  n_post := (length(live_def) - length(replace(lower(live_def), 'net.http_post', '')))
            / length('net.http_post');
  IF n_post <> 1 THEN
    RAISE EXCEPTION
      '20260915000000: expected exactly one net.http_post call in public.fire_edge_function, found '
      '%. The function has changed shape since this migration was written — read it and rewrite '
      'this file rather than letting it guess.', n_post;
  END IF;

  -- The insert goes immediately before the closing parenthesis of the call, which is anchored on
  -- the `) into` that follows it. Nothing else in the text is touched — no whitespace is
  -- restructured — so the assertion in step 4 can be an exact inverse.
  new_def := regexp_replace(
    live_def,
    '(net\.http_post[^;]*?)(\)\s*into\s)',
    '\1' || ADDITION || '\2',
    'i'
  );

  IF new_def = live_def THEN
    RAISE EXCEPTION
      '20260915000000: could not locate the `net.http_post( ... ) into` shape in the live '
      'definition of public.fire_edge_function, so nothing was changed. Read the live body and '
      'rewrite this file.';
  END IF;

  -- ── 4. THE ONLY DIFFERENCE IS THE ARGUMENT. Strip it back out and the text must be identical.
  IF replace(new_def, ADDITION, '') <> live_def THEN
    RAISE EXCEPTION
      '20260915000000: the rewrite changed something other than the added argument. Refusing to '
      'replace a live function on a guess.';
  END IF;

  n_timeout := (length(new_def) - length(replace(new_def, 'timeout_milliseconds', '')))
               / length('timeout_milliseconds');
  IF n_timeout <> 1 THEN
    RAISE EXCEPTION
      '20260915000000: the rewrite added % timeout arguments, expected exactly 1.', n_timeout;
  END IF;

  EXECUTE new_def;

  RAISE NOTICE
    '20260915000000: public.fire_edge_function now states timeout_milliseconds := 60000 '
    '(was pg_net''s 5000 ms default).';
END
$migration$;

-- ── This file proves its OWN claim, and only warns about anybody else's ──────────────────────
--
-- TWO CHECKS, AND THE DIFFERENCE BETWEEN THEM IS DELIBERATE.
--
-- The first RAISES: `public.fire_edge_function` — the one function this migration exists to change
-- — must actually state a timeout when this file is finished. That is this migration's own claim
-- about its own work, it is true or false on whatever database is running it, and if it is false
-- the migration failed and the deploy must stop. "It ran" is not "it took effect".
--
-- The second only WARNS, which is what BackOffice 173 did. A fleet-wide sweep raised to an
-- EXCEPTION would fail the deploy on any environment holding an http_post caller nobody could see
-- beforehand — and the machine that wrote this file cannot read THIS database at all (both of its
-- Supabase management tokens answer HTTP 403 on this project), let alone whatever staging
-- environment the migration passes through first. A hard stop on a predicate nobody can verify is
-- a deploy that fails for a reason nobody can reproduce. Enforcing the fleet-wide rule is a
-- monitor's job, where a finding becomes a work row somebody owns; a migration's job is to be
-- right about the change it makes.
DO $verify$
DECLARE
  has_timeout boolean;
  missed_fns  text;
BEGIN
  SELECT (p.prosrc ILIKE '%timeout_milliseconds%') INTO has_timeout
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'fire_edge_function' AND p.prokind = 'f';

  IF has_timeout IS NULL THEN
    RAISE EXCEPTION
      '20260915000000: public.fire_edge_function does not exist after this migration ran.';
  END IF;
  IF NOT has_timeout THEN
    RAISE EXCEPTION
      '20260915000000: public.fire_edge_function still does not state a timeout after this '
      'migration ran, so its answers are still discarded after 5000 ms. The rewrite did not take '
      'effect.';
  END IF;

  SELECT string_agg(n.nspname || '.' || p.proname, ', ' ORDER BY n.nspname, p.proname)
    INTO missed_fns
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'net', 'cron', 'extensions', 'vault', 'graphql')
     AND p.prosrc ILIKE '%net.http_post%'
     AND p.prosrc NOT ILIKE '%timeout_milliseconds%';

  IF missed_fns IS NOT NULL THEN
    RAISE WARNING
      '20260915000000: these functions dispatch HTTP without stating a timeout, so their answers '
      'are discarded after 5000 ms: %', missed_fns;
  ELSE
    RAISE NOTICE
      '20260915000000: every function on this database that dispatches HTTP now states how long it '
      'will wait.';
  END IF;
END
$verify$;
