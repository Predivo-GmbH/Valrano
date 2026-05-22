-- =============================================================================
-- Valrano — pg_cron job for monitor-publications
-- Replaces: .github/workflows/monitor-cron.yml (GitHub Actions cron)
-- Schedule: every 2 minutes (same as the workflow it replaces)
-- Auth: x-cron-secret header (matches monitor-publications edge function)
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule monitor-publications every 2 minutes
SELECT cron.schedule(
  'monitor-publications',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/monitor-publications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
