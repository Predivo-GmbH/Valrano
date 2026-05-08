-- =============================================================================
-- Admin functions for super admin (roger@mueller.ro)
-- Migration: 20260508200000_admin_functions
-- =============================================================================

-- Allow super admin to read all subscriptions
CREATE POLICY "subscriptions_select_admin"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'roger@mueller.ro'
  );

-- Allow super admin to read all user profiles
CREATE POLICY "user_profiles_select_admin"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'roger@mueller.ro'
  );

-- RPC: admin_update_tier — updates a user's subscription tier
-- Only callable by the super admin email
CREATE OR REPLACE FUNCTION public.admin_update_tier(
  target_user_id uuid,
  new_tier text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_email text;
BEGIN
  SELECT email INTO caller_email FROM auth.users WHERE id = auth.uid();
  IF caller_email != 'roger@mueller.ro' THEN
    RAISE EXCEPTION 'Unauthorized: super admin only';
  END IF;

  IF new_tier NOT IN ('starter', 'professional', 'enterprise') THEN
    RAISE EXCEPTION 'Invalid tier: %', new_tier;
  END IF;

  -- Upsert: update if exists, insert if not
  INSERT INTO public.subscriptions (user_id, tier, status)
  VALUES (target_user_id, new_tier, 'active')
  ON CONFLICT (user_id) DO UPDATE
  SET tier = new_tier, updated_at = now();
END;
$$;
