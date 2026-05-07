-- =============================================================================
-- Migration: Accounting Profiles + KPI Value Adjustment Fields
-- Phase 1 of product vision: AI-extracted accounting framework from user's
-- own annual report, used to normalize competitor data.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. accounting_profiles — one per user, AI-extracted from their annual report
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounting_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,

  -- Company identification
  company_name TEXT NOT NULL,

  -- Auto-detected accounting standard
  accounting_standard TEXT NOT NULL DEFAULT 'IFRS',
  accounting_standard_confidence REAL DEFAULT 0,

  -- Specific accounting policies (AI-extracted JSON)
  -- Keys: revenue_recognition, rd_treatment, lease_treatment,
  --        ebitda_definition, net_debt_definition, goodwill_treatment,
  --        pension_accounting, fx_translation, segment_reporting
  policies JSONB NOT NULL DEFAULT '{}',

  -- How this company calculates each KPI
  -- Keys: KPI codes (REVENUE, EBITDA, etc.) with formula, adjustments, label_in_report, source_page
  kpi_mappings JSONB NOT NULL DEFAULT '{}',

  -- Source report reference
  source_report_id UUID REFERENCES reports ON DELETE SET NULL,
  source_report_title TEXT,

  -- AI model & extraction metadata
  ai_model TEXT,
  extracted_at TIMESTAMPTZ,

  -- Manual override tracking
  manually_edited BOOLEAN NOT NULL DEFAULT FALSE,
  last_edited_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One profile per user for now
  UNIQUE(user_id)
);

-- RLS: users can only see/edit their own profile
ALTER TABLE accounting_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own accounting profile"
  ON accounting_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own accounting profile"
  ON accounting_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounting profile"
  ON accounting_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounting profile"
  ON accounting_profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2. Add accounting adjustment columns to kpi_values
-- ---------------------------------------------------------------------------
ALTER TABLE kpi_values
  ADD COLUMN IF NOT EXISTS accounting_adjustment REAL,
  ADD COLUMN IF NOT EXISTS adjustment_reason TEXT,
  ADD COLUMN IF NOT EXISTS pre_adjustment_value REAL,
  ADD COLUMN IF NOT EXISTS accounting_confidence REAL;

-- ---------------------------------------------------------------------------
-- 3. Auto-update updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_accounting_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_accounting_profiles_updated_at
  BEFORE UPDATE ON accounting_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_accounting_profiles_updated_at();
