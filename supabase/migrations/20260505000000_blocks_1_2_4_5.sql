-- =============================================================================
-- Valrano — Blocks 1, 2, 4, 5
-- Migration: 20260505000000_blocks_1_2_4_5
-- Publication Calendar, Ingestion Pipeline, Approval Workflow, Notifications
-- =============================================================================

-- =============================================================================
-- COMPANY TABLE ADDITIONS (Block 1)
-- =============================================================================

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS ir_page_url text,
  ADD COLUMN IF NOT EXISTS typical_publication_pattern jsonb;

-- =============================================================================
-- TABLE: publication_events (Block 1)
-- =============================================================================

CREATE TABLE public.publication_events (
  id                          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id                  uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  report_type                 text        NOT NULL
                                          CHECK (report_type IN ('annual', 'quarterly', 'half_year', 'sustainability')),
  fiscal_year                 integer     NOT NULL,
  fiscal_quarter              integer,
  expected_date               date        NOT NULL,
  expected_time               time,
  actual_detected_at          timestamptz,
  ir_page_url                 text,
  direct_pdf_url              text,
  status                      text        NOT NULL DEFAULT 'scheduled'
                                          CHECK (status IN ('scheduled', 'due_today', 'overdue', 'detected', 'ingested', 'benchmark_ready', 'cancelled')),
  monitoring_start_hours_before integer   DEFAULT 72,
  monitoring_interval_minutes integer     DEFAULT 360,
  notify_on_detection         boolean     DEFAULT true NOT NULL,
  notes                       text,
  report_id                   uuid        REFERENCES public.reports(id) ON DELETE SET NULL,
  created_by                  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                  timestamptz DEFAULT now() NOT NULL,
  updated_at                  timestamptz DEFAULT now() NOT NULL,
  UNIQUE (company_id, report_type, fiscal_year, fiscal_quarter)
);

CREATE TRIGGER trg_publication_events_updated_at
  BEFORE UPDATE ON public.publication_events
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_publication_events_company ON public.publication_events (company_id);
CREATE INDEX idx_publication_events_status ON public.publication_events (status);
CREATE INDEX idx_publication_events_expected_date ON public.publication_events (expected_date);

-- =============================================================================
-- TABLE: monitor_checks (Block 1)
-- =============================================================================

CREATE TABLE public.monitor_checks (
  id                    uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  publication_event_id  uuid        NOT NULL REFERENCES public.publication_events(id) ON DELETE CASCADE,
  checked_at            timestamptz DEFAULT now() NOT NULL,
  check_method          text        CHECK (check_method IN ('head_request', 'html_scrape', 'ai_parse')),
  result                text        NOT NULL DEFAULT 'not_found'
                                    CHECK (result IN ('not_found', 'found', 'error')),
  found_url             text,
  error_message         text,
  response_time_ms      integer,
  created_at            timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_monitor_checks_event ON public.monitor_checks (publication_event_id);
CREATE INDEX idx_monitor_checks_result ON public.monitor_checks (result);

-- =============================================================================
-- TABLE: approval_chains (Block 4)
-- =============================================================================

CREATE TABLE public.approval_chains (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  benchmark_rule_id   uuid        REFERENCES public.benchmark_rules(id) ON DELETE CASCADE,
  name                text        NOT NULL,
  steps               jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_by          uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz DEFAULT now() NOT NULL,
  updated_at          timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER trg_approval_chains_updated_at
  BEFORE UPDATE ON public.approval_chains
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- TABLE: approval_steps (Block 4)
-- =============================================================================

CREATE TABLE public.approval_steps (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id       uuid        NOT NULL REFERENCES public.benchmark_documents(id) ON DELETE CASCADE,
  chain_id          uuid        NOT NULL REFERENCES public.approval_chains(id) ON DELETE CASCADE,
  step_number       integer     NOT NULL,
  assignee_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  role              text        CHECK (role IN ('analyst', 'manager', 'director', 'c_suite')),
  status            text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'in_review', 'approved', 'changes_requested', 'skipped')),
  comments          text,
  reviewed_at       timestamptz,
  created_at        timestamptz DEFAULT now() NOT NULL,
  updated_at        timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER trg_approval_steps_updated_at
  BEFORE UPDATE ON public.approval_steps
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_approval_steps_document ON public.approval_steps (document_id);
CREATE INDEX idx_approval_steps_assignee ON public.approval_steps (assignee_id);

-- =============================================================================
-- TABLE: approval_comments (Block 4)
-- =============================================================================

CREATE TABLE public.approval_comments (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  step_id         uuid        NOT NULL REFERENCES public.approval_steps(id) ON DELETE CASCADE,
  author_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  comment         text        NOT NULL,
  attachment_path text,
  created_at      timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_approval_comments_step ON public.approval_comments (step_id);

-- =============================================================================
-- TABLE: notifications (Block 5)
-- =============================================================================

CREATE TABLE public.notifications (
  id                    uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type                  text        NOT NULL
                                    CHECK (type IN ('report_detected', 'document_generated', 'approval_assigned', 'approval_action', 'document_delivered')),
  title                 text        NOT NULL,
  body                  text,
  link                  text,
  is_read               boolean     DEFAULT false NOT NULL,
  related_document_id   uuid        REFERENCES public.benchmark_documents(id) ON DELETE SET NULL,
  related_report_id     uuid        REFERENCES public.reports(id) ON DELETE SET NULL,
  created_at            timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_notifications_user ON public.notifications (user_id);
CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id) WHERE is_read = false;

-- =============================================================================
-- ADD source_url TO reports (Block 2 — for auto-downloaded reports)
-- =============================================================================

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS source_url text;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.publication_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitor_checks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_chains      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_steps       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_comments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications        ENABLE ROW LEVEL SECURITY;

-- publication_events: authenticated full CRUD
CREATE POLICY "publication_events_select" ON public.publication_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "publication_events_insert" ON public.publication_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "publication_events_update" ON public.publication_events FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "publication_events_delete" ON public.publication_events FOR DELETE TO authenticated USING (true);

-- monitor_checks: authenticated read, service_role write
CREATE POLICY "monitor_checks_select" ON public.monitor_checks FOR SELECT TO authenticated USING (true);
CREATE POLICY "monitor_checks_insert_service" ON public.monitor_checks FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "monitor_checks_insert_auth" ON public.monitor_checks FOR INSERT TO authenticated WITH CHECK (true);

-- approval_chains: authenticated full CRUD
CREATE POLICY "approval_chains_select" ON public.approval_chains FOR SELECT TO authenticated USING (true);
CREATE POLICY "approval_chains_insert" ON public.approval_chains FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "approval_chains_update" ON public.approval_chains FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "approval_chains_delete" ON public.approval_chains FOR DELETE TO authenticated USING (true);

-- approval_steps: authenticated read + update, service_role insert
CREATE POLICY "approval_steps_select" ON public.approval_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "approval_steps_insert_service" ON public.approval_steps FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "approval_steps_insert_auth" ON public.approval_steps FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "approval_steps_update" ON public.approval_steps FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- approval_comments: authenticated full CRUD
CREATE POLICY "approval_comments_select" ON public.approval_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "approval_comments_insert" ON public.approval_comments FOR INSERT TO authenticated WITH CHECK (true);

-- notifications: users can only see their own
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notifications_insert_service" ON public.notifications FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "notifications_insert_auth" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

-- =============================================================================
-- SEED: Publication events for known competitors
-- =============================================================================

INSERT INTO public.publication_events (company_id, report_type, fiscal_year, expected_date, status, notes)
SELECT c.id, 'annual', 2025, d.expected_date, 'scheduled', d.notes
FROM (VALUES
  ('CRH plc', '2026-02-27'::date, 'CRH typically publishes annual results in late February'),
  ('HeidelbergCement AG', '2026-03-13'::date, 'Heidelberg publishes in mid-March'),
  ('Buzzi S.p.A.', '2026-03-20'::date, 'Buzzi publishes in late March'),
  ('CEMEX S.A.B. de C.V.', '2026-01-30'::date, 'CEMEX publishes in late January'),
  ('LafargeHolcim Ltd', '2026-02-20'::date, NULL),
  ('Martin Marietta Materials Inc.', '2026-02-11'::date, 'MMM publishes in early-mid February'),
  ('Vulcan Materials Company', '2026-02-18'::date, 'Vulcan publishes in mid-February'),
  ('Summit Materials Inc.', '2026-02-25'::date, NULL),
  ('Eagle Materials Inc.', '2026-05-22'::date, 'Eagle fiscal year ends March 31'),
  ('Titan Cement International S.A.', '2026-03-05'::date, NULL)
) AS d(company_name, expected_date, notes)
JOIN public.companies c ON c.name = d.company_name
ON CONFLICT (company_id, report_type, fiscal_year, fiscal_quarter) DO NOTHING;

-- Seed IR page URLs for known companies
UPDATE public.companies SET ir_page_url = 'https://www.crh.com/investors' WHERE name = 'CRH plc';
UPDATE public.companies SET ir_page_url = 'https://www.heidelbergmaterials.com/en/investor-relations' WHERE name = 'HeidelbergCement AG';
UPDATE public.companies SET ir_page_url = 'https://www.buzzi.com/en/investors' WHERE name = 'Buzzi S.p.A.';
UPDATE public.companies SET ir_page_url = 'https://www.cemex.com/investors' WHERE name = 'CEMEX S.A.B. de C.V.';
UPDATE public.companies SET ir_page_url = 'https://www.holcim.com/investors' WHERE name ILIKE '%Holcim%';
