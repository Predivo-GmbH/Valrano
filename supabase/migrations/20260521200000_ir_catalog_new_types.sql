-- =============================================================================
-- Valrano — IR Catalog: Add granular document types
-- Migration: 20260521200000_ir_catalog_new_types
--
-- Adds conference_call, factsheet, consensus to document_type CHECK constraint.
-- Replaces the broad "other" bucket with specific categories.
-- =============================================================================

-- Drop and recreate CHECK constraint with new types
ALTER TABLE public.ir_catalog_items
  DROP CONSTRAINT IF EXISTS ir_catalog_items_document_type_check;

ALTER TABLE public.ir_catalog_items
  ADD CONSTRAINT ir_catalog_items_document_type_check
  CHECK (document_type IN (
    'annual_report', 'quarterly_report', 'half_year_report', 'sustainability_report',
    'investor_presentation', 'press_release', 'financial_statements',
    'conference_call', 'factsheet', 'consensus',
    'other'
  ));
