-- =============================================================================
-- Valrano — Add DELETE policy for reports table
-- Migration: 20260518100000_reports_delete_policy
--
-- Bug: Users could not delete reports from Settings > My Company page.
-- Root cause: No DELETE RLS policy existed on the reports table.
-- Supabase silently returns success with 0 rows affected when RLS blocks.
-- =============================================================================

-- Users can delete reports for companies they own via my_companies
CREATE POLICY "reports_delete_own_company"
  ON public.reports FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.my_companies
      WHERE user_id = auth.uid() AND company_id IS NOT NULL
    )
  );
