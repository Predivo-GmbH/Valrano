-- Add fallback_text column to reports for Firecrawl-extracted text
-- When direct PDF download fails (Cloudflare 403, bad URLs), Firecrawl
-- scrapes the PDF via real browser and returns text content.
-- extract-kpis uses this text when pdf_storage_path is NULL.
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS fallback_text TEXT;
