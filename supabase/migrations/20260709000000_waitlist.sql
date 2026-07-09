-- Pre-launch waitlist.
-- Public registration is paused; this captures interested emails so we can
-- notify people when registration reopens. Anonymous visitors may INSERT their
-- email only — nobody (anon) can read the list back (privacy). Export via the
-- Supabase dashboard / service role.

create table if not exists waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text,
  created_at timestamptz not null default now()
);

-- Case-insensitive dedupe so the same address can't pile up.
create unique index if not exists idx_waitlist_email_lower on waitlist (lower(email));

alter table waitlist enable row level security;

-- Public sign-up: INSERT only, with a light email sanity check. No select/update/
-- delete policy for anon → the list is not publicly readable.
create policy "Public can join waitlist"
  on waitlist
  for insert
  to anon, authenticated
  with check (
    char_length(email) between 3 and 320
    and position('@' in email) > 1
  );
