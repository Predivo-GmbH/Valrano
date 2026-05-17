-- =============================================================================
-- Valrano — Workspaces (Team Access)
-- Migration: 20260508100000_workspaces
--
-- Adds workspace-based sharing so multiple users can collaborate on
-- the same peer groups, reports, and benchmarks.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table: workspaces
-- ---------------------------------------------------------------------------
CREATE TABLE public.workspaces (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  slug       text        UNIQUE,
  owner_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER trg_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Table: workspace_members
-- ---------------------------------------------------------------------------
CREATE TABLE public.workspace_members (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         text        NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
  invited_by   uuid        REFERENCES auth.users(id),
  invited_at   timestamptz DEFAULT now(),
  accepted_at  timestamptz,
  created_at   timestamptz DEFAULT now() NOT NULL,
  UNIQUE(workspace_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX idx_workspaces_owner ON public.workspaces(owner_id);
CREATE INDEX idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX idx_workspace_members_workspace ON public.workspace_members(workspace_id);

-- ---------------------------------------------------------------------------
-- Add workspace_id to peer_groups (nullable for backward compat)
-- ---------------------------------------------------------------------------
ALTER TABLE public.peer_groups ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;
CREATE INDEX idx_peer_groups_workspace ON public.peer_groups(workspace_id);

-- ---------------------------------------------------------------------------
-- Add workspace_id to benchmark_rules (nullable for backward compat)
-- ---------------------------------------------------------------------------
ALTER TABLE public.benchmark_rules ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;
CREATE INDEX idx_benchmark_rules_workspace ON public.benchmark_rules(workspace_id);

-- ---------------------------------------------------------------------------
-- Auto-create workspace for existing users (and future signups)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  ws_id uuid;
BEGIN
  -- Create user profile
  INSERT INTO public.user_profiles (id)
  VALUES (NEW.id);

  -- Create default personal workspace
  INSERT INTO public.workspaces (name, slug, owner_id)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)) || '''s Workspace',
    NEW.id::text,
    NEW.id
  )
  RETURNING id INTO ws_id;

  -- Add owner as admin member
  INSERT INTO public.workspace_members (workspace_id, user_id, role, accepted_at)
  VALUES (ws_id, NEW.id, 'admin', now());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- Create workspaces for existing users who don't have one
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  u RECORD;
  ws_id uuid;
BEGIN
  FOR u IN SELECT id, email, raw_user_meta_data FROM auth.users LOOP
    IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE owner_id = u.id) THEN
      INSERT INTO public.workspaces (name, slug, owner_id)
      VALUES (
        COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)) || '''s Workspace',
        u.id::text,
        u.id
      )
      RETURNING id INTO ws_id;

      INSERT INTO public.workspace_members (workspace_id, user_id, role, accepted_at)
      VALUES (ws_id, u.id, 'admin', now());

      -- Assign any unassigned peer groups owned by this user to their workspace
      UPDATE public.peer_groups
      SET workspace_id = ws_id
      WHERE owner_id = u.id AND workspace_id IS NULL;
    END IF;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Workspaces: visible if you're a member
CREATE POLICY "workspace_select" ON public.workspaces
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
  );

CREATE POLICY "workspace_insert" ON public.workspaces
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "workspace_update" ON public.workspaces
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "workspace_delete" ON public.workspaces
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- Workspace members: visible to workspace members; admin can manage
CREATE POLICY "workspace_members_select" ON public.workspace_members
  FOR SELECT TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_members_insert" ON public.workspace_members
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid() AND wm.role = 'admin'
    )
  );

CREATE POLICY "workspace_members_update" ON public.workspace_members
  FOR UPDATE TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid() AND wm.role = 'admin'
    )
  );

CREATE POLICY "workspace_members_delete" ON public.workspace_members
  FOR DELETE TO authenticated
  USING (
    -- Admins can remove members; users can remove themselves
    user_id = auth.uid()
    OR workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid() AND wm.role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- Update visible_company_ids() to include workspace members' peer groups
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
  WHERE
    -- Own peer groups (no workspace)
    (pg.owner_id = auth.uid() AND pg.workspace_id IS NULL)
    -- Peer groups in any workspace I'm a member of
    OR pg.workspace_id IN (
      SELECT wm.workspace_id
      FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid()
    )
$$;

-- ---------------------------------------------------------------------------
-- Update peer_groups RLS to allow workspace members to see/manage
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "peer_groups_select_authenticated" ON public.peer_groups;
CREATE POLICY "peer_groups_select_authenticated" ON public.peer_groups
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "peer_groups_insert_authenticated" ON public.peer_groups;
CREATE POLICY "peer_groups_insert_authenticated" ON public.peer_groups
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    OR workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid() AND wm.role IN ('admin', 'editor')
    )
  );

DROP POLICY IF EXISTS "peer_groups_update_authenticated" ON public.peer_groups;
CREATE POLICY "peer_groups_update_authenticated" ON public.peer_groups
  FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid()
    OR workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid() AND wm.role IN ('admin', 'editor')
    )
  );

DROP POLICY IF EXISTS "peer_groups_delete_authenticated" ON public.peer_groups;
CREATE POLICY "peer_groups_delete_authenticated" ON public.peer_groups
  FOR DELETE TO authenticated
  USING (
    owner_id = auth.uid()
    OR workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid() AND wm.role = 'admin'
    )
  );

-- Same for peer_group_members
DROP POLICY IF EXISTS "peer_group_members_select_authenticated" ON public.peer_group_members;
CREATE POLICY "peer_group_members_select_authenticated" ON public.peer_group_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.peer_groups pg
      WHERE pg.id = peer_group_id
        AND (
          pg.owner_id = auth.uid()
          OR pg.workspace_id IN (
            SELECT wm.workspace_id FROM public.workspace_members wm
            WHERE wm.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "peer_group_members_insert_authenticated" ON public.peer_group_members;
CREATE POLICY "peer_group_members_insert_authenticated" ON public.peer_group_members
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.peer_groups pg
      WHERE pg.id = peer_group_id
        AND (
          pg.owner_id = auth.uid()
          OR pg.workspace_id IN (
            SELECT wm.workspace_id FROM public.workspace_members wm
            WHERE wm.user_id = auth.uid() AND wm.role IN ('admin', 'editor')
          )
        )
    )
  );

DROP POLICY IF EXISTS "peer_group_members_delete_authenticated" ON public.peer_group_members;
CREATE POLICY "peer_group_members_delete_authenticated" ON public.peer_group_members
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.peer_groups pg
      WHERE pg.id = peer_group_id
        AND (
          pg.owner_id = auth.uid()
          OR pg.workspace_id IN (
            SELECT wm.workspace_id FROM public.workspace_members wm
            WHERE wm.user_id = auth.uid() AND wm.role IN ('admin', 'editor')
          )
        )
    )
  );

-- Service role policies
CREATE POLICY "workspaces_select_service_role" ON public.workspaces
  FOR SELECT TO service_role USING (true);
CREATE POLICY "workspace_members_select_service_role" ON public.workspace_members
  FOR SELECT TO service_role USING (true);

-- ---------------------------------------------------------------------------
-- RPC: lookup_user_by_email — for invite flow (admins only)
-- Returns id only, no sensitive data
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lookup_user_by_email(email_input text)
RETURNS TABLE(id uuid)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT au.id
  FROM auth.users au
  WHERE au.email = lower(trim(email_input))
  LIMIT 1
$$;
