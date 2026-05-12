-- Real-time processing status for report analysis
-- Frontend subscribes via Supabase Realtime to show actual progress
create table if not exists processing_status (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  step text not null,          -- e.g. 'uploading_pdf', 'processing_file', 'analyzing', 'saving'
  status text not null,        -- 'in_progress', 'done', 'error'
  message text,                -- human-readable label for the UI
  created_at timestamptz not null default now()
);

alter table processing_status enable row level security;

-- Users can read their own processing status (via report ownership)
create policy "Users can read processing status for their reports"
  on processing_status for select
  using (
    report_id in (
      select r.id from reports r
      join my_companies mc on mc.company_id = r.company_id
      where mc.user_id = auth.uid()
    )
  );

-- Enable Realtime for this table
alter publication supabase_realtime add table processing_status;

create index idx_processing_status_report on processing_status(report_id, created_at);
