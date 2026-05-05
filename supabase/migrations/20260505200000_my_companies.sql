-- =============================================================================
-- Migration: my_companies — Self-Benchmarking (Sprint 7, Block A)
-- Users can add their own company data and benchmark against peers.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table: my_companies — user's own company profiles with KPI data
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS my_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  sector text,
  country text,
  reporting_currency text DEFAULT 'CHF',
  headcount integer,
  founded_year integer,
  website_url text,
  is_primary boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Table: my_company_kpis — KPI values the user enters for their company
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS my_company_kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  my_company_id uuid NOT NULL REFERENCES my_companies(id) ON DELETE CASCADE,
  kpi_definition_id uuid NOT NULL REFERENCES kpi_definitions(id),
  fiscal_year integer NOT NULL,
  value numeric NOT NULL,
  currency text DEFAULT 'CHF',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(my_company_id, kpi_definition_id, fiscal_year)
);

-- ---------------------------------------------------------------------------
-- Table: self_benchmarks — stored results of self-benchmark calculations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS self_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  my_company_id uuid NOT NULL REFERENCES my_companies(id) ON DELETE CASCADE,
  peer_group_id uuid REFERENCES peer_groups(id),
  fiscal_year integer NOT NULL,
  results_json jsonb NOT NULL DEFAULT '{}',
  ai_narrative text,
  generated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX idx_my_companies_user ON my_companies(user_id);
CREATE INDEX idx_my_company_kpis_company ON my_company_kpis(my_company_id);
CREATE INDEX idx_my_company_kpis_year ON my_company_kpis(fiscal_year);
CREATE INDEX idx_self_benchmarks_company ON self_benchmarks(my_company_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
CREATE TRIGGER set_my_companies_updated_at
  BEFORE UPDATE ON my_companies
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

CREATE TRIGGER set_my_company_kpis_updated_at
  BEFORE UPDATE ON my_company_kpis
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

CREATE TRIGGER set_self_benchmarks_updated_at
  BEFORE UPDATE ON self_benchmarks
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE my_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE my_company_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE self_benchmarks ENABLE ROW LEVEL SECURITY;

-- my_companies: user owns their rows
CREATE POLICY "Users can CRUD own companies"
  ON my_companies FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- my_company_kpis: user owns via my_companies join
CREATE POLICY "Users can CRUD own company KPIs"
  ON my_company_kpis FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM my_companies mc
      WHERE mc.id = my_company_kpis.my_company_id
        AND mc.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM my_companies mc
      WHERE mc.id = my_company_kpis.my_company_id
        AND mc.user_id = auth.uid()
    )
  );

-- self_benchmarks: user owns via my_companies join
CREATE POLICY "Users can CRUD own benchmarks"
  ON self_benchmarks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM my_companies mc
      WHERE mc.id = self_benchmarks.my_company_id
        AND mc.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM my_companies mc
      WHERE mc.id = self_benchmarks.my_company_id
        AND mc.user_id = auth.uid()
    )
  );
