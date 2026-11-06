-- Practice hearts: 3 hearts, each mixed Play uses one, and one comes back every 8 hours
-- (one at a time, so a learner who empties all 3 is full again 24 hours later).
-- Course practice and Premium members never use hearts; the app checks Premium before spending.
-- Learners can only read their own row. Spending and refilling happen in the functions below,
-- so the count can't be edited from the browser.

create table if not exists public.practise_hearts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  hearts smallint not null default 3 check (hearts between 0 and 3),
  -- When the next heart started charging. Null while hearts are full.
  charging_since timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.practise_hearts enable row level security;

drop policy if exists "practise_hearts_select_own" on public.practise_hearts;
create policy "practise_hearts_select_own" on public.practise_hearts
  for select using (auth.uid() = user_id);

-- Adds any hearts that have finished charging. Returns the row as it now stands.
create or replace function public.practise_hearts_refill(p_user uuid)
returns public.practise_hearts
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.practise_hearts;
  step constant interval := interval '8 hours';
  gained int;
begin
  insert into public.practise_hearts (user_id) values (p_user) on conflict (user_id) do nothing;
  select * into r from public.practise_hearts where user_id = p_user for update;
  if r.hearts < 3 and r.charging_since is not null then
    gained := floor(extract(epoch from (now() - r.charging_since)) / extract(epoch from step))::int;
    if gained > 0 then
      r.hearts := least(3, r.hearts + gained);
      r.charging_since := case when r.hearts >= 3 then null else r.charging_since + step * gained end;
      update public.practise_hearts
        set hearts = r.hearts, charging_since = r.charging_since, updated_at = now()
        where user_id = p_user;
    end if;
  end if;
  return r;
end;
$$;

-- The signed-in learner's hearts, refilled first.
create or replace function public.practise_hearts_state()
returns table (hearts int, next_heart_at timestamptz, full_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  r public.practise_hearts;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  r := public.practise_hearts_refill(auth.uid());
  return query select
    r.hearts::int,
    case when r.hearts < 3 then r.charging_since + interval '8 hours' end,
    case when r.hearts < 3 then r.charging_since + interval '8 hours' * (3 - r.hearts) end;
end;
$$;

-- Uses one heart for a mixed Play. Raises 'no_hearts' when there are none left.
create or replace function public.practise_hearts_spend()
returns table (hearts int, next_heart_at timestamptz, full_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  r public.practise_hearts;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  r := public.practise_hearts_refill(auth.uid());
  if r.hearts <= 0 then raise exception 'no_hearts'; end if;
  update public.practise_hearts
    set hearts = r.hearts - 1,
        charging_since = coalesce(r.charging_since, now()),
        updated_at = now()
    where user_id = auth.uid()
    returning * into r;
  return query select
    r.hearts::int,
    r.charging_since + interval '8 hours',
    r.charging_since + interval '8 hours' * (3 - r.hearts);
end;
$$;

revoke all on function public.practise_hearts_refill(uuid) from public, anon, authenticated;
grant execute on function public.practise_hearts_state() to authenticated;
grant execute on function public.practise_hearts_spend() to authenticated;

notify pgrst, 'reload schema';
