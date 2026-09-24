-- =============================================================================
-- Valrano — Create the `reports` storage bucket
-- Migration: 20260924000000_reports_storage_bucket
--
-- WHY THIS EXISTS. The `reports` storage bucket holds every uploaded and
-- downloaded company PDF. It is written and read exclusively by service-role
-- (adminClient.storage.from('reports')) in the edge functions:
--   upload-report, download-report, extract-kpis, analyze-accounting-profile,
--   render-benchmark-pdf, extract-report-context.
-- The bucket was created by hand in the production project (mkdeftmubrkseyrrbzvp)
-- and never captured in a migration, so any fresh copy of the database — the
-- staging/test project (vfwpcgdkrwqhdivfzmrg) — had NO `reports` bucket. There,
-- upload-report failed at `.from('reports').upload(...)` with "Bucket not found":
-- "the test copy cannot take a report, its report storage is missing."
--
-- Precedent: 20260514200000_corporate_templates.sql creates the
-- `corporate-templates` bucket the same way. This mirrors that pattern.
--
-- Access model: all access is via service role, which bypasses RLS, so this
-- bucket needs no storage.objects policies (the frontend never touches the
-- bucket directly — uploads go through the upload-report edge function, and the
-- client only reads the public.reports TABLE). Everything uploaded is a PDF and
-- upload-report already enforces a 50MB / application/pdf limit in code; the
-- bucket limits mirror that.
--
-- Idempotent: ON CONFLICT (id) DO NOTHING makes this safe to run against a
-- project that already has the bucket (i.e. production), so it never disturbs the
-- existing prod bucket or its contents.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reports',
  'reports',
  false,
  52428800, -- 50MB, matches the size cap enforced in upload-report/index.ts
  ARRAY['application/pdf']
) ON CONFLICT (id) DO NOTHING;
