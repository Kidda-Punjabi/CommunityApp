-- XP unlocks the Kidda Level retake. Session awards are ledgered so a re-check-in cannot double count.

alter table public.community_level_settings
  add column if not exists xp_to_unlock jsonb not null default '{"0":100,"1":150,"2":150,"3":200,"4":200,"5":250,"6":300,"7":300,"8":350}'::jsonb,
  add column if not exists session_xp_main integer not null default 30,
  add column if not exists session_xp_bonus integer not null default 20,
  add column if not exists daily_game_xp_cap integer not null default 100;

alter table public.profiles
  add column if not exists kidda_level_provisional boolean not null default false;

alter table public.profiles
  add column if not exists forum_guidelines_accepted_at timestamptz;

alter table public.kidda_level_history
  drop constraint if exists kidda_level_history_source_check;

alter table public.kidda_level_history
  add constraint kidda_level_history_source_check
  check (source in ('placement', 'retake', 'admin', 'migration'));

create table if not exists public.xp_awards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  source text not null,
  source_id uuid not null,
  xp integer not null check (xp > 0),
  created_at timestamptz not null default now(),
  unique (user_id, source, source_id)
);

create index if not exists xp_awards_user_created_idx
  on public.xp_awards (user_id, created_at desc);

create table if not exists public.forum_read_state (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

alter table public.xp_awards enable row level security;
alter table public.forum_read_state enable row level security;

drop policy if exists "Members read own xp awards" on public.xp_awards;
create policy "Members read own xp awards"
  on public.xp_awards for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Staff read xp awards" on public.xp_awards;
create policy "Staff read xp awards"
  on public.xp_awards for select to authenticated
  using (public.is_staff() or public.is_master_admin());

drop policy if exists "Members read own forum read state" on public.forum_read_state;
create policy "Members read own forum read state"
  on public.forum_read_state for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Members insert own forum read state" on public.forum_read_state;
create policy "Members insert own forum read state"
  on public.forum_read_state for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Members update own forum read state" on public.forum_read_state;
create policy "Members update own forum read state"
  on public.forum_read_state for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.prevent_learner_level_writes()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.learner_level is distinct from old.learner_level then
    new.learner_level := old.learner_level;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_learner_level_writes on public.profiles;
create trigger prevent_learner_level_writes
  before update on public.profiles
  for each row execute function public.prevent_learner_level_writes();

create or replace function public.grant_profile_xp(p_xp integer, p_source text, p_source_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_cap integer;
  v_used integer;
  v_grant integer;
  v_start timestamptz;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  if p_xp is null or p_xp <= 0 or p_source is null or p_source_id is null then
    return 0;
  end if;
  if public.active_kid_profile_id_for(v_user) is not null then
    return 0;
  end if;

  v_grant := p_xp;
  if p_source in ('game', 'quiz') then
    select daily_game_xp_cap into v_cap from public.community_level_settings where id = 1;
    v_cap := coalesce(v_cap, 100);
    v_start := (date_trunc('day', now() at time zone 'Europe/London') at time zone 'Europe/London');
    select coalesce(sum(xp), 0) into v_used
    from public.xp_awards
    where user_id = v_user
      and source in ('game', 'quiz')
      and created_at >= v_start
      and created_at < v_start + interval '1 day';
    v_grant := least(p_xp, greatest(0, v_cap - v_used));
    if v_grant <= 0 then
      return 0;
    end if;
  end if;

  insert into public.xp_awards (user_id, source, source_id, xp)
  values (v_user, p_source, p_source_id, v_grant)
  on conflict (user_id, source, source_id) do nothing;
  if not found then
    return 0;
  end if;

  update public.profiles
  set total_xp = coalesce(total_xp, 0) + v_grant
  where id = v_user;
  return v_grant;
end;
$$;

grant execute on function public.grant_profile_xp(integer, text, uuid) to authenticated;

notify pgrst, 'reload schema';
