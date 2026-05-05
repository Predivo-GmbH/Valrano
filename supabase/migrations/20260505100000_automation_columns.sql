-- =============================================================================
-- BenchmarkSignal — Automation Columns
-- Migration: 20260505100000_automation_columns
-- Adds columns needed for full automation pipeline
-- =============================================================================

-- publication_events: last_checked_at for smart monitoring
ALTER TABLE public.publication_events
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_pipeline boolean DEFAULT true NOT NULL;

-- Add 'stale' and 'delivered' to publication_events status CHECK
ALTER TABLE public.publication_events
  DROP CONSTRAINT IF EXISTS publication_events_status_check;

ALTER TABLE public.publication_events
  ADD CONSTRAINT publication_events_status_check
  CHECK (status IN ('scheduled', 'due_today', 'overdue', 'detected', 'ingested', 'benchmark_ready', 'stale', 'delivered', 'cancelled'));

-- benchmark_documents: pdf_storage_path and delivered_at
ALTER TABLE public.benchmark_documents
  ADD COLUMN IF NOT EXISTS pdf_storage_path text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

-- Add 'delivered' to benchmark_documents status CHECK
ALTER TABLE public.benchmark_documents
  DROP CONSTRAINT IF EXISTS benchmark_documents_status_check;

ALTER TABLE public.benchmark_documents
  ADD CONSTRAINT benchmark_documents_status_check
  CHECK (status IN ('draft', 'in_review', 'approved', 'rejected', 'delivered'));

-- benchmark_rules: delivery_recipients array for auto-delivery
ALTER TABLE public.benchmark_rules
  ADD COLUMN IF NOT EXISTS delivery_recipients text[] DEFAULT '{}';

-- Index for efficient monitoring queries
CREATE INDEX IF NOT EXISTS idx_publication_events_monitoring
  ON public.publication_events (status, expected_date, last_checked_at)
  WHERE status IN ('scheduled', 'due_today', 'overdue');

-- Add 'document_delivered' to notifications type if not present (already in original CHECK)
-- No change needed — already included in the original migration
