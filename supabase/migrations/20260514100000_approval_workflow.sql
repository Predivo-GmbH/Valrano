-- ---------------------------------------------------------------------------
-- Approval Workflow: add reviewer role + audit trail for benchmark documents
-- ---------------------------------------------------------------------------

-- 1. Add 'reviewer' role to workspace_members
ALTER TABLE public.workspace_members
  DROP CONSTRAINT IF EXISTS workspace_members_role_check;

ALTER TABLE public.workspace_members
  ADD CONSTRAINT workspace_members_role_check
  CHECK (role IN ('admin', 'editor', 'viewer', 'reviewer'));

-- 2. Add audit trail columns to benchmark_documents
ALTER TABLE public.benchmark_documents
  ADD COLUMN IF NOT EXISTS status_changed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_notes text;

-- 3. Status change audit log
CREATE TABLE IF NOT EXISTS public.document_status_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     uuid        NOT NULL REFERENCES public.benchmark_documents(id) ON DELETE CASCADE,
  from_status     text        NOT NULL,
  to_status       text        NOT NULL,
  changed_by      uuid        NOT NULL REFERENCES auth.users(id),
  notes           text,
  created_at      timestamptz DEFAULT now() NOT NULL
);

-- Index for fast lookup by document
CREATE INDEX IF NOT EXISTS idx_document_status_log_document_id
  ON public.document_status_log(document_id);

-- RLS
ALTER TABLE public.document_status_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "document_status_log_select" ON public.document_status_log
    FOR SELECT TO authenticated
    USING (
      document_id IN (
        SELECT id FROM public.benchmark_documents
        WHERE customer_company_id IN (
          SELECT visible_company_ids_for_user(auth.uid())
        )
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "document_status_log_insert" ON public.document_status_log
    FOR INSERT TO authenticated
    WITH CHECK (changed_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
