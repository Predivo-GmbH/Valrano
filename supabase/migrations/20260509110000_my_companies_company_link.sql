-- Link my_companies to companies table so user's company works with the full
-- pipeline (reports, KPI extraction, insights, upload).
ALTER TABLE my_companies
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_my_companies_company ON my_companies(company_id);
