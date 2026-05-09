-- Include user's own company (my_companies.company_id) in both visibility RPCs
-- Previously only returned peer group companies, which blocked uploads/access for user's own company

-- Backend version (for edge functions using service_role)
CREATE OR REPLACE FUNCTION public.visible_company_ids_for_user(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
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

-- Frontend version (for RLS policies using auth.uid())
CREATE OR REPLACE FUNCTION public.visible_company_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
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
