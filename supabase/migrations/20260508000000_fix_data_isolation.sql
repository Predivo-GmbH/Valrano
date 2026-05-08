-- =============================================================================
-- BenchmarkSignal — Fix Data Isolation (Multi-Tenancy)
-- Migration: 20260508000000_fix_data_isolation
--
-- Problem: reports, kpi_values, extractions, benchmark_rules, benchmark_documents,
-- monitor_checks, publication_events all had USING(true) or broken policies
-- referencing non-existent companies.user_id column.
--
-- Fix: Scope SELECT to companies in the user's peer groups.
-- A user sees data only for companies they've added to their peer groups.
-- New user with no peer groups = sees zero data.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper function: returns company IDs visible to the current user
-- (companies in any of their peer groups)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.visible_company_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT DISTINCT pgm.company_id
  FROM public.peer_group_members pgm
  JOIN public.peer_groups pg ON pg.id = pgm.peer_group_id
  WHERE pg.owner_id = auth.uid()
$$;

-- =============================================================================
-- 1. reports — scope SELECT to user's peer group companies
-- =============================================================================
DROP POLICY IF EXISTS "reports_select_authenticated" ON public.reports;
CREATE POLICY "reports_select_authenticated"
  ON public.reports FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.visible_company_ids()));

-- service_role INSERT/UPDATE unchanged (keep existing)

-- =============================================================================
-- 2. kpi_values — scope SELECT to user's peer group companies
-- =============================================================================
DROP POLICY IF EXISTS "kpi_values_select_authenticated" ON public.kpi_values;
CREATE POLICY "kpi_values_select_authenticated"
  ON public.kpi_values FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.visible_company_ids()));

-- =============================================================================
-- 3. extractions — scope SELECT via report's company
-- =============================================================================
DROP POLICY IF EXISTS "extractions_select_authenticated" ON public.extractions;
CREATE POLICY "extractions_select_authenticated"
  ON public.extractions FOR SELECT TO authenticated
  USING (
    report_id IN (
      SELECT r.id FROM public.reports r
      WHERE r.company_id IN (SELECT public.visible_company_ids())
    )
  );

-- =============================================================================
-- 4. benchmark_rules — scope SELECT to own rules only
-- =============================================================================
DROP POLICY IF EXISTS "benchmark_rules_select_authenticated" ON public.benchmark_rules;
CREATE POLICY "benchmark_rules_select_authenticated"
  ON public.benchmark_rules FOR SELECT TO authenticated
  USING (created_by = auth.uid());

-- INSERT/UPDATE/DELETE already scoped to created_by = auth.uid() (unchanged)

-- =============================================================================
-- 5. benchmark_documents — fix broken policies (companies.user_id doesn't exist)
--    Scope to documents where trigger or customer company is in user's peers
-- =============================================================================
DROP POLICY IF EXISTS "benchmark_documents_select_authenticated" ON public.benchmark_documents;
CREATE POLICY "benchmark_documents_select_authenticated"
  ON public.benchmark_documents FOR SELECT TO authenticated
  USING (
    customer_company_id IN (SELECT public.visible_company_ids())
    OR trigger_company_id IN (SELECT public.visible_company_ids())
  );

DROP POLICY IF EXISTS "benchmark_documents_update_authenticated" ON public.benchmark_documents;
CREATE POLICY "benchmark_documents_update_authenticated"
  ON public.benchmark_documents FOR UPDATE TO authenticated
  USING (customer_company_id IN (SELECT public.visible_company_ids()))
  WITH CHECK (customer_company_id IN (SELECT public.visible_company_ids()));

-- =============================================================================
-- 6. publication_events — fix broken policies (companies.user_id doesn't exist)
-- =============================================================================
DROP POLICY IF EXISTS "publication_events_select" ON public.publication_events;
DROP POLICY IF EXISTS "publication_events_insert" ON public.publication_events;
DROP POLICY IF EXISTS "publication_events_update" ON public.publication_events;
DROP POLICY IF EXISTS "publication_events_delete" ON public.publication_events;

CREATE POLICY "publication_events_select" ON public.publication_events
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.visible_company_ids()));

CREATE POLICY "publication_events_insert" ON public.publication_events
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT public.visible_company_ids()));

CREATE POLICY "publication_events_update" ON public.publication_events
  FOR UPDATE TO authenticated
  USING (company_id IN (SELECT public.visible_company_ids()))
  WITH CHECK (company_id IN (SELECT public.visible_company_ids()));

CREATE POLICY "publication_events_delete" ON public.publication_events
  FOR DELETE TO authenticated
  USING (company_id IN (SELECT public.visible_company_ids()));

-- =============================================================================
-- 7. monitor_checks — scope SELECT to user's peer group companies
-- =============================================================================
DROP POLICY IF EXISTS "monitor_checks_select" ON public.monitor_checks;
CREATE POLICY "monitor_checks_select" ON public.monitor_checks
  FOR SELECT TO authenticated
  USING (
    publication_event_id IN (
      SELECT pe.id FROM public.publication_events pe
      WHERE pe.company_id IN (SELECT public.visible_company_ids())
    )
  );

-- =============================================================================
-- 8. approval_steps — fix broken policies (companies.user_id doesn't exist)
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
      WHERE customer_company_id IN (SELECT public.visible_company_ids())
    )
  );

CREATE POLICY "approval_steps_insert_auth" ON public.approval_steps
  FOR INSERT TO authenticated
  WITH CHECK (
    document_id IN (
      SELECT id FROM public.benchmark_documents
      WHERE customer_company_id IN (SELECT public.visible_company_ids())
    )
  );

CREATE POLICY "approval_steps_update" ON public.approval_steps
  FOR UPDATE TO authenticated
  USING (
    assignee_id = auth.uid()
    OR document_id IN (
      SELECT id FROM public.benchmark_documents
      WHERE customer_company_id IN (SELECT public.visible_company_ids())
    )
  )
  WITH CHECK (
    assignee_id = auth.uid()
    OR document_id IN (
      SELECT id FROM public.benchmark_documents
      WHERE customer_company_id IN (SELECT public.visible_company_ids())
    )
  );

-- =============================================================================
-- 9. approval_comments — fix broken policies
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
           WHERE customer_company_id IN (SELECT public.visible_company_ids())
         )
    )
  );

CREATE POLICY "approval_comments_insert" ON public.approval_comments
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

-- =============================================================================
-- 10. companies — keep as shared reference (users need to search/browse to add peers)
-- kpi_definitions — keep as shared reference (taxonomy)
-- fx_rates — keep as shared reference
-- =============================================================================
-- No changes needed for these tables.

-- =============================================================================
-- Service role policies: add explicit service_role SELECT for edge functions
-- that need to read all data regardless of user context
-- =============================================================================
CREATE POLICY "reports_select_service_role" ON public.reports
  FOR SELECT TO service_role USING (true);

CREATE POLICY "kpi_values_select_service_role" ON public.kpi_values
  FOR SELECT TO service_role USING (true);

CREATE POLICY "extractions_select_service_role" ON public.extractions
  FOR SELECT TO service_role USING (true);

CREATE POLICY "benchmark_rules_select_service_role" ON public.benchmark_rules
  FOR SELECT TO service_role USING (true);

CREATE POLICY "benchmark_documents_select_service_role" ON public.benchmark_documents
  FOR SELECT TO service_role USING (true);

CREATE POLICY "publication_events_select_service_role" ON public.publication_events
  FOR SELECT TO service_role USING (true);

CREATE POLICY "monitor_checks_select_service_role" ON public.monitor_checks
  FOR SELECT TO service_role USING (true);
