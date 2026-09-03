-- handle_send_email — send the internal shared secret to send-auth-email.
--
-- WHY (fleet:send-auth-email:unauthenticated-relay): the send-auth-email edge function used to
-- verify a Standard-Webhooks signature ONLY when one was present. This relay is a Postgres hook
-- called through pg_net with no signature at all, so "no signature" meant "no check", and any
-- holder of the public website key could POST a crafted payload and make the product mail a
-- login / password-reset code to an address of their choosing. Measured on production on
-- 2026-09-03: an unauthenticated POST of `{}` answered 400 "No email in payload" — a complaint
-- about the BODY, which is only reached after authentication. The edge function now accepts
-- EITHER a valid signature OR an internal shared secret in `x-send-email-secret`, with
-- enforcement gated on its own SEND_EMAIL_INTERNAL_SECRET env var being set.
--
-- THIS MIGRATION IS THE DATABASE HALF, AND IT MUST BE LIVE BEFORE THAT ENV VAR IS SET.
-- Rollout order (getting it wrong takes auth email down for real customers):
--   1. vault.supabase_url + vault.service_role_key → this function has something to read
--   2. this migration            → relay is ready to send the header
--   3. deploy the edge function  → still inert, env var unset, nothing changes
--   4. vault.send_email_internal_secret → the relay starts sending the header
--   5. SEND_EMAIL_INTERNAL_SECRET on the edge function → enforcement turns on, header already flowing
--
-- STEP 1 IS ALREADY DONE ON BOTH ENVIRONMENTS (2026-09-03). On PRODUCTION the two values were
-- copied INSIDE the database out of this function's own previous body — it had them hard-coded —
-- and the copy was proven byte-equal to the inlined originals without any value being displayed.
-- If you re-provision, re-seed before applying this file or the relay will RAISE.
--
-- THE SECRET IS READ FROM VAULT AT CALL TIME AND IS NEVER WRITTEN INTO THIS FUNCTION BODY.
-- Do not "simplify" this by inlining the value: a function body is readable by anything that can
-- introspect the catalogue, and doing exactly that leaked a sibling product's live production
-- secret into a transcript on 2026-09-02. THE PREVIOUS DEFINITION OF THIS FUNCTION ON PRODUCTION
-- DID EXACTLY THAT — measured 2026-09-03, `pg_get_functiondef` contained a service_role JWT — so
-- this migration also removes a hard-coded key from the catalogue.
--
-- The header is OMITTED when the Vault secret is absent, so this migration is a no-op on any
-- environment that has not been provisioned yet (and on a fresh `supabase db reset`, where Vault
-- contents are DATA and do not survive).
--
-- Modelled verbatim on ChannelMover/supabase/migrations/20260903_001_handle_send_email_relay_secret.sql.
-- Diff the two before changing either.

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
    body := event
  ) INTO request_id;

  RETURN event;
END;
$function$;
