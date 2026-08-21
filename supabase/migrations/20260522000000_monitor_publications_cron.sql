-- =============================================================================
-- Valrano — pg_cron job for monitor-publications
-- Replaces: .github/workflows/monitor-cron.yml (GitHub Actions cron)
-- Schedule: every 2 minutes (same as the workflow it replaces)
-- Auth: x-cron-secret header (matches monitor-publications edge function)
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule monitor-publications every 2 minutes.
-- Guarded + idempotent (2026-08-21, drift fix): skips with NOTICE when the vault
-- secrets are absent (fresh env), and unschedules any prior job so a re-run
-- never duplicates or errors.
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
        body := '{}'::jsonb
      );
      $cron$
    );
  ELSE
    RAISE NOTICE 'vault secrets supabase_url/cron_secret missing - skipping monitor-publications schedule';
  END IF;
END
$$;
