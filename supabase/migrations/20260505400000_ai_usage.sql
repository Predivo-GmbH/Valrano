-- =============================================================================
-- BenchmarkSignal — AI Usage Tracking
-- Migration: 20260505200000_ai_usage
-- Tracks AI suggestion usage per user for tier-based rate limiting
-- =============================================================================

CREATE TABLE public.ai_usage (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature         text        NOT NULL
                              CHECK (feature IN ('suggest_dates', 'suggest_ir_url', 'generate_benchmark')),
  model_used      text        NOT NULL,
  input_tokens    integer     DEFAULT 0,
  output_tokens   integer     DEFAULT 0,
  created_at      timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_ai_usage_user_feature_month
  ON public.ai_usage (user_id, feature, created_at);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- Users can see their own usage
CREATE POLICY "ai_usage_select_own" ON public.ai_usage
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Service role + authenticated can insert
CREATE POLICY "ai_usage_insert_auth" ON public.ai_usage
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "ai_usage_insert_service" ON public.ai_usage
  FOR INSERT TO service_role WITH CHECK (true);
