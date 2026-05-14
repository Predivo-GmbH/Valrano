-- =============================================================================
-- Migration: Google Workspace Template Support (Phase 3)
-- OAuth connection + Google Slides/Sheets template integration
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table: google_connections — stores OAuth tokens for Google Workspace
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS google_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_email text NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- ---------------------------------------------------------------------------
-- Add google_file_id column to corporate_templates for Google templates
-- ---------------------------------------------------------------------------
ALTER TABLE corporate_templates
  ADD COLUMN IF NOT EXISTS google_file_id text,
  ADD COLUMN IF NOT EXISTS google_file_url text;

-- Allow 'google_linked' as a valid status for Google templates (no file upload needed)
ALTER TABLE corporate_templates
  DROP CONSTRAINT IF EXISTS corporate_templates_status_check;

ALTER TABLE corporate_templates
  ADD CONSTRAINT corporate_templates_status_check
  CHECK (status IN ('uploaded', 'parsing', 'ready', 'error', 'google_linked'));

-- Make storage_path nullable for Google templates (they don't have local files)
ALTER TABLE corporate_templates
  ALTER COLUMN storage_path DROP NOT NULL;

-- Add 'gslides_pdf' and 'gsheets_pdf' to generated_exports output formats
ALTER TABLE generated_exports
  DROP CONSTRAINT IF EXISTS generated_exports_output_format_check;

ALTER TABLE generated_exports
  ADD CONSTRAINT generated_exports_output_format_check
  CHECK (output_format IN ('pptx', 'xlsx', 'pdf', 'gslides_pdf', 'gsheets_pdf'));

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_google_connections_user ON google_connections(user_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
CREATE TRIGGER set_google_connections_updated_at
  BEFORE UPDATE ON google_connections
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE google_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own google connections"
  ON google_connections FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
