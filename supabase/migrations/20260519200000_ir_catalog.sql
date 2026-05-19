-- =============================================================================
-- Valrano — IR Document Catalog
-- Migration: 20260519200000_ir_catalog
--
-- 1. New table: ir_catalog_items — stores documents discovered on IR pages
-- 2. Change default tier for new users: starter → enterprise
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. IR Catalog Items table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.ir_catalog_items (
  id                        uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id                uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  -- Document metadata (from scraping)
  title                     text,
  document_url              text        NOT NULL,
  document_type             text        CHECK (document_type IN (
    'annual_report', 'quarterly_report', 'half_year_report', 'sustainability_report',
    'investor_presentation', 'press_release', 'financial_statements', 'other'
  )),
  fiscal_year               integer,
  fiscal_quarter            integer,
  language                  text,
  file_format               text,
  file_size_bytes           bigint,

  -- Classification metadata
  ai_classified             boolean     DEFAULT false,
  classification_confidence numeric(4,3),

  -- Lifecycle
  detected_at               timestamptz DEFAULT now(),
  report_id                 uuid        REFERENCES public.reports(id) ON DELETE SET NULL,
  is_downloaded             boolean     DEFAULT false,

  -- Deduplication
  url_hash                  text        GENERATED ALWAYS AS (encode(sha256(document_url::bytea), 'hex')) STORED,

  created_at                timestamptz DEFAULT now() NOT NULL,
  updated_at                timestamptz DEFAULT now() NOT NULL,

  UNIQUE (company_id, url_hash)
);

-- Indexes
CREATE INDEX idx_ir_catalog_company ON public.ir_catalog_items(company_id);
CREATE INDEX idx_ir_catalog_type ON public.ir_catalog_items(document_type);
CREATE INDEX idx_ir_catalog_year ON public.ir_catalog_items(fiscal_year DESC);
CREATE INDEX idx_ir_catalog_not_downloaded ON public.ir_catalog_items(is_downloaded) WHERE is_downloaded = false;

-- Updated_at trigger
CREATE TRIGGER trg_ir_catalog_items_updated_at
  BEFORE UPDATE ON public.ir_catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS policies
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.ir_catalog_items ENABLE ROW LEVEL SECURITY;

-- Users can view catalog items for companies in their peer groups
CREATE POLICY "ir_catalog_select_visible"
  ON public.ir_catalog_items FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.visible_company_ids()));

-- Users can insert catalog items for companies in their peer groups
CREATE POLICY "ir_catalog_insert_visible"
  ON public.ir_catalog_items FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT public.visible_company_ids()));

-- Users can update catalog items for companies in their peer groups
CREATE POLICY "ir_catalog_update_visible"
  ON public.ir_catalog_items FOR UPDATE TO authenticated
  USING (company_id IN (SELECT public.visible_company_ids()))
  WITH CHECK (company_id IN (SELECT public.visible_company_ids()));

-- Service role full access (for edge functions)
CREATE POLICY "ir_catalog_all_service_role"
  ON public.ir_catalog_items FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Change default tier for new users: starter → enterprise
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, tier, status)
  VALUES (NEW.id, 'enterprise', 'active')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
