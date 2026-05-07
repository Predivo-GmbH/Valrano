-- =============================================================================
-- BenchmarkSignal — Security Fix: RLS scoping
-- Migration: 20260507200000_fix_rls_scoping
-- Fixes H1 (benchmark_documents UPDATE) and H2 (publication_events + approval tables)
-- =============================================================================

-- =============================================================================
-- H1: benchmark_documents — scope authenticated UPDATE to own company
-- =============================================================================
DROP POLICY IF EXISTS "benchmark_documents_update_authenticated" ON public.benchmark_documents;
CREATE POLICY "benchmark_documents_update_authenticated" ON public.benchmark_documents
  FOR UPDATE TO authenticated
  USING (customer_company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()))
  WITH CHECK (customer_company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

-- =============================================================================
-- H2: publication_events — scope to user's companies
-- =============================================================================
DROP POLICY IF EXISTS "publication_events_select" ON public.publication_events;
DROP POLICY IF EXISTS "publication_events_insert" ON public.publication_events;
DROP POLICY IF EXISTS "publication_events_update" ON public.publication_events;
DROP POLICY IF EXISTS "publication_events_delete" ON public.publication_events;

CREATE POLICY "publication_events_select" ON public.publication_events
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

CREATE POLICY "publication_events_insert" ON public.publication_events
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

CREATE POLICY "publication_events_update" ON public.publication_events
  FOR UPDATE TO authenticated
  USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

CREATE POLICY "publication_events_delete" ON public.publication_events
  FOR DELETE TO authenticated
  USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

-- =============================================================================
-- H2: approval_chains — scope to own user (created_by)
-- =============================================================================
DROP POLICY IF EXISTS "approval_chains_select" ON public.approval_chains;
DROP POLICY IF EXISTS "approval_chains_insert" ON public.approval_chains;
DROP POLICY IF EXISTS "approval_chains_update" ON public.approval_chains;
DROP POLICY IF EXISTS "approval_chains_delete" ON public.approval_chains;

CREATE POLICY "approval_chains_select" ON public.approval_chains
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "approval_chains_insert" ON public.approval_chains
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "approval_chains_update" ON public.approval_chains
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "approval_chains_delete" ON public.approval_chains
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- =============================================================================
-- H2: approval_steps — scope SELECT/UPDATE to assignee or document owner
-- =============================================================================
DROP POLICY IF EXISTS "approval_steps_select" ON public.approval_steps;
DROP POLICY IF EXISTS "approval_steps_insert_auth" ON public.approval_steps;
DROP POLICY IF EXISTS "approval_steps_update" ON public.approval_steps;

CREATE POLICY "approval_steps_select" ON public.approval_steps
  FOR SELECT TO authenticated
  USING (
    assignee_id = auth.uid()
    OR document_id IN (
      SELECT id FROM public.benchmark_documents
      WHERE customer_company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "approval_steps_insert_auth" ON public.approval_steps
  FOR INSERT TO authenticated
  WITH CHECK (
    document_id IN (
      SELECT id FROM public.benchmark_documents
      WHERE customer_company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "approval_steps_update" ON public.approval_steps
  FOR UPDATE TO authenticated
  USING (
    assignee_id = auth.uid()
    OR document_id IN (
      SELECT id FROM public.benchmark_documents
      WHERE customer_company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    assignee_id = auth.uid()
    OR document_id IN (
      SELECT id FROM public.benchmark_documents
      WHERE customer_company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    )
  );

-- =============================================================================
-- H2: approval_comments — scope to own comments or steps user can see
-- =============================================================================
DROP POLICY IF EXISTS "approval_comments_select" ON public.approval_comments;
DROP POLICY IF EXISTS "approval_comments_insert" ON public.approval_comments;

CREATE POLICY "approval_comments_select" ON public.approval_comments
  FOR SELECT TO authenticated
  USING (
    author_id = auth.uid()
    OR step_id IN (
      SELECT id FROM public.approval_steps
      WHERE assignee_id = auth.uid()
         OR document_id IN (
           SELECT id FROM public.benchmark_documents
           WHERE customer_company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
         )
    )
  );

CREATE POLICY "approval_comments_insert" ON public.approval_comments
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());
