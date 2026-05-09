-- ---------------------------------------------------------------------------
-- Phase C: AI Insights — auto-generation, delta detection, digest
-- ---------------------------------------------------------------------------

-- 1. Delta label for change detection between insight batches
ALTER TABLE ai_insights
  ADD COLUMN IF NOT EXISTS delta_label TEXT CHECK (delta_label IN ('new', 'worsened', 'improved', 'unchanged')),
  ADD COLUMN IF NOT EXISTS generation_batch_id TEXT,
  ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN DEFAULT FALSE;

-- 2. Index for batch lookups
CREATE INDEX IF NOT EXISTS idx_ai_insights_batch
  ON ai_insights(user_id, generation_batch_id);

-- 3. Track last auto-generation per user to avoid duplicate triggers
CREATE TABLE IF NOT EXISTS ai_insight_auto_gen_log (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  triggered_by  text        NOT NULL CHECK (triggered_by IN ('upload', 'cron', 'manual')),
  batch_id      text        NOT NULL,
  insights_count integer    DEFAULT 0,
  created_at    timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auto_gen_log_user
  ON ai_insight_auto_gen_log(user_id, created_at DESC);

-- 4. Allow 'insight_risk_flag' as a notification type
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('report_detected', 'document_generated', 'approval_assigned', 'approval_action', 'document_delivered', 'insight_risk_flag'));
