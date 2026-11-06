-- Staff and test accounts stay active. Other people do not see them on a leaderboard.
-- The account can still read its own weekly points, so its own leaderboard row remains.

alter table public.profiles
  add column if not exists hide_from_leaderboard boolean not null default false;

comment on column public.profiles.hide_from_leaderboard is
  'Account stays active. Left off leaderboards other people see. The account can still see its own row.';

update public.profiles p
set hide_from_leaderboard = true
from auth.users u
where p.id = u.id
  and lower(u.email) in ('hello@kidda.app', 'appreview@kidda.app');

drop policy if exists "Authenticated users can read weekly points" on public.weekly_points;
create policy "Authenticated users can read weekly points"
  on public.weekly_points for select
  to authenticated
  using (
    user_id = auth.uid()
    or not exists (
      select 1
      from public.profiles p
      where p.id = weekly_points.user_id
        and p.hide_from_leaderboard
    )
  );
