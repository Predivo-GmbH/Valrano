-- =============================================================================
-- Migration: Corporate Design Templates (Phase 1)
-- Upload PowerPoint/Excel templates with {{placeholders}}, generate branded reports
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table: corporate_templates — uploaded design templates (.pptx, .xlsx)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS corporate_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  file_format text NOT NULL CHECK (file_format IN ('pptx', 'xlsx', 'gslides', 'gsheets')),
  storage_path text NOT NULL,
  file_size_bytes bigint,
  -- Detected placeholders from parsing
  placeholders jsonb NOT NULL DEFAULT '[]',
  -- User-defined mapping: placeholder_key -> data_source
  placeholder_mapping jsonb NOT NULL DEFAULT '{}',
  -- Status
  status text NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'parsing', 'ready', 'error')),
  error_message text,
  -- Metadata
  slide_count int,
  thumbnail_path text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Table: generated_exports — reports generated from corporate templates
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS generated_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES corporate_templates(id) ON DELETE CASCADE,
  -- Source report (optional — can also be generated ad-hoc)
  custom_report_id uuid REFERENCES custom_reports(id) ON DELETE SET NULL,
  -- Generated output
  output_path text,
  output_format text NOT NULL CHECK (output_format IN ('pptx', 'xlsx', 'pdf')),
  -- Data snapshot used for generation
  data_snapshot jsonb NOT NULL DEFAULT '{}',
  -- Status
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'ready', 'error')),
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX idx_corporate_templates_user ON corporate_templates(user_id);
CREATE INDEX idx_corporate_templates_status ON corporate_templates(status);
CREATE INDEX idx_generated_exports_user ON generated_exports(user_id);
CREATE INDEX idx_generated_exports_template ON generated_exports(template_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
CREATE TRIGGER set_corporate_templates_updated_at
  BEFORE UPDATE ON corporate_templates
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE corporate_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own corporate templates"
  ON corporate_templates FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can CRUD own generated exports"
  ON generated_exports FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage bucket for template files
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'corporate-templates',
  'corporate-templates',
  false,
  52428800, -- 50MB
  ARRAY[
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
) ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload own templates"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'corporate-templates'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can read own templates"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'corporate-templates'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own templates"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'corporate-templates'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
