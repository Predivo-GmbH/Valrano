-- A scheduled call says how long it is prepared to wait.
--
-- `net.http_post` takes `timeout_milliseconds` and DEFAULTS IT TO 5000. Neither of Valrano's
-- two pg_net callers passes it, so both have been giving the edge function five seconds to
-- answer and then hanging up. This file is Valrano's half of the fleet-wide change that
-- ReplyFlow shipped as migration 065, BackOffice as 173 and SignalScore as 039.
--
-- WHAT IS AT STAKE, precisely. Past the timeout pg_net DISCARDS the response. The dispatch is
-- still recorded as 'succeeded' in `cron.job_run_details` — that column only ever reported that
-- the call went out — so a job whose answer was thrown away is indistinguishable from a job that
-- worked. Measured on ReplyFlow production on 2026-09-02: 27 of 239 dispatched calls in six
-- hours, better than one in nine, carried pg_net's own `Timeout of 5000 ms reached`, and NOTHING
-- was actually failing — every answered call returned 200. What was lost was the evidence. It
-- cost two separate sessions a full diagnosis apiece before anyone read the `error_msg` column
-- that had been saying so all along.
--
-- The stake is higher on `handle_send_email` than on a monitor: it is the AUTH EMAIL relay. A
-- discarded response there means nobody can tell a sign-in code that was sent from one that was
-- not, for a real customer who is looking at an empty inbox.
--
-- WHY 60000. It must stay under the tightest interval or dispatches overlap, and the tightest
-- here is monitor-publications at 120s — so 60s is half the cadence at worst. Raising a timeout
-- cannot make a call fail that would otherwise have succeeded; it can only let an answer arrive
-- that was previously discarded.
--
-- BOTH CALLERS ARE CHANGED, not just the one that carries the risk. BackOffice migration 135
-- named four broken jobs and fixed only the fifth it was adding, and the four kept failing for
-- weeks. A default that is wrong for the busiest caller is wrong for the quiet one too — it has
-- simply not been slow yet.
--
-- Both definitions below are copied VERBATIM from the migrations that own them —
-- 20260903000000_handle_send_email_relay_secret.sql and 20260522000000_monitor_publications_cron.sql
-- — with one argument added to each. Same vault lookups, same headers, same schedule, same
-- guards: the secrets are still read at call time, so nothing is materialised into a function
-- body or into `cron.job.command`, which is the rule that stopped a service_role JWT being
-- readable from the catalogue on 2026-09-03. Diff this file against those two before changing
-- either.

-- ── the auth-email relay ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_send_email(event jsonb)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  base_url text;
  auth_key text;
  relay_secret text;
  hdrs jsonb;
  request_id bigint;
BEGIN
  SELECT decrypted_secret INTO base_url
    FROM vault.decrypted_secrets WHERE name = 'supabase_url';
  SELECT decrypted_secret INTO auth_key
    FROM vault.decrypted_secrets WHERE name = 'service_role_key';

  IF base_url IS NULL OR auth_key IS NULL THEN
    RAISE EXCEPTION 'handle_send_email: vault secrets supabase_url / service_role_key missing';
  END IF;

  -- Read at call time; never materialised into this function's source.
  SELECT decrypted_secret INTO relay_secret
    FROM vault.decrypted_secrets WHERE name = 'send_email_internal_secret';

  hdrs := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || auth_key
  );

  -- Only attach the header once the secret exists, so an unprovisioned environment behaves
  -- exactly as before rather than sending an empty credential.
  IF relay_secret IS NOT NULL AND length(relay_secret) > 0 THEN
    hdrs := hdrs || jsonb_build_object('x-send-email-secret', relay_secret);
  END IF;

  SELECT net.http_post(
    url := base_url || '/functions/v1/send-auth-email',
    headers := hdrs,
    body := event,
    timeout_milliseconds := 60000
  ) INTO request_id;

  RETURN event;
END;
$function$;

-- ── the two-minute publication monitor ──────────────────────────────────────
-- Same guard as the migration this is copied from: on an environment whose vault has not been
-- provisioned, the job is left alone entirely rather than re-scheduled without its credentials.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'supabase_url')
     AND EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'cron_secret') THEN
    PERFORM cron.unschedule('monitor-publications')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monitor-publications');
    PERFORM cron.schedule(
      'monitor-publications',
      '*/2 * * * *',
      $cron$
      SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/monitor-publications',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
      );
      $cron$
    );
  ELSE
    RAISE NOTICE 'vault secrets supabase_url/cron_secret missing - leaving monitor-publications alone';
  END IF;
END
$$;
