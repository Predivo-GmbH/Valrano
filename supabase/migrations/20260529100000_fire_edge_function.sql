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
  v_url text := 'https://mkdeftmubrkseyrrbzvp.supabase.co';
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rZGVmdG11YnJrc2V5cnJienZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MTIzODIsImV4cCI6MjA5Mzk4ODM4Mn0.lnNUslHt--2_GzOZFB_UH1mVd0bfGfWTnHIU3e7Umwc';
  v_headers jsonb;
  v_request_id bigint;
begin
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
