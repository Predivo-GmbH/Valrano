-- Enable pg_net extension for async HTTP requests from Postgres
create extension if not exists pg_net with schema extensions;

-- Helper function: fire an edge function asynchronously via pg_net
-- Returns immediately; the HTTP request runs in the background.
create or replace function public.fire_edge_function(
  p_function_name text,
  p_body jsonb default '{}'::jsonb,
  p_auth_token text default null
)
returns bigint
language plpgsql
security definer
as $$
declare
  -- Env-aware since 2026-08-21 (drift fix): this file previously hardcoded the PROD
  -- URL + prod anon key, so applying it to staging silently wired staging to prod.
  -- Both now come from the vault (supabase_url / anon_key), per-env.
  v_url text;
  v_anon_key text;
  v_headers jsonb;
  v_request_id bigint;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'supabase_url';
  select decrypted_secret into v_anon_key from vault.decrypted_secrets where name = 'anon_key';
  if v_url is null or v_anon_key is null then
    raise exception 'fire_edge_function: vault secrets supabase_url/anon_key not configured for this environment';
  end if;
  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || coalesce(p_auth_token, v_anon_key)
  );

  select net.http_post(
    url := v_url || '/functions/v1/' || p_function_name,
    headers := v_headers,
    body := p_body
  ) into v_request_id;

  return v_request_id;
end;
$$;
