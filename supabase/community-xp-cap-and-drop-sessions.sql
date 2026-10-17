-- Daily game cap signals the client with -1. Session-count unlock is unused.
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
      return -1;
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

alter table public.community_level_settings drop column if exists sessions_to_unlock_retake;

notify pgrst, 'reload schema';
