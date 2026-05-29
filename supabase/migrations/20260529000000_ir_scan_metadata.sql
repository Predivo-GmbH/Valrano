-- =============================================================================
-- Valrano — IR Scan Metadata on Companies
-- Migration: 20260529000000_ir_scan_metadata
--
-- Adds scan metadata column to companies table so the UI can show
-- comprehensive explanations when reports are not found.
-- Also extends ir_catalog_items document_type CHECK to include new types.
-- =============================================================================

-- Add scan metadata to companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS ir_scan_metadata jsonb;

COMMENT ON COLUMN public.companies.ir_scan_metadata IS
  'JSON metadata from the last scan-ir-page run: { last_scan_at, items_found, annual_report_years, fiscal_years_found, reason, sub_pages_crawled }';

-- Extend document_type CHECK to allow new types added in scan-ir-page
-- Drop old constraint and add new one
ALTER TABLE public.ir_catalog_items DROP CONSTRAINT IF EXISTS ir_catalog_items_document_type_check;
ALTER TABLE public.ir_catalog_items ADD CONSTRAINT ir_catalog_items_document_type_check
  CHECK (document_type IN (
    'annual_report', 'quarterly_report', 'half_year_report', 'sustainability_report',
    'investor_presentation', 'press_release', 'financial_statements',
    'conference_call', 'factsheet', 'consensus', 'other'
  ));
