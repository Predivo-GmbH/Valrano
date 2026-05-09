-- =============================================================================
-- Fix circular RLS dependency on workspaces / workspace_members
--
-- Problem: workspace_select references workspace_members, and
-- workspace_members_select references workspaces. PostgreSQL applies RLS
-- to sub-selects in policies, creating a circular dependency that returns
-- empty results for authenticated users.
--
-- Fix: SECURITY DEFINER helper function that bypasses RLS.
-- =============================================================================

-- Helper: returns all workspace_ids the current user belongs to
CREATE OR REPLACE FUNCTION public.user_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
$$;

-- Drop and recreate workspace policies using the helper
DROP POLICY IF EXISTS "workspace_select" ON public.workspaces;
CREATE POLICY "workspace_select" ON public.workspaces
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR id IN (SELECT public.user_workspace_ids())
  );

-- Drop and recreate workspace_members policies using the helper
DROP POLICY IF EXISTS "workspace_members_select" ON public.workspace_members;
CREATE POLICY "workspace_members_select" ON public.workspace_members
  FOR SELECT TO authenticated
  USING (
    workspace_id IN (SELECT public.user_workspace_ids())
  );

DROP POLICY IF EXISTS "workspace_members_insert" ON public.workspace_members;
CREATE POLICY "workspace_members_insert" ON public.workspace_members
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IN (
      SELECT ws.id FROM public.workspaces ws WHERE ws.owner_id = auth.uid()
    )
    OR workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid() AND wm.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "workspace_members_update" ON public.workspace_members;
CREATE POLICY "workspace_members_update" ON public.workspace_members
  FOR UPDATE TO authenticated
  USING (
    workspace_id IN (
      SELECT ws.id FROM public.workspaces ws WHERE ws.owner_id = auth.uid()
    )
    OR workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid() AND wm.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "workspace_members_delete" ON public.workspace_members;
CREATE POLICY "workspace_members_delete" ON public.workspace_members
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR workspace_id IN (
      SELECT ws.id FROM public.workspaces ws WHERE ws.owner_id = auth.uid()
    )
    OR workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid() AND wm.role = 'admin'
    )
  );
