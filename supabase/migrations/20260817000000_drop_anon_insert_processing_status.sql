-- Fleet-hardening (2026-08-17): drop a misnamed anon-INSERT policy on
-- public.processing_status. It was named "Service role can insert processing
-- status" but had no `TO service_role` clause, so it actually allowed ANON to
-- INSERT (found by the live-DB RLS sweep; prod only, staging was already clean).
-- The real writer is the analyze-accounting-profile edge function using the
-- service_role key, which bypasses RLS — so dropping this policy removes the
-- anon hole without affecting legitimate writes. Idempotent.
drop policy if exists "Service role can insert processing status" on public.processing_status;
