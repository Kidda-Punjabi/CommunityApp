-- One XP (Nov 2026). XP is the only score. Lifetime XP (profiles.total_xp) never resets;
-- "this week" is the XP someone earned since Monday, read from the XP log (xp_awards).
-- Weekly points (weekly_points) are no longer written; the history in it is carried into
-- the XP log by one-xp-backfill.sql so past weeks keep their leaderboards.

-- 1. Each XP line remembers the week it counts towards (UK time, weeks start Monday).
alter table public.xp_awards add column if not exists activity_week date;
update public.xp_awards
  set activity_week = public.week_start_monday((created_at at time zone 'Europe/London')::date)
  where activity_week is null;
alter table public.xp_awards
  alter column activity_week set default public.week_start_monday((now() at time zone 'Europe/London')::date),
  alter column activity_week set not null;
create index if not exists xp_awards_week_user_idx on public.xp_awards (activity_week, user_id);

-- 2. Diminishing returns instead of a hard daily cap, for games, quizzes and Practice rounds.
--    Per UK day: full XP up to daily_full_xp, half XP up to daily_half_xp, a quarter after that.
--    Every award still gives at least 1 XP. Lessons, flashcards and live sessions are always full.
alter table public.community_level_settings
  add column if not exists daily_full_xp integer not null default 100,
  add column if not exists daily_half_xp integer not null default 200;

create or replace function public.grant_profile_xp(p_xp integer, p_source text, p_source_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_full integer;
  v_half integer;
  v_used integer;
  v_start timestamptz;
  v_acc numeric := 0;
  v_grant integer;
  i integer;
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

  v_grant := least(p_xp, 100);
  if p_source in ('game', 'quiz') then
    select daily_full_xp, daily_half_xp into v_full, v_half
    from public.community_level_settings where id = 1;
    v_full := coalesce(v_full, 100);
    v_half := greatest(coalesce(v_half, 200), v_full);
    v_start := (date_trunc('day', now() at time zone 'Europe/London') at time zone 'Europe/London');
    select coalesce(sum(xp), 0) into v_used
    from public.xp_awards
    where user_id = v_user
      and source in ('game', 'quiz')
      and created_at >= v_start
      and created_at < v_start + interval '1 day';
    for i in 1..v_grant loop
      v_acc := v_acc + case
        when v_used + v_acc < v_full then 1
        when v_used + v_acc < v_half then 0.5
        else 0.25
      end;
    end loop;
    v_grant := greatest(1, floor(v_acc)::integer);
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

-- 3. Leaderboard. p_week null = all time (lifetime XP), otherwise XP earned that week.
--    Ties share a rank. People who chose to hide from the leaderboard are left out.
create or replace function public.xp_leaderboard(p_week date default null)
returns table (user_id uuid, xp bigint, rank bigint)
language sql
stable
security definer
set search_path = public
as $$
  with scores as (
    select p.id as user_id, coalesce(p.total_xp, 0)::bigint as xp
    from public.profiles p
    where p_week is null and coalesce(p.total_xp, 0) > 0
    union all
    select a.user_id, sum(a.xp)::bigint
    from public.xp_awards a
    where p_week is not null and a.activity_week = p_week and a.source <> 'opening_balance'
    group by a.user_id
  )
  select s.user_id, s.xp, rank() over (order by s.xp desc) as rank
  from scores s
  join public.profiles p on p.id = s.user_id
  where s.xp > 0 and not coalesce(p.hide_from_leaderboard, false)
  order by s.xp desc, s.user_id;
$$;

-- Weeks that have any XP, newest first (for the week picker).
create or replace function public.xp_leaderboard_weeks()
returns table (week_start date)
language sql
stable
security definer
set search_path = public
as $$
  select distinct activity_week from public.xp_awards
  where source <> 'opening_balance'
  order by activity_week desc;
$$;

-- XP each person earned between two dates (used for monthly gift card winners).
create or replace function public.xp_totals_between(p_from date, p_to date)
returns table (user_id uuid, xp bigint)
language sql
stable
security definer
set search_path = public
as $$
  select a.user_id, sum(a.xp)::bigint
  from public.xp_awards a
  join public.profiles p on p.id = a.user_id
  where (public.is_staff() or public.is_master_admin() or auth.role() = 'service_role')
    and a.activity_week >= p_from and a.activity_week < p_to
    and a.source <> 'opening_balance'
    and not coalesce(p.hide_from_leaderboard, false)
  group by a.user_id
  having sum(a.xp) > 0;
$$;

revoke all on function public.xp_leaderboard(date) from public, anon;
revoke all on function public.xp_leaderboard_weeks() from public, anon;
revoke all on function public.xp_totals_between(date, date) from public, anon;
grant execute on function public.xp_leaderboard(date) to authenticated, service_role;
grant execute on function public.xp_leaderboard_weeks() to authenticated, service_role;
grant execute on function public.xp_totals_between(date, date) to authenticated, service_role;

notify pgrst, 'reload schema';
