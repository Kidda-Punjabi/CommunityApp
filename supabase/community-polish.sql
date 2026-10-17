-- Community onboarding polish: calendar invite status and session switch requests.

alter table public.community_memberships_meta
  add column if not exists calendar_invite_status text,
  add column if not exists calendar_invite_error text;

alter table public.community_memberships_meta
  drop constraint if exists community_memberships_meta_calendar_invite_status_check;

alter table public.community_memberships_meta
  add constraint community_memberships_meta_calendar_invite_status_check
  check (calendar_invite_status is null or calendar_invite_status in ('sent', 'failed'));

create table if not exists public.community_session_switch_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  from_session_id text references public.community_sessions (id) on delete set null,
  to_session_id text not null references public.community_sessions (id) on delete cascade,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null
);

create index if not exists community_session_switch_requests_status_idx
  on public.community_session_switch_requests (status, created_at);

alter table public.community_session_switch_requests enable row level security;

drop policy if exists "Members read own session switch requests" on public.community_session_switch_requests;
create policy "Members read own session switch requests"
  on public.community_session_switch_requests for select to authenticated
  using (user_id = auth.uid());

notify pgrst, 'reload schema';
