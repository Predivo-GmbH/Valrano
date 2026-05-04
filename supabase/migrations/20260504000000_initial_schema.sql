-- =============================================================================
-- BenchmarkSignal — Initial Schema
-- Migration: 20260504000000_initial_schema
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- updated_at trigger function (applied to all tables)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- handle_new_user trigger function (inserts user_profiles row on signup)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- TABLE: companies
-- Listed corporations being tracked (Holcim + 15 peers)
-- =============================================================================
CREATE TABLE public.companies (
  id                  uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  name                text        NOT NULL,
  ticker              text,
  exchange            text,
  isin                text        UNIQUE,
  country             text,
  sector              text,
  reporting_currency  text,
  fiscal_year_end     text,
  website_url         text,
  logo_url            text,
  is_active           boolean     DEFAULT true NOT NULL,
  created_at          timestamptz DEFAULT now() NOT NULL,
  updated_at          timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- TABLE: peer_groups
-- Named collections of companies for comparison
-- =============================================================================
CREATE TABLE public.peer_groups (
  id          uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  name        text        NOT NULL,
  description text,
  owner_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  is_default  boolean     DEFAULT false NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL,
  updated_at  timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER trg_peer_groups_updated_at
  BEFORE UPDATE ON public.peer_groups
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- TABLE: peer_group_members
-- Join table: peer_group <-> company
-- =============================================================================
CREATE TABLE public.peer_group_members (
  id             uuid    DEFAULT uuid_generate_v4() PRIMARY KEY,
  peer_group_id  uuid    NOT NULL REFERENCES public.peer_groups(id) ON DELETE CASCADE,
  company_id     uuid    NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  is_primary     boolean DEFAULT false NOT NULL,
  created_at     timestamptz DEFAULT now() NOT NULL,
  updated_at     timestamptz DEFAULT now() NOT NULL,
  UNIQUE (peer_group_id, company_id)
);

CREATE TRIGGER trg_peer_group_members_updated_at
  BEFORE UPDATE ON public.peer_group_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- TABLE: reports
-- Published PDF reports from companies
-- =============================================================================
CREATE TABLE public.reports (
  id               uuid    DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id       uuid    NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  report_type      text    NOT NULL CHECK (report_type IN ('annual', 'quarterly', 'half_year', 'sustainability')),
  fiscal_year      integer NOT NULL,
  fiscal_quarter   integer,
  title            text,
  publication_date date,
  source_url       text,
  pdf_storage_path text,
  page_count       integer,
  language         text,
  status           text    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'extracted', 'reviewed', 'error')),
  created_at       timestamptz DEFAULT now() NOT NULL,
  updated_at       timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER trg_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- TABLE: extractions
-- One extraction attempt per report — links to AI processing
-- =============================================================================
CREATE TABLE public.extractions (
  id                    uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  report_id             uuid        NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  model_used            text,
  started_at            timestamptz,
  completed_at          timestamptz,
  status                text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  error_message         text,
  total_kpis_extracted  integer     DEFAULT 0 NOT NULL,
  avg_confidence        numeric(4,3),
  extraction_metadata   jsonb,
  created_at            timestamptz DEFAULT now() NOT NULL
);

-- extractions has no updated_at per spec (immutable log), but add it for consistency
ALTER TABLE public.extractions ADD COLUMN updated_at timestamptz DEFAULT now() NOT NULL;

CREATE TRIGGER trg_extractions_updated_at
  BEFORE UPDATE ON public.extractions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- TABLE: kpi_definitions
-- Canonical KPI taxonomy — seeded below
-- =============================================================================
CREATE TABLE public.kpi_definitions (
  id            uuid    DEFAULT uuid_generate_v4() PRIMARY KEY,
  code          text    NOT NULL UNIQUE,
  name          text    NOT NULL,
  category      text    NOT NULL CHECK (category IN ('financial', 'esg', 'operational')),
  unit_type     text    NOT NULL CHECK (unit_type IN ('currency', 'percentage', 'ratio', 'number', 'tons', 'intensity')),
  description   text,
  display_order integer,
  is_active     boolean DEFAULT true NOT NULL,
  created_at    timestamptz DEFAULT now() NOT NULL,
  updated_at    timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER trg_kpi_definitions_updated_at
  BEFORE UPDATE ON public.kpi_definitions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- TABLE: kpi_values
-- The heart of the system — extracted + normalized values
-- =============================================================================
CREATE TABLE public.kpi_values (
  id                  uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  extraction_id       uuid        NOT NULL REFERENCES public.extractions(id) ON DELETE CASCADE,
  report_id           uuid        NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  company_id          uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  kpi_definition_id   uuid        NOT NULL REFERENCES public.kpi_definitions(id) ON DELETE RESTRICT,
  fiscal_year         integer     NOT NULL,
  fiscal_quarter      integer,
  raw_value           numeric,
  raw_currency        text,
  raw_label           text,
  normalized_value    numeric,
  normalized_currency text        DEFAULT 'CHF',
  fx_rate_used        numeric,
  fx_rate_type        text        CHECK (fx_rate_type IN ('period_average', 'point_in_time')),
  confidence          numeric(4,3),
  needs_review        boolean     DEFAULT false NOT NULL,
  is_restated         boolean     DEFAULT false NOT NULL,
  source_page         integer,
  source_text         text,
  reviewer_id         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at         timestamptz,
  created_at          timestamptz DEFAULT now() NOT NULL,
  updated_at          timestamptz DEFAULT now() NOT NULL,
  UNIQUE (report_id, kpi_definition_id, fiscal_year, fiscal_quarter)
);

CREATE TRIGGER trg_kpi_values_updated_at
  BEFORE UPDATE ON public.kpi_values
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- TABLE: fx_rates
-- Historical exchange rates for normalization
-- =============================================================================
CREATE TABLE public.fx_rates (
  id             uuid    DEFAULT uuid_generate_v4() PRIMARY KEY,
  base_currency  text    NOT NULL,
  quote_currency text    NOT NULL,
  rate           numeric NOT NULL,
  rate_date      date    NOT NULL,
  rate_type      text    NOT NULL CHECK (rate_type IN ('daily_close', 'period_average')),
  source         text,
  created_at     timestamptz DEFAULT now() NOT NULL,
  updated_at     timestamptz DEFAULT now() NOT NULL,
  UNIQUE (base_currency, quote_currency, rate_date, rate_type)
);

CREATE TRIGGER trg_fx_rates_updated_at
  BEFORE UPDATE ON public.fx_rates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- TABLE: alerts
-- Email alert configuration
-- =============================================================================
CREATE TABLE public.alerts (
  id                uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type        text        NOT NULL CHECK (alert_type IN ('new_report', 'anomaly', 'extraction_complete')),
  peer_group_id     uuid        REFERENCES public.peer_groups(id) ON DELETE SET NULL,
  company_id        uuid        REFERENCES public.companies(id) ON DELETE SET NULL,
  is_enabled        boolean     DEFAULT true NOT NULL,
  last_triggered_at timestamptz,
  created_at        timestamptz DEFAULT now() NOT NULL,
  updated_at        timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER trg_alerts_updated_at
  BEFORE UPDATE ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- TABLE: alert_history
-- Sent alert log
-- =============================================================================
CREATE TABLE public.alert_history (
  id            uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  alert_id      uuid        NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
  triggered_at  timestamptz DEFAULT now() NOT NULL,
  trigger_data  jsonb,
  email_sent    boolean     DEFAULT false NOT NULL,
  email_sent_at timestamptz,
  created_at    timestamptz DEFAULT now() NOT NULL,
  updated_at    timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER trg_alert_history_updated_at
  BEFORE UPDATE ON public.alert_history
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- TABLE: user_profiles
-- Extended user data beyond auth.users
-- =============================================================================
CREATE TABLE public.user_profiles (
  id                    uuid    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name             text,
  company_name          text,
  job_title             text,
  default_peer_group_id uuid    REFERENCES public.peer_groups(id) ON DELETE SET NULL,
  default_currency      text    DEFAULT 'CHF' NOT NULL,
  email_alerts_enabled  boolean DEFAULT true NOT NULL,
  created_at            timestamptz DEFAULT now() NOT NULL,
  updated_at            timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Attach handle_new_user trigger to auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- INDEXES
-- =============================================================================

-- kpi_values — primary lookup: company + KPI + year
CREATE INDEX idx_kpi_values_company_kpi_year
  ON public.kpi_values (company_id, kpi_definition_id, fiscal_year);

-- kpi_values — report-level lookup
CREATE INDEX idx_kpi_values_report_id
  ON public.kpi_values (report_id);

-- kpi_values — review queue (partial index — only unreviewed rows)
CREATE INDEX idx_kpi_values_needs_review
  ON public.kpi_values (needs_review)
  WHERE needs_review = true;

-- reports — company timeline lookup
CREATE INDEX idx_reports_company_year_type
  ON public.reports (company_id, fiscal_year, report_type);

-- reports — pipeline status queue
CREATE INDEX idx_reports_status
  ON public.reports (status);

-- fx_rates — currency pair + date lookup
CREATE INDEX idx_fx_rates_currencies_date
  ON public.fx_rates (base_currency, quote_currency, rate_date);

-- companies — ticker lookup
CREATE INDEX idx_companies_ticker
  ON public.companies (ticker);

-- extractions — report-level lookup
CREATE INDEX idx_extractions_report_id
  ON public.extractions (report_id);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.companies           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peer_groups         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peer_group_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extractions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_definitions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_values          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fx_rates            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_history       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles       ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- companies — read-only reference data for all authenticated users
-- ---------------------------------------------------------------------------
CREATE POLICY "companies_select_authenticated"
  ON public.companies FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- kpi_definitions — read-only reference data for all authenticated users
-- ---------------------------------------------------------------------------
CREATE POLICY "kpi_definitions_select_authenticated"
  ON public.kpi_definitions FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- fx_rates — read-only reference data for all authenticated users
-- ---------------------------------------------------------------------------
CREATE POLICY "fx_rates_select_authenticated"
  ON public.fx_rates FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- peer_groups — owner full CRUD
-- ---------------------------------------------------------------------------
CREATE POLICY "peer_groups_select_authenticated"
  ON public.peer_groups FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "peer_groups_insert_authenticated"
  ON public.peer_groups FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "peer_groups_update_authenticated"
  ON public.peer_groups FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "peer_groups_delete_authenticated"
  ON public.peer_groups FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- peer_group_members — select for authenticated; insert/delete by group owner
-- ---------------------------------------------------------------------------
CREATE POLICY "peer_group_members_select_authenticated"
  ON public.peer_group_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.peer_groups pg
      WHERE pg.id = peer_group_id
        AND pg.owner_id = auth.uid()
    )
  );

CREATE POLICY "peer_group_members_insert_authenticated"
  ON public.peer_group_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.peer_groups pg
      WHERE pg.id = peer_group_id
        AND pg.owner_id = auth.uid()
    )
  );

CREATE POLICY "peer_group_members_delete_authenticated"
  ON public.peer_group_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.peer_groups pg
      WHERE pg.id = peer_group_id
        AND pg.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- reports — select for authenticated; insert/update via service_role only
-- ---------------------------------------------------------------------------
CREATE POLICY "reports_select_authenticated"
  ON public.reports FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "reports_insert_service_role"
  ON public.reports FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "reports_update_service_role"
  ON public.reports FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- extractions — select for authenticated; insert/update via service_role only
-- ---------------------------------------------------------------------------
CREATE POLICY "extractions_select_authenticated"
  ON public.extractions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "extractions_insert_service_role"
  ON public.extractions FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "extractions_update_service_role"
  ON public.extractions FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- kpi_values — select for authenticated; insert/update via service_role only
-- ---------------------------------------------------------------------------
CREATE POLICY "kpi_values_select_authenticated"
  ON public.kpi_values FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "kpi_values_insert_service_role"
  ON public.kpi_values FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "kpi_values_update_service_role"
  ON public.kpi_values FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- alerts — full CRUD for owning authenticated user
-- ---------------------------------------------------------------------------
CREATE POLICY "alerts_select_authenticated"
  ON public.alerts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "alerts_insert_authenticated"
  ON public.alerts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "alerts_update_authenticated"
  ON public.alerts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "alerts_delete_authenticated"
  ON public.alerts FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- alert_history — full CRUD scoped to owning user via alert join
-- ---------------------------------------------------------------------------
CREATE POLICY "alert_history_select_authenticated"
  ON public.alert_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.alerts a
      WHERE a.id = alert_id
        AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "alert_history_insert_authenticated"
  ON public.alert_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.alerts a
      WHERE a.id = alert_id
        AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "alert_history_update_authenticated"
  ON public.alert_history FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.alerts a
      WHERE a.id = alert_id
        AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "alert_history_delete_authenticated"
  ON public.alert_history FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.alerts a
      WHERE a.id = alert_id
        AND a.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- user_profiles — select/update for own row only
-- ---------------------------------------------------------------------------
CREATE POLICY "user_profiles_select_own"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "user_profiles_update_own"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- handle_new_user inserts via SECURITY DEFINER, so no INSERT policy needed
-- for authenticated role on user_profiles.

-- =============================================================================
-- SEED DATA: kpi_definitions
-- 15 core financial + ESG KPIs for building materials sector
-- =============================================================================

INSERT INTO public.kpi_definitions
  (code, name, category, unit_type, description, display_order, is_active)
VALUES

  -- Financial KPIs
  ('REVENUE',
   'Revenue',
   'financial', 'currency',
   'Total net revenue / net sales as reported in the income statement.',
   10, true),

  ('EBITDA',
   'EBITDA',
   'financial', 'currency',
   'Earnings before interest, taxes, depreciation and amortisation.',
   20, true),

  ('EBITDA_ADJ',
   'Adjusted EBITDA',
   'financial', 'currency',
   'EBITDA adjusted for non-recurring and exceptional items.',
   30, true),

  ('EBITDA_MARGIN',
   'EBITDA Margin',
   'financial', 'percentage',
   'EBITDA as a percentage of revenue.',
   40, true),

  ('EBIT',
   'EBIT',
   'financial', 'currency',
   'Earnings before interest and taxes (operating profit).',
   50, true),

  ('NET_INCOME',
   'Net Income',
   'financial', 'currency',
   'Net profit / loss attributable to shareholders of the parent.',
   60, true),

  ('EPS_BASIC',
   'Basic EPS',
   'financial', 'ratio',
   'Basic earnings per share in reporting currency.',
   70, true),

  ('NET_DEBT',
   'Net Debt',
   'financial', 'currency',
   'Total financial debt minus cash and cash equivalents.',
   80, true),

  ('NET_DEBT_EBITDA',
   'Net Debt / EBITDA',
   'financial', 'ratio',
   'Leverage ratio: net debt divided by EBITDA.',
   90, true),

  ('ROIC',
   'Return on Invested Capital (ROIC)',
   'financial', 'percentage',
   'NOPAT divided by average invested capital.',
   100, true),

  ('CAPEX',
   'Capital Expenditure',
   'financial', 'currency',
   'Cash spent on property, plant, equipment and intangible assets.',
   110, true),

  -- ESG KPIs
  ('CO2_ABSOLUTE',
   'CO2 Absolute Emissions (Scope 1+2)',
   'esg', 'tons',
   'Total absolute CO2-equivalent Scope 1 and Scope 2 greenhouse gas emissions in metric tonnes.',
   200, true),

  ('CO2_INTENSITY',
   'CO2 Intensity',
   'esg', 'intensity',
   'CO2-equivalent emissions per tonne of cementitious product (kg CO2/t).',
   210, true),

  ('LTIFR',
   'Lost-Time Injury Frequency Rate (LTIFR)',
   'esg', 'ratio',
   'Number of lost-time injuries per million hours worked.',
   220, true),

  -- Operational KPIs
  ('CEMENT_VOLUME',
   'Cement & Clinker Volume',
   'operational', 'number',
   'Total cement and clinker sales volumes in million tonnes.',
   300, true);
