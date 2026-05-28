-- Error log table for recording critical-path failures (Rule 49)
CREATE TABLE IF NOT EXISTS error_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  function_name text NOT NULL,
  operation text NOT NULL,
  error_message text,
  context jsonb DEFAULT '{}'::jsonb
);
ALTER TABLE error_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_error_log_created_at ON error_log (created_at DESC);
CREATE INDEX idx_error_log_function ON error_log (function_name, created_at DESC);
