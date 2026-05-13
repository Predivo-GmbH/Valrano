-- Track external API calls for usage monitoring (queried cross-project by BackOffice)
create table if not exists api_request_logs (
  id uuid primary key default gen_random_uuid(),
  service text not null,          -- e.g. 'brandfetch'
  endpoint text,                  -- e.g. '/v2/search'
  call_count int not null default 1,
  user_id uuid references auth.users(id),
  edge_function text,             -- e.g. 'suggest-competitors'
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

alter table api_request_logs enable row level security;

-- No user-facing RLS needed — only accessed via service role from BackOffice
create index idx_api_request_logs_service_created on api_request_logs(service, created_at);
