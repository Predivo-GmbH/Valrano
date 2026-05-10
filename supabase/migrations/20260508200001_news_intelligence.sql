-- News Intelligence + Segment Comparability
-- 6 new tables: news_sources, company_news, news_digests, report_contexts, segment_breakdowns, comparability_adjustments

-- ── news_sources ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS news_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('google_news_rss', 'newsapi', 'company_ir', 'custom_rss')),
  source_url text NOT NULL,
  source_name text NOT NULL,
  search_query text, -- the query used (e.g. "Holcim Ltd" OR "HOLN")
  is_active boolean NOT NULL DEFAULT true,
  last_fetched_at timestamptz,
  fetch_interval_hours integer NOT NULL DEFAULT 6,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE news_sources ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_news_sources_company ON news_sources(company_id);
CREATE INDEX idx_news_sources_active ON news_sources(is_active) WHERE is_active = true;

-- ── company_news ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source_id uuid REFERENCES news_sources(id) ON DELETE SET NULL,
  title text NOT NULL,
  url text NOT NULL,
  published_at timestamptz,
  author text,
  snippet text, -- first ~300 chars from the article
  full_text text, -- full article text if fetched
  language text DEFAULT 'en',
  sentiment text CHECK (sentiment IN ('positive', 'negative', 'neutral', 'mixed')),
  relevance_score numeric(3,2), -- 0.00 to 1.00
  topics text[] DEFAULT '{}', -- e.g. {'M&A', 'ESG', 'earnings', 'restructuring', 'legal'}
  ai_summary text, -- 1-2 sentence AI summary
  is_relevant boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, url)
);

ALTER TABLE company_news ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_company_news_company ON company_news(company_id);
CREATE INDEX idx_company_news_published ON company_news(published_at DESC);
CREATE INDEX idx_company_news_relevant ON company_news(company_id, is_relevant, published_at DESC);
CREATE INDEX idx_company_news_topics ON company_news USING GIN(topics);

-- ── news_digests ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS news_digests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  digest_type text NOT NULL CHECK (digest_type IN ('weekly', 'monthly')),
  summary text NOT NULL, -- AI narrative summary
  key_events jsonb DEFAULT '[]', -- [{date, title, impact, category}]
  sentiment_trend text CHECK (sentiment_trend IN ('improving', 'stable', 'deteriorating', 'mixed')),
  article_count integer DEFAULT 0,
  ai_model_used text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, digest_type, period_start)
);

ALTER TABLE news_digests ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_news_digests_company ON news_digests(company_id, period_end DESC);

-- ── report_contexts ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS report_contexts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE UNIQUE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  fiscal_year integer NOT NULL,
  -- Strategic intelligence extracted from the annual report
  competitor_mentions jsonb DEFAULT '[]', -- [{company_name, matched_company_id, context, sentiment, page}]
  strategic_initiatives jsonb DEFAULT '[]', -- [{initiative, description, timeline, page}]
  risk_factors jsonb DEFAULT '[]', -- [{factor, description, severity, page}]
  market_commentary text, -- overall market outlook narrative
  management_guidance jsonb DEFAULT '[]', -- [{metric, guidance_value, guidance_type, comparison_period, page}]
  restructuring_notes jsonb DEFAULT '[]', -- [{description, financial_impact_mln, currency, page}]
  ma_activity jsonb DEFAULT '[]', -- [{type: 'acquisition'|'divestiture', target, description, value_mln, currency, page}]
  key_quotes jsonb DEFAULT '[]', -- [{quote, speaker, role, page}]
  business_segments jsonb DEFAULT '[]', -- [{name, description, products, revenue_pct, page}] (high-level, details in segment_breakdowns)
  geographic_mix jsonb DEFAULT '[]', -- [{region, revenue_pct, page}]
  ai_model_used text,
  extraction_confidence numeric(3,2),
  extracted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE report_contexts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_report_contexts_company ON report_contexts(company_id, fiscal_year DESC);

-- ── segment_breakdowns ───────────────────────────────────────────────────────
-- Detailed financial breakdown per business segment per company per year
CREATE TABLE IF NOT EXISTS segment_breakdowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  fiscal_year integer NOT NULL,
  segment_name text NOT NULL, -- e.g. 'Roofing', 'Cement', 'Aggregates', 'Ready-Mix'
  segment_type text NOT NULL CHECK (segment_type IN ('product', 'geography', 'business_unit')),
  -- Financial metrics for this segment (in reporting currency, millions)
  revenue numeric,
  ebitda numeric,
  ebit numeric,
  operating_profit numeric,
  assets numeric,
  capex numeric,
  employees integer,
  -- Proportions
  revenue_pct numeric(5,2), -- percentage of total revenue
  ebitda_pct numeric(5,2),
  -- Metadata
  currency text,
  source_page integer,
  confidence numeric(3,2),
  notes text, -- any special accounting notes about this segment
  ai_model_used text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(report_id, segment_name, segment_type)
);

ALTER TABLE segment_breakdowns ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_segment_breakdowns_company ON segment_breakdowns(company_id, fiscal_year DESC);
CREATE INDEX idx_segment_breakdowns_report ON segment_breakdowns(report_id);

-- ── comparability_adjustments ────────────────────────────────────────────────
-- Records how KPIs were adjusted to make companies comparable
CREATE TABLE IF NOT EXISTS comparability_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  benchmark_document_id uuid REFERENCES benchmark_documents(id) ON DELETE CASCADE,
  -- Which company's numbers are being adjusted
  adjusted_company_id uuid NOT NULL REFERENCES companies(id),
  -- Which company we're making it comparable to
  reference_company_id uuid NOT NULL REFERENCES companies(id),
  fiscal_year integer NOT NULL,
  kpi_code text NOT NULL,
  -- The adjustment
  original_value numeric NOT NULL,
  adjusted_value numeric NOT NULL,
  adjustment_amount numeric NOT NULL, -- difference
  adjustment_type text NOT NULL CHECK (adjustment_type IN (
    'segment_exclusion',   -- remove a segment the reference doesn't have
    'segment_inclusion',   -- add back a segment for fair comparison
    'accounting_reclass',  -- reclassify due to different accounting treatment
    'one_off_removal',     -- strip out one-off items (restructuring, M&A gains)
    'currency_normalization', -- beyond standard FX, e.g. hyperinflation adjustments
    'scope_alignment'      -- general scope difference (e.g. JV consolidation method)
  )),
  -- Context
  segments_involved text[], -- which segments were excluded/included
  rationale text NOT NULL, -- AI-generated explanation
  confidence numeric(3,2),
  data_sources text[], -- e.g. {'annual_report_p45', 'segment_breakdown', 'news_2025-09-15'}
  currency text DEFAULT 'CHF',
  ai_model_used text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE comparability_adjustments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_comparability_adj_benchmark ON comparability_adjustments(benchmark_document_id);
CREATE INDEX idx_comparability_adj_company ON comparability_adjustments(adjusted_company_id, fiscal_year);

-- ── RLS Policies ─────────────────────────────────────────────────────────────
-- News data is scoped to companies visible to the user (via peer groups)

CREATE POLICY "news_sources_read" ON news_sources FOR SELECT TO authenticated
  USING (company_id IN (SELECT visible_company_ids()));

CREATE POLICY "company_news_read" ON company_news FOR SELECT TO authenticated
  USING (company_id IN (SELECT visible_company_ids()));

CREATE POLICY "news_digests_read" ON news_digests FOR SELECT TO authenticated
  USING (company_id IN (SELECT visible_company_ids()));

CREATE POLICY "report_contexts_read" ON report_contexts FOR SELECT TO authenticated
  USING (company_id IN (SELECT visible_company_ids()));

CREATE POLICY "segment_breakdowns_read" ON segment_breakdowns FOR SELECT TO authenticated
  USING (company_id IN (SELECT visible_company_ids()));

CREATE POLICY "comparability_adjustments_read" ON comparability_adjustments FOR SELECT TO authenticated
  USING (adjusted_company_id IN (SELECT visible_company_ids()));

-- Service role can insert/update all (edge functions use service_role)
-- No INSERT/UPDATE policies for authenticated — all writes via edge functions
