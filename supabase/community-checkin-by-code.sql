create table if not exists public.community_checkin_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.community_checkin_attempts enable row level security;

revoke all on public.community_checkin_attempts from anon, authenticated;

create index if not exists community_checkin_attempts_user_created_idx
  on public.community_checkin_attempts (user_id, created_at desc);

create unique index if not exists community_occurrences_live_checkin_code_key
  on public.community_session_occurrences (checkin_code)
  where status = 'live' and checkin_code is not null;

notify pgrst, 'reload schema';
