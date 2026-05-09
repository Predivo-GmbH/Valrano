-- ---------------------------------------------------------------------------
-- Phase B: AI Insights — confidence, bookmarks, action tracking
-- ---------------------------------------------------------------------------

-- 1. Add data_confidence column
ALTER TABLE ai_insights
  ADD COLUMN IF NOT EXISTS data_confidence TEXT CHECK (data_confidence IN ('high', 'medium', 'low'));

-- 2. Add bookmark and action tracking
ALTER TABLE ai_insights
  ADD COLUMN IF NOT EXISTS is_bookmarked BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_acted_upon BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS acted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS action_note TEXT;

-- 3. Index for bookmarked insights (quick access)
CREATE INDEX IF NOT EXISTS idx_ai_insights_bookmarked
  ON ai_insights(user_id) WHERE is_bookmarked AND NOT is_dismissed;
