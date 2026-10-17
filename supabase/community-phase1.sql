-- Community revamp phase 1. learner_level stays the XP tier.

alter table public.profiles
  add column if not exists kidda_level smallint
  check (kidda_level is null or kidda_level between 0 and 9);

create or replace function public.protect_profiles_kidda_level()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.kidda_level is distinct from old.kidda_level then
    if current_user in ('postgres', 'supabase_admin') then
      return new;
    end if;
    if coalesce(auth.role(), '') = 'service_role' then
      return new;
    end if;
    if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin' then
      return new;
    end if;
    if exists (
      select 1 from public.profile_roles
      where user_id = auth.uid()
        and role in ('master_admin', 'community_lead')
    ) then
      return new;
    end if;
    raise exception 'kidda_level is set by the placement test';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profiles_kidda_level on public.profiles;
create trigger protect_profiles_kidda_level
  before update on public.profiles
  for each row execute function public.protect_profiles_kidda_level();

create table if not exists public.community_sessions (
  id text primary key,
  region text not null check (region in ('uk', 'canada', 'australia')),
  weekday smallint not null check (weekday between 0 and 6),
  start_time_local time not null,
  timezone text not null,
  duration_minutes integer not null default 60,
  host_tutor_id uuid references public.profiles (id) on delete set null,
  meet_url text,
  title text not null,
  weekday_label text not null,
  starts_label text,
  first_starts_on date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.community_session_occurrences (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.community_sessions (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  topic_lesson_id uuid references public.lessons (id) on delete set null,
  week_number smallint not null check (week_number between 1 and 24),
  week_number_override smallint check (week_number_override between 1 and 24),
  google_event_id text unique,
  meet_url text,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'ended', 'cancelled')),
  started_by uuid references public.profiles (id) on delete set null,
  started_at timestamptz,
  ended_at timestamptz,
  checkin_code text,
  late_after timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists community_occurrences_session_starts_idx
  on public.community_session_occurrences (session_id, starts_at);

create table if not exists public.community_checkins (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references public.community_session_occurrences (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  is_late boolean not null default false,
  added_by_tutor boolean not null default false,
  unique (occurrence_id, user_id)
);

create table if not exists public.pods (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.community_sessions (id) on delete cascade,
  band text not null check (band in ('sounds', 'beginner', 'intermediate', 'advanced')),
  min_level smallint not null check (min_level between 0 and 9),
  max_level smallint not null check (max_level between 0 and 9),
  name text not null,
  max_size integer not null default 8,
  created_at timestamptz not null default now()
);

create table if not exists public.pod_members (
  pod_id uuid not null references public.pods (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (pod_id, user_id),
  unique (user_id)
);

create table if not exists public.community_memberships_meta (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  main_session_id text references public.community_sessions (id) on delete set null,
  pod_id uuid references public.pods (id) on delete set null,
  joined_at timestamptz not null default now()
);

create table if not exists public.placement_test_items (
  id text primary key,
  level smallint not null check (level between 0 and 9),
  item_type text not null check (item_type in ('U', 'S', 'SOUND')),
  slot text not null check (slot in ('U1', 'U2', 'S', 'A', 'B')),
  prompt text not null,
  roman text,
  gurmukhi text,
  options jsonb not null,
  sort_order smallint not null,
  created_at timestamptz not null default now()
);

create table if not exists public.placement_test_audio (
  id uuid primary key default gen_random_uuid(),
  item_id text not null references public.placement_test_items (id) on delete cascade,
  option_id text,
  voice_id text not null,
  model_id text not null,
  gurmukhi_hash text not null,
  storage_path text not null,
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  unique (item_id, option_id, voice_id, gurmukhi_hash)
);

create table if not exists public.placement_test_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  lead_email text,
  lead_name text,
  lead_whatsapp text,
  start_level smallint,
  answers jsonb not null default '[]'::jsonb,
  engine jsonb,
  understanding_level smallint,
  speaking_level smallint,
  kidda_level smallint,
  sound_issue boolean not null default false,
  timed_out boolean not null default false,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  ad_id text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.community_sessions enable row level security;
alter table public.community_session_occurrences enable row level security;
alter table public.community_checkins enable row level security;
alter table public.pods enable row level security;
alter table public.pod_members enable row level security;
alter table public.community_memberships_meta enable row level security;
alter table public.placement_test_items enable row level security;
alter table public.placement_test_audio enable row level security;
alter table public.placement_test_attempts enable row level security;

drop policy if exists "Members read community sessions" on public.community_sessions;
create policy "Members read community sessions"
  on public.community_sessions for select to authenticated using (true);

drop policy if exists "Members read community occurrences" on public.community_session_occurrences;
create policy "Members read community occurrences"
  on public.community_session_occurrences for select to authenticated using (true);

revoke all on public.community_session_occurrences from anon, authenticated;
grant select (
  id, session_id, starts_at, ends_at, topic_lesson_id, week_number,
  week_number_override, meet_url, status, late_after, created_at
) on public.community_session_occurrences to authenticated;

drop policy if exists "Members read community checkins" on public.community_checkins;
create policy "Members read community checkins"
  on public.community_checkins for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.student_packages sp
      where sp.user_id = auth.uid()
        and sp.course_id = '22f0e217-92a7-46f0-b38e-651409d7d118'
        and sp.status = 'confirmed'
    )
  );

drop policy if exists "Members read pods" on public.pods;
create policy "Members read pods"
  on public.pods for select to authenticated using (true);

drop policy if exists "Members read pod members" on public.pod_members;
create policy "Members read pod members"
  on public.pod_members for select to authenticated using (true);

drop policy if exists "Members read own community meta" on public.community_memberships_meta;
create policy "Members read own community meta"
  on public.community_memberships_meta for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Members read placement items" on public.placement_test_items;
create policy "Members read placement items"
  on public.placement_test_items for select to authenticated using (true);

drop policy if exists "Members read placement audio" on public.placement_test_audio;
create policy "Members read placement audio"
  on public.placement_test_audio for select to authenticated using (approved = true);

drop policy if exists "Members read own placement attempts" on public.placement_test_attempts;
create policy "Members read own placement attempts"
  on public.placement_test_attempts for select to authenticated
  using (user_id = auth.uid());

insert into public.community_sessions (
  id, region, weekday, start_time_local, timezone, duration_minutes, host_tutor_id,
  title, weekday_label, starts_label, first_starts_on
) values
  ('uk-sun', 'uk', 0, '10:00', 'Europe/London', 60, '9967ceda-f077-4430-83b5-3198db006550', 'UK Sunday', 'Sunday', null, null),
  ('uk-wed', 'uk', 3, '19:00', 'Europe/London', 60, '9967ceda-f077-4430-83b5-3198db006550', 'UK Wednesday', 'Wednesday', null, null),
  ('ca-sat', 'canada', 6, '10:00', 'America/Toronto', 60, '9967ceda-f077-4430-83b5-3198db006550', 'Canada Saturday', 'Saturday', 'Starts 5 Dec', '2026-12-05'),
  ('ca-sun', 'canada', 0, '09:00', 'America/Vancouver', 60, '9967ceda-f077-4430-83b5-3198db006550', 'Canada Sunday', 'Sunday', 'Starts 5 Dec', '2026-12-06'),
  ('au-wed', 'australia', 3, '19:00', 'Australia/Sydney', 60, '9967ceda-f077-4430-83b5-3198db006550', 'Australia Wednesday', 'Wednesday', 'Starts 11 Nov', '2026-11-11'),
  ('au-fri', 'australia', 5, '19:00', 'Australia/Perth', 60, '9967ceda-f077-4430-83b5-3198db006550', 'Australia Friday', 'Friday', 'Starts 11 Nov', '2026-11-13')
on conflict (id) do update set
  start_time_local = excluded.start_time_local,
  timezone = excluded.timezone,
  title = excluded.title,
  weekday_label = excluded.weekday_label,
  starts_label = excluded.starts_label,
  first_starts_on = excluded.first_starts_on,
  host_tutor_id = excluded.host_tutor_id;

insert into storage.buckets (id, name, public)
values ('placement-audio', 'placement-audio', false)
on conflict (id) do nothing;

drop policy if exists "Members read approved placement audio files" on storage.objects;
create policy "Members read approved placement audio files"
  on storage.objects for select to authenticated
  using (bucket_id = 'placement-audio');

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'community_checkins'
  ) then
    alter publication supabase_realtime add table public.community_checkins;
  end if;
end $$;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array[
    'friend_request',
    'friend_request_accepted',
    'friend_level_up',
    'kudos',
    'announcement',
    'friend_game_challenge',
    'friend_game_challenge_result',
    'homework_reviewed',
    'cohort_switch_requested',
    'cohort_switch_resolved',
    'lesson_reschedule_requested',
    'lesson_reschedule_resolved',
    'student_discount_approved',
    'student_discount_rejected',
    'cohort_placement_pending',
    'cohort_new_student',
    'tutor_cover_assigned',
    'certificate_issued',
    'community_session_live'
  ]));

with review_pod as (
  insert into public.pods (session_id, band, min_level, max_level, name)
  select 'uk-wed', 'beginner', 2, 2, 'Wednesday Beginners'
  where not exists (
    select 1 from public.pod_members where user_id = '13f7e14c-6d7e-47f6-bf6c-c6aa98fe696a'
  )
  returning id
),
chosen as (
  select id from (
    select id from review_pod
    union all
    select pod_id as id from public.pod_members where user_id = '13f7e14c-6d7e-47f6-bf6c-c6aa98fe696a'
  ) picked
  limit 1
)
insert into public.pod_members (pod_id, user_id)
select id, '13f7e14c-6d7e-47f6-bf6c-c6aa98fe696a' from chosen
on conflict (user_id) do nothing;

insert into public.community_memberships_meta (user_id, main_session_id, pod_id, joined_at)
select '13f7e14c-6d7e-47f6-bf6c-c6aa98fe696a', 'uk-wed', pm.pod_id, now()
from public.pod_members pm
where pm.user_id = '13f7e14c-6d7e-47f6-bf6c-c6aa98fe696a'
on conflict (user_id) do update set
  main_session_id = excluded.main_session_id,
  pod_id = excluded.pod_id;

update public.profiles
set kidda_level = 2
where id = '13f7e14c-6d7e-47f6-bf6c-c6aa98fe696a'
  and kidda_level is null;

-- placement item bank
insert into public.placement_test_items (id, level, item_type, slot, prompt, roman, gurmukhi, options, sort_order)
select id, level, item_type, slot, prompt, roman, gurmukhi, options, sort_order
from jsonb_to_recordset($bank$[{"id":"L0a","level":0,"item_type":"SOUND","slot":"A","prompt":"Which word did you hear?","roman":"phal","gurmukhi":"ਫਲ","sort_order":1,"options":[{"id":"a","label":"fruit","correct":true},{"id":"b","label":"moment","roman":"pal","gurmukhi":"ਪਲ","correct":false}]},{"id":"L0b","level":0,"item_type":"SOUND","slot":"B","prompt":"Which word did you hear?","roman":"ghora","gurmukhi":"ਘੋੜਾ","sort_order":2,"options":[{"id":"a","label":"horse","correct":true},{"id":"b","label":"whip","roman":"kora","gurmukhi":"ਕੋੜਾ","correct":false}]},{"id":"L1U1","level":1,"item_type":"U","slot":"U1","prompt":"What does this mean?","roman":"Tuhada naa ki hai?","gurmukhi":"ਤੁਹਾਡਾ ਨਾਂ ਕੀ ਹੈ?","sort_order":1,"options":[{"id":"a","label":"What is your name?","correct":true},{"id":"b","label":"Where are you from?","correct":false},{"id":"c","label":"How old are you?","correct":false}]},{"id":"L1U2","level":1,"item_type":"U","slot":"U2","prompt":"What does this mean?","roman":"Main theek haan, tusi sunao?","gurmukhi":"ਮੈਂ ਠੀਕ ਹਾਂ, ਤੁਸੀਂ ਸੁਣਾਓ?","sort_order":2,"options":[{"id":"a","label":"I'm fine, how about you?","correct":true},{"id":"b","label":"I'm tired, are you?","correct":false},{"id":"c","label":"I'm here, where are you?","correct":false}]},{"id":"L1S","level":1,"item_type":"S","slot":"S","prompt":"How would you ask \"Where do you live?\"","sort_order":3,"options":[{"id":"a","label":"Tusi kithe rehnde ho?","gurmukhi":"ਤੁਸੀਂ ਕਿੱਥੇ ਰਹਿੰਦੇ ਹੋ?","correct":true},{"id":"b","label":"Tusi ki khaande ho?","gurmukhi":"ਤੁਸੀਂ ਕੀ ਖਾਂਦੇ ਹੋ?","correct":false},{"id":"c","label":"Tusi kaun ho?","gurmukhi":"ਤੁਸੀਂ ਕੌਣ ਹੋ?","correct":false}]},{"id":"L2U1","level":2,"item_type":"U","slot":"U1","prompt":"What does this mean?","roman":"Main roz savere chaa peenda haan.","gurmukhi":"ਮੈਂ ਰੋਜ਼ ਸਵੇਰੇ ਚਾਹ ਪੀਂਦਾ ਹਾਂ।","sort_order":1,"options":[{"id":"a","label":"I drink tea every morning.","correct":true},{"id":"b","label":"I drank tea this morning.","correct":false},{"id":"c","label":"I want tea in the morning.","correct":false}]},{"id":"L2U2","level":2,"item_type":"U","slot":"U2","prompt":"What does this mean?","roman":"Mainu thoda paani chahida hai.","gurmukhi":"ਮੈਨੂੰ ਥੋੜ੍ਹਾ ਪਾਣੀ ਚਾਹੀਦਾ ਹੈ।","sort_order":2,"options":[{"id":"a","label":"I need a little water.","correct":true},{"id":"b","label":"I drank a lot of water.","correct":false},{"id":"c","label":"Give me water quickly.","correct":false}]},{"id":"L2S","level":2,"item_type":"S","slot":"S","prompt":"How would you say \"She is cooking food\"?","sort_order":3,"options":[{"id":"a","label":"Oh khaana bana rahi hai.","gurmukhi":"ਉਹ ਖਾਣਾ ਬਣਾ ਰਹੀ ਹੈ।","correct":true},{"id":"b","label":"Oh khaana kha rahi hai.","gurmukhi":"ਉਹ ਖਾਣਾ ਖਾ ਰਹੀ ਹੈ।","correct":false},{"id":"c","label":"Oh khaana banaayegi.","gurmukhi":"ਉਹ ਖਾਣਾ ਬਣਾਏਗੀ।","correct":false}]},{"id":"L3U1","level":3,"item_type":"U","slot":"U1","prompt":"What does this mean?","roman":"Kal assi daadi de ghar gaye si.","gurmukhi":"ਕੱਲ੍ਹ ਅਸੀਂ ਦਾਦੀ ਦੇ ਘਰ ਗਏ ਸੀ।","sort_order":1,"options":[{"id":"a","label":"Yesterday we went to grandma's house.","correct":true},{"id":"b","label":"Tomorrow we'll go to grandma's house.","correct":false},{"id":"c","label":"We're at grandma's house now.","correct":false}]},{"id":"L3U2","level":3,"item_type":"U","slot":"U2","prompt":"What does this mean?","roman":"Agle hafte main India jaavanga.","gurmukhi":"ਅਗਲੇ ਹਫ਼ਤੇ ਮੈਂ ਇੰਡੀਆ ਜਾਵਾਂਗਾ।","sort_order":2,"options":[{"id":"a","label":"Next week I will go to India.","correct":true},{"id":"b","label":"Last week I went to India.","correct":false},{"id":"c","label":"I want to go to India one day.","correct":false}]},{"id":"L3S","level":3,"item_type":"S","slot":"S","prompt":"How would you say \"I watched a film yesterday\"?","sort_order":3,"options":[{"id":"a","label":"Main kal film dekhi.","gurmukhi":"ਮੈਂ ਕੱਲ੍ਹ ਫ਼ਿਲਮ ਦੇਖੀ।","correct":true},{"id":"b","label":"Main kal film dekhanga.","gurmukhi":"ਮੈਂ ਕੱਲ੍ਹ ਫ਼ਿਲਮ ਦੇਖਾਂਗਾ।","correct":false},{"id":"c","label":"Main film dekh reha haan.","gurmukhi":"ਮੈਂ ਫ਼ਿਲਮ ਦੇਖ ਰਿਹਾ ਹਾਂ।","correct":false}]},{"id":"L4U1","level":4,"item_type":"U","slot":"U1","prompt":"What does this mean?","roman":"Main aa nahi sakeya kyunki mainu kamm si.","gurmukhi":"ਮੈਂ ਆ ਨਹੀਂ ਸਕਿਆ ਕਿਉਂਕਿ ਮੈਨੂੰ ਕੰਮ ਸੀ।","sort_order":1,"options":[{"id":"a","label":"I couldn't come because I had work.","correct":true},{"id":"b","label":"I didn't want to come, I had no work.","correct":false},{"id":"c","label":"I will come after work.","correct":false}]},{"id":"L4U2","level":4,"item_type":"U","slot":"U2","prompt":"What does this mean?","roman":"Jadon main chhota si, assi pind vich rehnde si.","gurmukhi":"ਜਦੋਂ ਮੈਂ ਛੋਟਾ ਸੀ, ਅਸੀਂ ਪਿੰਡ ਵਿੱਚ ਰਹਿੰਦੇ ਸੀ।","sort_order":2,"options":[{"id":"a","label":"When I was young, we lived in the village.","correct":true},{"id":"b","label":"When I'm older, we'll live in the village.","correct":false},{"id":"c","label":"I'm young, so we live in the village.","correct":false}]},{"id":"L4S","level":4,"item_type":"S","slot":"S","prompt":"How would you say \"I can speak a little Punjabi, but I can't read it\"?","sort_order":3,"options":[{"id":"a","label":"Main thodi Punjabi bol sakda haan, par parh nahi sakda.","gurmukhi":"ਮੈਂ ਥੋੜ੍ਹੀ ਪੰਜਾਬੀ ਬੋਲ ਸਕਦਾ ਹਾਂ, ਪਰ ਪੜ੍ਹ ਨਹੀਂ ਸਕਦਾ।","correct":true},{"id":"b","label":"Main thodi Punjabi bol sakda haan, kyunki parh nahi sakda.","gurmukhi":"ਮੈਂ ਥੋੜ੍ਹੀ ਪੰਜਾਬੀ ਬੋਲ ਸਕਦਾ ਹਾਂ, ਕਿਉਂਕਿ ਪੜ੍ਹ ਨਹੀਂ ਸਕਦਾ।","correct":false},{"id":"c","label":"Main thodi Punjabi bolni chahunda haan, te parh sakda haan.","gurmukhi":"ਮੈਂ ਥੋੜ੍ਹੀ ਪੰਜਾਬੀ ਬੋਲਣੀ ਚਾਹੁੰਦਾ ਹਾਂ, ਤੇ ਪੜ੍ਹ ਸਕਦਾ ਹਾਂ।","correct":false}]},{"id":"L5U1","level":5,"item_type":"U","slot":"U1","prompt":"What does this mean?","roman":"Mere khayal naal, eh gal theek nahi.","gurmukhi":"ਮੇਰੇ ਖ਼ਿਆਲ ਨਾਲ, ਇਹ ਗੱਲ ਠੀਕ ਨਹੀਂ।","sort_order":1,"options":[{"id":"a","label":"In my opinion, this isn't right.","correct":true},{"id":"b","label":"I remember this wasn't right.","correct":false},{"id":"c","label":"Tell me if this is right.","correct":false}]},{"id":"L5U2","level":5,"item_type":"U","slot":"U2","prompt":"What does this mean?","roman":"Main tuhade naal bilkul sehmat haan.","gurmukhi":"ਮੈਂ ਤੁਹਾਡੇ ਨਾਲ ਬਿਲਕੁਲ ਸਹਿਮਤ ਹਾਂ।","sort_order":2,"options":[{"id":"a","label":"I completely agree with you.","correct":true},{"id":"b","label":"I'm completely with you right now.","correct":false},{"id":"c","label":"I don't agree with you at all.","correct":false}]},{"id":"L5S","level":5,"item_type":"S","slot":"S","prompt":"Your chacha says something you disagree with. What's the most respectful reply?","sort_order":3,"options":[{"id":"a","label":"Maaf karna ji, par mainu lagda hai ki gal kujh hor hai.","gurmukhi":"ਮਾਫ਼ ਕਰਨਾ ਜੀ, ਪਰ ਮੈਨੂੰ ਲੱਗਦਾ ਹੈ ਕਿ ਗੱਲ ਕੁਝ ਹੋਰ ਹੈ।","correct":true},{"id":"b","label":"Nahi, tusi galat ho.","gurmukhi":"ਨਹੀਂ, ਤੁਸੀਂ ਗ਼ਲਤ ਹੋ।","correct":false},{"id":"c","label":"Chhaddo, koi gal nahi.","gurmukhi":"ਛੱਡੋ, ਕੋਈ ਗੱਲ ਨਹੀਂ।","correct":false}]},{"id":"L6U1","level":6,"item_type":"U","slot":"U1","prompt":"What does this mean?","roman":"Je mainu pata hunda, taan main pehlaan hi das dinda.","gurmukhi":"ਜੇ ਮੈਨੂੰ ਪਤਾ ਹੁੰਦਾ, ਤਾਂ ਮੈਂ ਪਹਿਲਾਂ ਹੀ ਦੱਸ ਦਿੰਦਾ।","sort_order":1,"options":[{"id":"a","label":"If I had known, I would have told you earlier.","correct":true},{"id":"b","label":"When I find out, I'll tell you first.","correct":false},{"id":"c","label":"I knew, so I told you earlier.","correct":false}]},{"id":"L6U2","level":6,"item_type":"U","slot":"U2","prompt":"What does this mean?","roman":"Je meenh na peya, taan assi baahar chalange.","gurmukhi":"ਜੇ ਮੀਂਹ ਨਾ ਪਿਆ, ਤਾਂ ਅਸੀਂ ਬਾਹਰ ਚੱਲਾਂਗੇ।","sort_order":2,"options":[{"id":"a","label":"If it doesn't rain, we'll go out.","correct":true},{"id":"b","label":"It rained, so we didn't go out.","correct":false},{"id":"c","label":"Even if it rains, we'll go out.","correct":false}]},{"id":"L6S","level":6,"item_type":"S","slot":"S","prompt":"How would you say \"If I had more time, I'd learn to cook\"?","sort_order":3,"options":[{"id":"a","label":"Je mere kol hor samaa hunda, taan main khaana banauna sikhda.","gurmukhi":"ਜੇ ਮੇਰੇ ਕੋਲ ਹੋਰ ਸਮਾਂ ਹੁੰਦਾ, ਤਾਂ ਮੈਂ ਖਾਣਾ ਬਣਾਉਣਾ ਸਿੱਖਦਾ।","correct":true},{"id":"b","label":"Jadon mere kol samaa si, main khaana banaunda si.","gurmukhi":"ਜਦੋਂ ਮੇਰੇ ਕੋਲ ਸਮਾਂ ਸੀ, ਮੈਂ ਖਾਣਾ ਬਣਾਉਂਦਾ ਸੀ।","correct":false},{"id":"c","label":"Mere kol samaa hai, main khaana banauna sikhanga.","gurmukhi":"ਮੇਰੇ ਕੋਲ ਸਮਾਂ ਹੈ, ਮੈਂ ਖਾਣਾ ਬਣਾਉਣਾ ਸਿੱਖਾਂਗਾ।","correct":false}]},{"id":"L7U1","level":7,"item_type":"U","slot":"U1","prompt":"What does this mean?","roman":"Ohne keha si ki aaunga, par hun tak koi khabar ni aayi.","gurmukhi":"ਉਹਨੇ ਕਿਹਾ ਸੀ ਕਿ ਆਊਂਗਾ, ਪਰ ਹੁਣ ਤੱਕ ਕੋਈ ਖ਼ਬਰ ਨੀ ਆਈ।","sort_order":1,"options":[{"id":"a","label":"He'd said he'd come, but there's been no news yet.","correct":true},{"id":"b","label":"He came and brought news.","correct":false},{"id":"c","label":"He said there's no news, so he won't come.","correct":false}]},{"id":"L7U2","level":7,"item_type":"U","slot":"U2","prompt":"What does this mean?","roman":"Gal eh aa ki mainu vi ni pata si.","gurmukhi":"ਗੱਲ ਇਹ ਆ ਕਿ ਮੈਨੂੰ ਵੀ ਨੀ ਪਤਾ ਸੀ।","sort_order":2,"options":[{"id":"a","label":"The thing is, I didn't know either.","correct":true},{"id":"b","label":"Tell him I didn't know.","correct":false},{"id":"c","label":"I knew, and so did he.","correct":false}]},{"id":"L7S","level":7,"item_type":"S","slot":"S","prompt":"A relative asks \"Hor sunao, ki haal chaal?\" What's the most natural reply?","roman":"Hor sunao, ki haal chaal?","gurmukhi":"ਹੋਰ ਸੁਣਾਓ, ਕੀ ਹਾਲ ਚਾਲ?","sort_order":3,"options":[{"id":"a","label":"Bas vadhiya ji, tusi sunao!","gurmukhi":"ਬੱਸ ਵਧੀਆ ਜੀ, ਤੁਸੀਂ ਸੁਣਾਓ!","correct":true},{"id":"b","label":"Main gaana sunaanga.","gurmukhi":"ਮੈਂ ਗਾਣਾ ਸੁਣਾਵਾਂਗਾ।","correct":false},{"id":"c","label":"Haan ji, haal vich haan.","gurmukhi":"ਹਾਂ ਜੀ, ਹਾਲ ਵਿੱਚ ਹਾਂ।","correct":false}]},{"id":"L8U1","level":8,"item_type":"U","slot":"U1","prompt":"What does this saying mean?","roman":"Ghar di murgi daal baraabar.","gurmukhi":"ਘਰ ਦੀ ਮੁਰਗੀ ਦਾਲ ਬਰਾਬਰ।","sort_order":1,"options":[{"id":"a","label":"People undervalue what they already have.","correct":true},{"id":"b","label":"Home cooking is always the best.","correct":false},{"id":"c","label":"Share your food with your neighbours.","correct":false}]},{"id":"L8U2","level":8,"item_type":"U","slot":"U2","prompt":"What does this saying mean?","roman":"Ik anaar, sau bimaar.","gurmukhi":"ਇੱਕ ਅਨਾਰ, ਸੌ ਬਿਮਾਰ।","sort_order":2,"options":[{"id":"a","label":"One thing, and far too many people want it.","correct":true},{"id":"b","label":"Fruit keeps you healthy.","correct":false},{"id":"c","label":"One bad apple spoils the rest.","correct":false}]},{"id":"L8S","level":8,"item_type":"S","slot":"S","prompt":"A friend boasts loudly but knows very little. Which saying fits?","sort_order":3,"options":[{"id":"a","label":"Thotha chana, baaje ghana.","gurmukhi":"ਥੋਥਾ ਚਣਾ, ਬਾਜੇ ਘਣਾ।","correct":true},{"id":"b","label":"Ghar di murgi daal baraabar.","gurmukhi":"ਘਰ ਦੀ ਮੁਰਗੀ ਦਾਲ ਬਰਾਬਰ।","correct":false},{"id":"c","label":"Ik anaar, sau bimaar.","gurmukhi":"ਇੱਕ ਅਨਾਰ, ਸੌ ਬਿਮਾਰ।","correct":false}]},{"id":"L9U1","level":9,"item_type":"U","slot":"U1","prompt":"What does this mean?","roman":"Ohne gal taan keh ditti, par ohda lehja kujh hor hi dass reha si.","gurmukhi":"ਉਹਨੇ ਗੱਲ ਤਾਂ ਕਹਿ ਦਿੱਤੀ, ਪਰ ਉਹਦਾ ਲਹਿਜਾ ਕੁਝ ਹੋਰ ਹੀ ਦੱਸ ਰਿਹਾ ਸੀ।","sort_order":1,"options":[{"id":"a","label":"He said it, but his tone said something else.","correct":true},{"id":"b","label":"He said it, then told the story again.","correct":false},{"id":"c","label":"He didn't say it, but he wrote it down.","correct":false}]},{"id":"L9U2","level":9,"item_type":"U","slot":"U2","prompt":"What does this mean?","roman":"Tuhadi kirpa naal saara kamm sukhaala ho gaya.","gurmukhi":"ਤੁਹਾਡੀ ਕਿਰਪਾ ਨਾਲ ਸਾਰਾ ਕੰਮ ਸੁਖਾਲਾ ਹੋ ਗਿਆ।","sort_order":2,"options":[{"id":"a","label":"Thanks to your kindness, everything went smoothly.","correct":true},{"id":"b","label":"Please help me, the work is hard.","correct":false},{"id":"c","label":"You did all the work yourself.","correct":false}]},{"id":"L9S","level":9,"item_type":"S","slot":"S","prompt":"You're visiting a family who has just lost an elder. What's the right thing to say?","sort_order":3,"options":[{"id":"a","label":"Waheguru ohna di aatma nu shaanti bakhshe.","gurmukhi":"ਵਾਹਿਗੁਰੂ ਉਹਨਾਂ ਦੀ ਆਤਮਾ ਨੂੰ ਸ਼ਾਂਤੀ ਬਖ਼ਸ਼ੇ।","correct":true},{"id":"b","label":"Koi gal nahi, chalo agge vadhiye.","gurmukhi":"ਕੋਈ ਗੱਲ ਨਹੀਂ, ਚੱਲੋ ਅੱਗੇ ਵਧੀਏ।","correct":false},{"id":"c","label":"Bahut vadhiya hoya ji.","gurmukhi":"ਬਹੁਤ ਵਧੀਆ ਹੋਇਆ ਜੀ।","correct":false}]}]$bank$::jsonb) as x(
  id text, level smallint, item_type text, slot text, prompt text, roman text, gurmukhi text, options jsonb, sort_order smallint
)
on conflict (id) do update set
  prompt = excluded.prompt,
  roman = excluded.roman,
  gurmukhi = excluded.gurmukhi,
  options = excluded.options;

create or replace function public.community_find_user_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1
$$;

revoke all on function public.community_find_user_by_email(text) from public, anon, authenticated;
grant execute on function public.community_find_user_by_email(text) to service_role;

create or replace function public.community_member_contacts(p_ids uuid[])
returns table (id uuid, email text, phone text)
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.id, u.email::text, u.phone::text
  from auth.users u
  where u.id = any(p_ids)
$$;

revoke all on function public.community_member_contacts(uuid[]) from public, anon, authenticated;
grant execute on function public.community_member_contacts(uuid[]) to service_role;

notify pgrst, 'reload schema';

