-- Community level progress: one settings row and a history of level changes.

create table if not exists public.community_level_settings (
  id integer primary key default 1 check (id = 1),
  sessions_to_unlock_retake integer not null default 10 check (sessions_to_unlock_retake > 0),
  retake_cooldown_days integer not null default 28 check (retake_cooldown_days >= 0)
);

insert into public.community_level_settings (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.kidda_level_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  from_level smallint check (from_level is null or from_level between 0 and 9),
  to_level smallint not null check (to_level between 0 and 9),
  source text not null check (source in ('placement', 'retake', 'admin')),
  reason text,
  changed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists kidda_level_history_user_idx
  on public.kidda_level_history (user_id, created_at desc);

alter table public.placement_test_attempts
  add column if not exists purpose text not null default 'placement';

alter table public.placement_test_attempts
  drop constraint if exists placement_test_attempts_purpose_check;

alter table public.placement_test_attempts
  add constraint placement_test_attempts_purpose_check
  check (purpose in ('placement', 'retake'));

alter table public.community_level_settings enable row level security;
alter table public.kidda_level_history enable row level security;

drop policy if exists "Members read level settings" on public.community_level_settings;
create policy "Members read level settings"
  on public.community_level_settings for select to authenticated
  using (true);

drop policy if exists "Staff update level settings" on public.community_level_settings;
create policy "Staff update level settings"
  on public.community_level_settings for update to authenticated
  using (public.is_staff() or public.is_master_admin())
  with check (public.is_staff() or public.is_master_admin());

drop policy if exists "Members read own level history" on public.kidda_level_history;
create policy "Members read own level history"
  on public.kidda_level_history for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Staff read level history" on public.kidda_level_history;
create policy "Staff read level history"
  on public.kidda_level_history for select to authenticated
  using (public.is_staff() or public.is_master_admin());

drop policy if exists "Staff insert level history" on public.kidda_level_history;
create policy "Staff insert level history"
  on public.kidda_level_history for insert to authenticated
  with check (public.is_staff() or public.is_master_admin());

insert into public.kidda_level_history (user_id, from_level, to_level, source, created_at)
select
  profiles.id,
  null,
  profiles.kidda_level,
  'placement',
  coalesce(
    (
      select attempts.completed_at
      from public.placement_test_attempts attempts
      where attempts.user_id = profiles.id
        and attempts.completed_at is not null
      order by attempts.completed_at asc
      limit 1
    ),
    now()
  )
from public.profiles
where profiles.kidda_level is not null
  and not exists (
    select 1 from public.kidda_level_history history
    where history.user_id = profiles.id
  );

notify pgrst, 'reload schema';
