-- =============================================================================
-- Valrano — Allow authenticated users to create and update companies
-- Migration: 20260510100000_companies_insert_policy
--
-- Root cause: onboarding upload fails because useCreateMyCompany inserts into
-- companies table, but only service_role had INSERT permission.
-- =============================================================================

-- Allow authenticated users to INSERT new companies (needed for onboarding)
CREATE POLICY "companies_insert_authenticated"
  ON public.companies FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to UPDATE companies they own via my_companies
CREATE POLICY "companies_update_authenticated"
  ON public.companies FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT company_id FROM public.my_companies
      WHERE user_id = auth.uid() AND company_id IS NOT NULL
    )
  )
  WITH CHECK (
    id IN (
      SELECT company_id FROM public.my_companies
      WHERE user_id = auth.uid() AND company_id IS NOT NULL
    )
  );
