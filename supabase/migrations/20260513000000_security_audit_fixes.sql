-- =============================================================================
-- Valrano — Security Audit Fixes (2026-05-13)
-- Fixes: C1, C2, C3, H1, H4 from the 6-domain security audit
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- C1: Guard lookup_user_by_email — require caller to be workspace admin/owner
-- Previously: any authenticated user could enumerate emails + get UUIDs
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.lookup_user_by_email(email_input text)
RETURNS TABLE(id uuid)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT au.id
  FROM auth.users au
  WHERE au.email = lower(trim(email_input))
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      JOIN workspaces ws ON ws.id = wm.workspace_id
      WHERE (wm.user_id = auth.uid() AND wm.role = 'admin')
         OR ws.owner_id = auth.uid()
    )
  LIMIT 1
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- C2: Restrict visible_company_ids_for_user to service_role only
-- Previously: any authenticated user could pass arbitrary user_id
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.visible_company_ids_for_user(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $fn$
  SELECT DISTINCT company_id FROM (
    SELECT pgm.company_id
    FROM public.peer_group_members pgm
    JOIN public.peer_groups pg ON pg.id = pgm.peer_group_id
    WHERE pg.owner_id = p_user_id
    UNION
    SELECT mc.company_id
    FROM public.my_companies mc
    WHERE mc.user_id = p_user_id
      AND mc.company_id IS NOT NULL
  ) sub
$fn$;

REVOKE EXECUTE ON FUNCTION public.visible_company_ids_for_user(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.visible_company_ids_for_user(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.visible_company_ids_for_user(uuid) FROM public;

-- ─────────────────────────────────────────────────────────────────────────────
-- C3: Fix notifications INSERT — scope to own user_id
-- Previously: WITH CHECK(true) let any user insert notifications for any user
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "notifications_insert_auth" ON public.notifications;
CREATE POLICY "notifications_insert_auth" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- H1: Add search_path to all SECURITY DEFINER functions
-- Prevents search_path hijacking attacks
-- ─────────────────────────────────────────────────────────────────────────────

-- visible_company_ids()
CREATE OR REPLACE FUNCTION public.visible_company_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $fn$
  SELECT DISTINCT company_id FROM (
    SELECT pgm.company_id
    FROM public.peer_group_members pgm
    JOIN public.peer_groups pg ON pg.id = pgm.peer_group_id
    WHERE (pg.owner_id = auth.uid() AND pg.workspace_id IS NULL)
       OR pg.workspace_id IN (
            SELECT wm.workspace_id
            FROM public.workspace_members wm
            WHERE wm.user_id = auth.uid()
          )
    UNION
    SELECT mc.company_id
    FROM public.my_companies mc
    WHERE mc.user_id = auth.uid()
      AND mc.company_id IS NOT NULL
  ) sub
$fn$;

-- user_workspace_ids()
CREATE OR REPLACE FUNCTION public.user_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
$$;

-- handle_new_user()
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $body$
DECLARE
  ws_id uuid;
BEGIN
  INSERT INTO public.user_profiles (id) VALUES (NEW.id);
  INSERT INTO public.workspaces (name, slug, owner_id)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)) || '''s Workspace',
    NEW.id::text,
    NEW.id
  )
  RETURNING id INTO ws_id;
  INSERT INTO public.workspace_members (workspace_id, user_id, role, accepted_at)
  VALUES (ws_id, NEW.id, 'admin', now());
  RETURN NEW;
END;
$body$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- handle_new_subscription()
CREATE OR REPLACE FUNCTION public.handle_new_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, tier, status)
  VALUES (NEW.id, 'starter', 'active')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ─────────────────────────────────────────────────────────────────────────────
-- H4: Fix monitor_checks INSERT — scope to visible publication events
-- Previously: WITH CHECK(true) let any user insert for any event
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "monitor_checks_insert_auth" ON public.monitor_checks;
CREATE POLICY "monitor_checks_insert_auth" ON public.monitor_checks
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.publication_events pe
      WHERE pe.id = publication_event_id
        AND pe.company_id IN (SELECT visible_company_ids())
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- M6: Fix workspace_members INSERT/UPDATE/DELETE circular RLS
-- Use user_workspace_ids() helper instead of self-referencing sub-queries
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "workspace_members_insert" ON public.workspace_members;
CREATE POLICY "workspace_members_insert" ON public.workspace_members
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IN (SELECT ws.id FROM public.workspaces ws WHERE ws.owner_id = auth.uid())
    OR (
      workspace_id IN (SELECT public.user_workspace_ids())
      AND EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = workspace_members.workspace_id
          AND wm.user_id = auth.uid() AND wm.role = 'admin'
      )
    )
  );

DROP POLICY IF EXISTS "workspace_members_update" ON public.workspace_members;
CREATE POLICY "workspace_members_update" ON public.workspace_members
  FOR UPDATE TO authenticated
  USING (
    workspace_id IN (SELECT ws.id FROM public.workspaces ws WHERE ws.owner_id = auth.uid())
    OR (
      workspace_id IN (SELECT public.user_workspace_ids())
      AND EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = workspace_members.workspace_id
          AND wm.user_id = auth.uid() AND wm.role = 'admin'
      )
    )
  );

DROP POLICY IF EXISTS "workspace_members_delete" ON public.workspace_members;
CREATE POLICY "workspace_members_delete" ON public.workspace_members
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR workspace_id IN (SELECT ws.id FROM public.workspaces ws WHERE ws.owner_id = auth.uid())
    OR (
      workspace_id IN (SELECT public.user_workspace_ids())
      AND EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = workspace_members.workspace_id
          AND wm.user_id = auth.uid() AND wm.role = 'admin'
      )
    )
  );
