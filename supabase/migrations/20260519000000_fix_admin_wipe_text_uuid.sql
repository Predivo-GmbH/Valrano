-- Fix: admin_wipe_account failed with "operator does not exist: text = uuid"
-- Root cause: benchmark_documents.generated_by is text, not uuid
-- Fix: cast target_user_id to text in the two lines that reference generated_by

CREATE OR REPLACE FUNCTION public.admin_wipe_account(target_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  caller_email text;
  company_ids uuid[];
BEGIN
  SELECT current_setting('request.jwt.claims', true)::json ->> 'email' INTO caller_email;
  IF caller_email IS DISTINCT FROM 'roger@mueller.ro' THEN
    RAISE EXCEPTION 'Admin access denied';
  END IF;

  SELECT array_agg(cid) INTO company_ids
  FROM (
    SELECT company_id AS cid FROM my_companies WHERE user_id = target_user_id
    UNION
    SELECT pgm.company_id FROM peer_group_members pgm
    JOIN peer_groups pg ON pg.id = pgm.peer_group_id
    WHERE pg.owner_id = target_user_id
  ) sub;

  IF company_ids IS NULL THEN
    company_ids := ARRAY[]::uuid[];
  END IF;

  DELETE FROM processing_status WHERE report_id IN (SELECT id FROM reports WHERE company_id = ANY(company_ids));
  DELETE FROM extractions WHERE report_id IN (SELECT id FROM reports WHERE company_id = ANY(company_ids));
  DELETE FROM kpi_values WHERE company_id = ANY(company_ids);
  DELETE FROM reports WHERE company_id = ANY(company_ids);
  DELETE FROM publication_events WHERE company_id = ANY(company_ids);
  DELETE FROM company_news WHERE company_id = ANY(company_ids);
  DELETE FROM document_status_log WHERE document_id IN (SELECT id FROM benchmark_documents WHERE generated_by = target_user_id::text);
  DELETE FROM benchmark_documents WHERE generated_by = target_user_id::text;
  DELETE FROM benchmark_rules WHERE created_by = target_user_id;
  DELETE FROM peer_group_members WHERE peer_group_id IN (SELECT id FROM peer_groups WHERE owner_id = target_user_id);
  DELETE FROM peer_groups WHERE owner_id = target_user_id;
  DELETE FROM accounting_profiles WHERE user_id = target_user_id;
  DELETE FROM ai_usage WHERE user_id = target_user_id;
  DELETE FROM chat_messages WHERE session_id IN (SELECT id FROM chat_sessions WHERE user_id = target_user_id);
  DELETE FROM chat_sessions WHERE user_id = target_user_id;
  DELETE FROM notifications WHERE user_id = target_user_id;
  DELETE FROM workspace_members WHERE workspace_id IN (SELECT id FROM workspaces WHERE owner_id = target_user_id);
  DELETE FROM workspaces WHERE owner_id = target_user_id;
  DELETE FROM subscriptions WHERE user_id = target_user_id;
  DELETE FROM my_companies WHERE user_id = target_user_id;
  DELETE FROM companies WHERE id = ANY(company_ids);
  DELETE FROM user_profiles WHERE id = target_user_id;
  DELETE FROM api_request_logs WHERE user_id = target_user_id;
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$function$;
