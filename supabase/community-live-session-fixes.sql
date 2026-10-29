-- Community live session: realtime filters, lookup indexes, instant session switches.

alter table public.community_checkins replica identity full;
alter table public.community_rooms replica identity full;
alter table public.community_room_members replica identity full;
alter table public.community_room_activities replica identity full;
alter table public.community_room_signoffs replica identity full;
alter table public.community_debate_votes replica identity full;
alter table public.community_session_occurrences replica identity full;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'community_checkins',
    'community_rooms',
    'community_room_members',
    'community_room_activities',
    'community_room_signoffs',
    'community_debate_votes',
    'community_session_occurrences'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;

create index if not exists community_checkins_occurrence_user_idx
  on public.community_checkins (occurrence_id, user_id);

create index if not exists community_room_members_occurrence_user_idx
  on public.community_room_members (occurrence_id, user_id);

create index if not exists community_room_members_room_idx
  on public.community_room_members (room_id);

create index if not exists community_room_activities_room_position_idx
  on public.community_room_activities (room_id, position);

create index if not exists community_room_signoffs_activity_idx
  on public.community_room_signoffs (activity_id);

create index if not exists community_debate_votes_activity_idx
  on public.community_debate_votes (activity_id);

create index if not exists community_occurrences_session_ends_idx
  on public.community_session_occurrences (session_id, ends_at);

create index if not exists community_occurrences_status_idx
  on public.community_session_occurrences (status);

create index if not exists student_packages_user_course_status_idx
  on public.student_packages (user_id, course_id, status);

create index if not exists community_sessions_host_active_idx
  on public.community_sessions (host_tutor_id)
  where is_active;

alter table public.community_session_switch_requests
  drop constraint if exists community_session_switch_requests_status_check;

alter table public.community_session_switch_requests
  add constraint community_session_switch_requests_status_check
  check (status in ('pending', 'approved', 'declined', 'auto_approved'));

notify pgrst, 'reload schema';
