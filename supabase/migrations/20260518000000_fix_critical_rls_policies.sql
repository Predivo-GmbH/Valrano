-- =============================================================================
-- Valrano — Fix Critical RLS Policies (S-1, S-2)
-- Migration: 20260518000000_fix_critical_rls_policies
--
-- S-1: google_connections OAuth tokens exposed via broad FOR ALL policy
-- S-2: companies INSERT policy too permissive (WITH CHECK(true))
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- S-1: google_connections — replace single FOR ALL policy with explicit
-- per-operation policies scoped to auth.uid() = user_id
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can CRUD own google connections" ON public.google_connections;

CREATE POLICY "google_connections_select_own"
  ON public.google_connections FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "google_connections_insert_own"
  ON public.google_connections FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "google_connections_update_own"
  ON public.google_connections FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "google_connections_delete_own"
  ON public.google_connections FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- S-2: companies INSERT — replace WITH CHECK(true) with created_by scoping
--
-- Step 1: Add created_by column (nullable for existing rows)
-- Step 2: Drop the permissive INSERT policy
-- Step 3: Create a scoped INSERT policy requiring created_by = auth.uid()
-- Step 4: Tighten UPDATE policy to also require created_by ownership
-- ─────────────────────────────────────────────────────────────────────────────

-- Add created_by column to track who created each company
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Backfill created_by for companies already linked via my_companies
UPDATE public.companies c
SET created_by = mc.user_id
FROM public.my_companies mc
WHERE mc.company_id = c.id
  AND c.created_by IS NULL;

-- Drop the overly permissive INSERT policy
DROP POLICY IF EXISTS "companies_insert_authenticated" ON public.companies;

-- New INSERT policy: user can only insert companies they own
CREATE POLICY "companies_insert_own"
  ON public.companies FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Drop and recreate UPDATE policy to also check created_by
-- (keeps my_companies fallback for rows created before this migration)
DROP POLICY IF EXISTS "companies_update_authenticated" ON public.companies;

CREATE POLICY "companies_update_own"
  ON public.companies FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR id IN (
      SELECT company_id FROM public.my_companies
      WHERE user_id = auth.uid() AND company_id IS NOT NULL
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR id IN (
      SELECT company_id FROM public.my_companies
      WHERE user_id = auth.uid() AND company_id IS NOT NULL
    )
  );

-- Index for created_by lookups
CREATE INDEX IF NOT EXISTS idx_companies_created_by ON public.companies(created_by);

-- ─────────────────────────────────────────────────────────────────────────────
-- S-5: document_status_log — fix RLS policy referencing revoked/non-existent function
--
-- Drop any existing policies on document_status_log that may reference
-- a non-existent function, then create clean ownership-based policies.
-- Users can SELECT/INSERT logs for documents they own.
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop all existing policies on document_status_log to start clean
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'document_status_log' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.document_status_log', pol.policyname);
  END LOOP;
END
$$;

-- Enable RLS (idempotent)
ALTER TABLE public.document_status_log ENABLE ROW LEVEL SECURITY;

-- SELECT: users can view logs for documents they own
CREATE POLICY "document_status_log_select_own"
  ON public.document_status_log FOR SELECT
  TO authenticated
  USING (
    document_id IN (
      SELECT id FROM public.documents
      WHERE user_id = auth.uid()
    )
  );

-- INSERT: users can insert logs for documents they own
CREATE POLICY "document_status_log_insert_own"
  ON public.document_status_log FOR INSERT
  TO authenticated
  WITH CHECK (
    document_id IN (
      SELECT id FROM public.documents
      WHERE user_id = auth.uid()
    )
  );
