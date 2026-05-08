-- =============================================================================
-- Admin functions for super admin (roger@mueller.ro)
-- Migration: 20260508200000_admin_functions
-- NOTE: Uses auth.jwt() not auth.users — authenticated role cannot SELECT auth.users
-- =============================================================================

-- Allow super admin to read all subscriptions
CREATE POLICY "subscriptions_select_admin"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'roger@mueller.ro'
  );

-- Allow super admin to read all user profiles
CREATE POLICY "user_profiles_select_admin"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'roger@mueller.ro'
  );

-- RPC: admin_update_tier — updates a user's subscription tier
-- Only callable by the super admin email
-- SECURITY DEFINER can access auth.users, but we use JWT claims for consistency
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
  caller_email := current_setting('request.jwt.claims', true)::json ->> 'email';
  IF caller_email IS NULL OR caller_email != 'roger@mueller.ro' THEN
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
