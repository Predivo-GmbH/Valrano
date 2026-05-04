-- =============================================================================
-- BenchmarkSignal — Sprint 6: Benchmark Rules + Documents
-- Migration: 20260504300000_benchmark_documents
-- =============================================================================

-- =============================================================================
-- TABLE: benchmark_rules
-- Customer's benchmark configuration — defines how to generate documents
-- =============================================================================
CREATE TABLE public.benchmark_rules (
  id                    uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_company_id   uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name                  text        NOT NULL,
  description           text,
  peer_group_id         uuid        REFERENCES public.peer_groups(id) ON DELETE SET NULL,
  kpi_selection         jsonb       NOT NULL DEFAULT '[]'::jsonb,
  report_template       text,
  narrative_style       text        NOT NULL DEFAULT 'executive_brief'
                                    CHECK (narrative_style IN ('executive_brief', 'detailed_analysis', 'board_presentation')),
  auto_generate         boolean     DEFAULT true NOT NULL,
  created_by            uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            timestamptz DEFAULT now() NOT NULL,
  updated_at            timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER trg_benchmark_rules_updated_at
  BEFORE UPDATE ON public.benchmark_rules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- TABLE: benchmark_documents
-- Generated benchmark documents comparing a competitor against customer
-- =============================================================================
CREATE TABLE public.benchmark_documents (
  id                    uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  benchmark_rule_id     uuid        NOT NULL REFERENCES public.benchmark_rules(id) ON DELETE CASCADE,
  trigger_report_id     uuid        REFERENCES public.reports(id) ON DELETE SET NULL,
  trigger_company_id    uuid        REFERENCES public.companies(id) ON DELETE SET NULL,
  customer_company_id   uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  fiscal_year           integer     NOT NULL,
  title                 text        NOT NULL,
  status                text        NOT NULL DEFAULT 'draft'
                                    CHECK (status IN ('draft', 'in_review', 'approved', 'delivered', 'rejected')),
  content_json          jsonb,
  content_html          text,
  pdf_storage_path      text,
  generated_at          timestamptz,
  generated_by          text        NOT NULL DEFAULT 'system'
                                    CHECK (generated_by IN ('system', 'manual')),
  ai_model_used         text,
  created_at            timestamptz DEFAULT now() NOT NULL,
  updated_at            timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER trg_benchmark_documents_updated_at
  BEFORE UPDATE ON public.benchmark_documents
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX idx_benchmark_rules_customer
  ON public.benchmark_rules (customer_company_id);

CREATE INDEX idx_benchmark_rules_created_by
  ON public.benchmark_rules (created_by);

CREATE INDEX idx_benchmark_documents_rule
  ON public.benchmark_documents (benchmark_rule_id);

CREATE INDEX idx_benchmark_documents_status
  ON public.benchmark_documents (status);

CREATE INDEX idx_benchmark_documents_customer_year
  ON public.benchmark_documents (customer_company_id, fiscal_year);

CREATE INDEX idx_benchmark_documents_trigger_report
  ON public.benchmark_documents (trigger_report_id);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.benchmark_rules     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.benchmark_documents ENABLE ROW LEVEL SECURITY;

-- benchmark_rules: authenticated can read all; created_by user can CRUD
CREATE POLICY "benchmark_rules_select_authenticated"
  ON public.benchmark_rules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "benchmark_rules_insert_authenticated"
  ON public.benchmark_rules FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "benchmark_rules_update_authenticated"
  ON public.benchmark_rules FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "benchmark_rules_delete_authenticated"
  ON public.benchmark_rules FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- benchmark_documents: authenticated can read all; service_role can write
CREATE POLICY "benchmark_documents_select_authenticated"
  ON public.benchmark_documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "benchmark_documents_insert_service_role"
  ON public.benchmark_documents FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "benchmark_documents_update_service_role"
  ON public.benchmark_documents FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Also allow authenticated users to update status (for approval workflow)
CREATE POLICY "benchmark_documents_update_authenticated"
  ON public.benchmark_documents FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- SEED: Default benchmark rule for Holcim
-- =============================================================================

INSERT INTO public.benchmark_rules (
  customer_company_id,
  name,
  description,
  kpi_selection,
  narrative_style,
  auto_generate,
  created_by
)
SELECT
  c.id,
  'Default Peer Benchmark',
  'Standard competitive benchmark comparing all financial, ESG, and operational KPIs against the peer group.',
  (
    SELECT jsonb_agg(jsonb_build_object(
      'kpi_definition_id', kd.id,
      'code', kd.code,
      'weight', 1.0,
      'threshold_pct', NULL
    ))
    FROM public.kpi_definitions kd
    WHERE kd.is_active = true
  ),
  'executive_brief',
  true,
  NULL
FROM public.companies c
WHERE c.name ILIKE '%Holcim%'
LIMIT 1;
