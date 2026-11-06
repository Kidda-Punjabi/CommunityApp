-- One XP cutover. Run ONCE, right after the One XP code is live.
-- 1. Weekly points stop: lesson completion no longer adds weekly points, and
--    award_weekly_points does nothing (older app versions may still call it).
-- 2. Weekly points history is carried into the XP log. Nobody's XP goes down:
--  a) For every week, if someone's old weekly points beat the XP logged that week, the
--     difference is added as a 'history' line in that week. Past weekly leaderboards stay
--     the same or higher for everyone.
--  b) If the log then adds up to more than their lifetime XP, lifetime XP is raised to match.
--     Their level progress (xp_at_level_start) moves by the same amount, so no level test
--     unlocks by surprise.
--  c) If lifetime XP is still higher than the log, the gap is logged as 'opening_balance'.
--     It counts in All time but in no week.
create or replace function public.award_weekly_points(p_points integer, p_activity_date date default current_date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Retired Nov 2026 (One XP). XP in xp_awards is the only score.
  return;
end;
$$;

create or replace function public.try_award_lesson_completion_points(p_lesson_id uuid, p_activity_date date default current_date)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_status record;
  v_awarded_user uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  -- Kid sessions use kid_lesson_xp_awarded (TypeScript).
  if public.active_kid_profile_id_for(v_user_id) is not null then
    return false;
  end if;
  select * into v_status from public.get_lesson_completion_status(v_user_id, p_lesson_id) limit 1;
  if v_status is null or not v_status.fully_complete then
    return false;
  end if;
  -- Once per lesson. The app then grants the lesson XP (grant_profile_xp, source 'lesson').
  insert into public.weekly_lesson_points_awarded (user_id, lesson_id)
  values (v_user_id, p_lesson_id)
  on conflict do nothing
  returning user_id into v_awarded_user;
  return v_awarded_user is not null;
end;
$$;

do $$
declare
  v_before bigint;
  v_after bigint;
  v_down integer;
begin
  if exists (select 1 from public.xp_awards where source in ('history', 'opening_balance')) then
    raise notice 'One XP backfill already ran. Nothing to do.';
    return;
  end if;

  create temp table one_xp_before on commit drop as
    select id as user_id, coalesce(total_xp, 0) as xp from public.profiles;
  select sum(xp) into v_before from one_xp_before;

  -- a) week-by-week history
  insert into public.xp_awards (user_id, source, source_id, xp, activity_week, created_at)
  select w.user_id, 'history', md5(w.user_id::text || w.week_start::text)::uuid,
         w.points - coalesce(l.xp, 0), w.week_start,
         (w.week_start::timestamp + interval '12 hours') at time zone 'Europe/London'
  from public.weekly_points w
  left join (
    select user_id, activity_week, sum(xp) as xp from public.xp_awards group by 1, 2
  ) l on l.user_id = w.user_id and l.activity_week = w.week_start
  where w.points > coalesce(l.xp, 0);

  -- b) raise lifetime XP where the log is now higher
  update public.profiles p
  set total_xp = s.logged,
      xp_at_level_start = coalesce(p.xp_at_level_start, 0) + (s.logged - coalesce(p.total_xp, 0))
  from (select user_id, sum(xp) as logged from public.xp_awards group by user_id) s
  where s.user_id = p.id and s.logged > coalesce(p.total_xp, 0);

  -- c) opening balance where lifetime XP is higher than the log
  insert into public.xp_awards (user_id, source, source_id, xp, activity_week, created_at)
  select p.id, 'opening_balance', md5(p.id::text || 'opening')::uuid,
         coalesce(p.total_xp, 0) - coalesce(s.logged, 0), date '2026-06-08',
         timestamptz '2026-06-08 12:00:00+01'
  from public.profiles p
  left join (select user_id, sum(xp) as logged from public.xp_awards group by user_id) s on s.user_id = p.id
  where coalesce(p.total_xp, 0) > coalesce(s.logged, 0);

  -- Check: nobody went down, and the log matches lifetime XP for everyone.
  select count(*) into v_down
  from one_xp_before b join public.profiles p on p.id = b.user_id
  where coalesce(p.total_xp, 0) < b.xp;
  if v_down > 0 then
    raise exception 'One XP backfill would lower XP for % people. Rolled back.', v_down;
  end if;
  if exists (
    select 1 from public.profiles p
    left join (select user_id, sum(xp) as logged from public.xp_awards group by user_id) s on s.user_id = p.id
    where coalesce(p.total_xp, 0) <> coalesce(s.logged, 0)
  ) then
    raise exception 'One XP backfill: log and lifetime XP do not match. Rolled back.';
  end if;
  select sum(coalesce(total_xp, 0)) into v_after from public.profiles;
  raise notice 'One XP backfill done. Lifetime XP before %, after %.', v_before, v_after;
end $$;

notify pgrst, 'reload schema';
