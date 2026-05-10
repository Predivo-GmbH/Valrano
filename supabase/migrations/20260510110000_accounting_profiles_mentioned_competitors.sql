-- Add mentioned_competitors column to store competitors extracted from PDF analysis
ALTER TABLE accounting_profiles
ADD COLUMN IF NOT EXISTS mentioned_competitors jsonb DEFAULT '[]'::jsonb;
