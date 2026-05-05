-- =============================================================================
-- Migration: Report Builder (Sprint 9, Block B)
-- Custom report composer, templates, scheduled reports
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table: report_templates — pre-built report templates
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS report_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  -- Template definition: which sections, KPIs, chart types to include
  template_json jsonb NOT NULL DEFAULT '{}',
  is_system boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Table: custom_reports — user-generated reports
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS custom_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  template_id uuid REFERENCES report_templates(id),
  -- Report configuration
  config_json jsonb NOT NULL DEFAULT '{}',
  -- Generated content
  content_json jsonb,
  content_html text,
  -- Status
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'ready', 'error')),
  error_message text,
  -- Scheduling
  schedule_cron text,
  last_generated_at timestamptz,
  next_generation_at timestamptz,
  -- Export tracking
  last_exported_at timestamptz,
  last_export_format text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX idx_report_templates_category ON report_templates(category);
CREATE INDEX idx_custom_reports_user ON custom_reports(user_id);
CREATE INDEX idx_custom_reports_status ON custom_reports(status);
CREATE INDEX idx_custom_reports_schedule ON custom_reports(schedule_cron) WHERE schedule_cron IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
CREATE TRIGGER set_report_templates_updated_at
  BEFORE UPDATE ON report_templates
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

CREATE TRIGGER set_custom_reports_updated_at
  BEFORE UPDATE ON custom_reports
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_reports ENABLE ROW LEVEL SECURITY;

-- Templates: everyone can read system templates, users can CRUD their own
CREATE POLICY "Authenticated can read all templates"
  ON report_templates FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage own templates"
  ON report_templates FOR ALL
  USING (created_by = auth.uid() AND NOT is_system)
  WITH CHECK (created_by = auth.uid() AND NOT is_system);

-- Custom reports: user owns their reports
CREATE POLICY "Users can CRUD own reports"
  ON custom_reports FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Seed: System templates
-- ---------------------------------------------------------------------------
INSERT INTO report_templates (name, description, category, template_json, is_system) VALUES
(
  'Board Presentation',
  'Executive summary for board meetings with key KPIs, competitive position, and strategic outlook.',
  'executive',
  '{"sections": ["executive_summary", "kpi_highlights", "competitive_position", "peer_comparison_chart", "strategic_outlook"], "style": "board_presentation", "max_kpis": 6, "include_charts": true, "include_narrative": true}'::jsonb,
  true
),
(
  'Investor Update',
  'Quarterly investor update with financial performance, growth metrics, and market position.',
  'investor',
  '{"sections": ["performance_summary", "revenue_analysis", "margin_trends", "growth_metrics", "market_share", "outlook"], "style": "detailed_analysis", "max_kpis": 10, "include_charts": true, "include_narrative": true}'::jsonb,
  true
),
(
  'Competitive Landscape',
  'Comprehensive competitive analysis with peer benchmarks across all tracked KPIs.',
  'competitive',
  '{"sections": ["market_overview", "peer_ranking", "kpi_comparison_table", "gap_analysis", "strengths_weaknesses", "strategic_implications"], "style": "detailed_analysis", "max_kpis": 15, "include_charts": true, "include_narrative": true}'::jsonb,
  true
),
(
  'M&A Target Screen',
  'Identify potential acquisition targets based on financial metrics and strategic fit.',
  'strategy',
  '{"sections": ["screening_criteria", "target_shortlist", "financial_comparison", "valuation_indicators", "strategic_fit_assessment"], "style": "executive_brief", "max_kpis": 8, "include_charts": true, "include_narrative": true}'::jsonb,
  true
),
(
  'KPI Deep Dive',
  'Detailed analysis of a single KPI across all peer companies with trends and insights.',
  'analytical',
  '{"sections": ["kpi_definition", "current_standings", "historical_trend", "peer_distribution", "outlier_analysis", "recommendations"], "style": "detailed_analysis", "max_kpis": 1, "include_charts": true, "include_narrative": true}'::jsonb,
  true
);
