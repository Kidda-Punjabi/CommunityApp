-- Register interest: when the person wants to start, and whether the team was told.
-- Already applied to the live project on 2026-11-06.
alter table public.course_interest_signups
  add column if not exists start_timeline text null,
  add column if not exists team_notified_at timestamptz null,
  add column if not exists ghl_opportunity_id text null;
alter table public.course_interest_signups
  drop constraint if exists course_interest_signups_start_timeline_check;
alter table public.course_interest_signups
  add constraint course_interest_signups_start_timeline_check
  check (start_timeline is null or start_timeline in ('straight_away','next_2_3_weeks','within_a_month','in_2_3_months','sometime_future'));
notify pgrst, 'reload schema';
