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
DO $$ BEGIN
  CREATE POLICY "Users can read processing status for their reports"
    ON processing_status FOR SELECT
    USING (
      report_id IN (
        SELECT r.id FROM reports r
        JOIN my_companies mc ON mc.company_id = r.company_id
        WHERE mc.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Enable Realtime for this table
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE processing_status;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

create index if not exists idx_processing_status_report on processing_status(report_id, created_at);
