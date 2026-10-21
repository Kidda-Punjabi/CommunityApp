-- Community breakout rooms, activities, and debate bank.

create table if not exists public.community_rooms (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references public.community_session_occurrences (id) on delete cascade,
  room_number smallint not null check (room_number > 0),
  band text not null check (band in ('sounds', 'beginner', 'intermediate', 'advanced')),
  status text not null default 'suggested' check (status in ('suggested', 'approved', 'closed')),
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (occurrence_id, room_number)
);

create table if not exists public.community_room_members (
  room_id uuid not null references public.community_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  occurrence_id uuid not null references public.community_session_occurrences (id) on delete cascade,
  assigned_by text not null default 'auto' check (assigned_by in ('auto', 'host')),
  assigned_at timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (occurrence_id, user_id)
);

create or replace function public.community_room_member_set_occurrence()
returns trigger
language plpgsql
as $$
begin
  select occurrence_id into new.occurrence_id
  from public.community_rooms
  where id = new.room_id;
  if new.occurrence_id is null then
    raise exception 'Room not found';
  end if;
  return new;
end;
$$;

drop trigger if exists community_room_member_set_occurrence on public.community_room_members;
create trigger community_room_member_set_occurrence
  before insert or update of room_id on public.community_room_members
  for each row execute function public.community_room_member_set_occurrence();

create table if not exists public.community_room_activities (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.community_rooms (id) on delete cascade,
  position smallint not null check (position >= 0),
  kind text not null check (kind in ('warmup_debate', 'flashcards', 'point_race', 'quiz', 'speak_it', 'speaking_prompts', 'bonus')),
  title text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'locked' check (status in ('locked', 'active', 'done')),
  unlocked_at timestamptz,
  completed_at timestamptz,
  unique (room_id, position)
);

create table if not exists public.community_room_signoffs (
  activity_id uuid not null references public.community_room_activities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  signed_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);

create table if not exists public.community_debates (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  option_a text not null,
  option_b text not null,
  prompt_pa text,
  romanised text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.community_debate_votes (
  activity_id uuid not null references public.community_room_activities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  choice text not null check (choice in ('a', 'b')),
  voted_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);

create index if not exists community_rooms_occurrence_idx on public.community_rooms (occurrence_id);
create index if not exists community_room_activities_room_idx on public.community_room_activities (room_id);
create index if not exists community_room_signoffs_user_idx on public.community_room_signoffs (user_id);

create or replace function public.community_user_in_room(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.community_room_members
    where room_id = p_room_id
      and user_id = auth.uid()
  );
$$;

revoke all on function public.community_user_in_room(uuid) from public;
grant execute on function public.community_user_in_room(uuid) to authenticated;

alter table public.community_rooms enable row level security;
alter table public.community_room_members enable row level security;
alter table public.community_room_activities enable row level security;
alter table public.community_room_signoffs enable row level security;
alter table public.community_debates enable row level security;
alter table public.community_debate_votes enable row level security;

drop policy if exists community_rooms_member_select on public.community_rooms;
create policy community_rooms_member_select on public.community_rooms
  for select to authenticated
  using (public.community_user_in_room(id));

drop policy if exists community_room_members_member_select on public.community_room_members;
create policy community_room_members_member_select on public.community_room_members
  for select to authenticated
  using (public.community_user_in_room(room_id));

drop policy if exists community_room_activities_member_select on public.community_room_activities;
create policy community_room_activities_member_select on public.community_room_activities
  for select to authenticated
  using (public.community_user_in_room(room_id));

drop policy if exists community_room_signoffs_member_select on public.community_room_signoffs;
create policy community_room_signoffs_member_select on public.community_room_signoffs
  for select to authenticated
  using (
    exists (
      select 1 from public.community_room_activities activity
      where activity.id = activity_id
        and public.community_user_in_room(activity.room_id)
    )
  );

drop policy if exists community_room_signoffs_own_insert on public.community_room_signoffs;
create policy community_room_signoffs_own_insert on public.community_room_signoffs
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.community_room_activities activity
      where activity.id = activity_id
        and public.community_user_in_room(activity.room_id)
    )
  );

drop policy if exists community_room_signoffs_own_update on public.community_room_signoffs;
create policy community_room_signoffs_own_update on public.community_room_signoffs
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists community_debate_votes_member_select on public.community_debate_votes;
create policy community_debate_votes_member_select on public.community_debate_votes
  for select to authenticated
  using (
    exists (
      select 1 from public.community_room_activities activity
      where activity.id = activity_id
        and public.community_user_in_room(activity.room_id)
    )
  );

drop policy if exists community_debate_votes_own_insert on public.community_debate_votes;
create policy community_debate_votes_own_insert on public.community_debate_votes
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.community_room_activities activity
      where activity.id = activity_id
        and public.community_user_in_room(activity.room_id)
    )
  );

drop policy if exists community_debate_votes_own_update on public.community_debate_votes;
create policy community_debate_votes_own_update on public.community_debate_votes
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select on public.community_rooms to authenticated;
grant select on public.community_room_members to authenticated;
grant select on public.community_room_activities to authenticated;
grant select, insert, update on public.community_room_signoffs to authenticated;
grant select, insert, update on public.community_debate_votes to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'community_rooms',
    'community_room_members',
    'community_room_activities',
    'community_room_signoffs',
    'community_debates',
    'community_debate_votes'
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

update public.flashcards as card
set lesson_id = lesson.id
from public.lessons as lesson
where lesson.course_id = '22f0e217-92a7-46f0-b38e-651409d7d118'
  and card.deck_name ~ '^Week ([0-9]+) - .+ \(Community\)$'
  and card.deck_name not like 'Old -%'
  and lesson.lesson_number = (substring(card.deck_name from '^Week ([0-9]+)'))::int
  and card.lesson_id is distinct from lesson.id;

insert into public.community_debates (prompt, option_a, option_b, prompt_pa, romanised)
values
  ($d$Chai or coffee?$d$, $d$Chai$d$, $d$Coffee$d$, $d$ਚਾਹ ਜਾਂ ਕੌਫੀ?$d$, $d$Chaah jaan coffee?$d$),
  ($d$Samosa or pakora?$d$, $d$Samosa$d$, $d$Pakora$d$, $d$ਸਮੋਸਾ ਜਾਂ ਪਕੌੜਾ?$d$, $d$Samosa jaan pakora?$d$),
  ($d$Mango lassi or sweet lassi?$d$, $d$Mango lassi$d$, $d$Sweet lassi$d$, null, null),
  ($d$Paratha with butter or paratha with pickle?$d$, $d$Butter$d$, $d$Pickle$d$, null, null),
  ($d$Rajma chawal or chole chawal?$d$, $d$Rajma chawal$d$, $d$Chole chawal$d$, null, null),
  ($d$Jalebi or gulab jamun?$d$, $d$Jalebi$d$, $d$Gulab jamun$d$, null, null),
  ($d$Saag with makki di roti or saag with a plain roti?$d$, $d$Makki di roti$d$, $d$Plain roti$d$, null, null),
  ($d$Spicy or mild?$d$, $d$Spicy$d$, $d$Mild$d$, $d$ਤਿੱਖਾ ਜਾਂ ਹਲਕਾ?$d$, $d$Tikkha jaan halka?$d$),
  ($d$Kheer or gajar ka halwa?$d$, $d$Kheer$d$, $d$Gajar ka halwa$d$, null, null),
  ($d$Breakfast paratha or cereal?$d$, $d$Paratha$d$, $d$Cereal$d$, null, null),
  ($d$Pani puri or chaat?$d$, $d$Pani puri$d$, $d$Chaat$d$, null, null),
  ($d$Homemade dinner or a Friday takeaway?$d$, $d$Homemade$d$, $d$Takeaway$d$, null, null),
  ($d$Rasmalai or barfi?$d$, $d$Rasmalai$d$, $d$Barfi$d$, null, null),
  ($d$Hot chai in summer: yes or no?$d$, $d$Yes$d$, $d$No$d$, null, null),
  ($d$Ketchup with samosas: yes or no?$d$, $d$Yes$d$, $d$No$d$, null, null),
  ($d$Daal makhani or tarka daal?$d$, $d$Daal makhani$d$, $d$Tarka daal$d$, null, null),
  ($d$Ice cream or kulfi?$d$, $d$Ice cream$d$, $d$Kulfi$d$, null, null),
  ($d$Pizza night or curry night?$d$, $d$Pizza$d$, $d$Curry$d$, null, null),
  ($d$Roti or rice?$d$, $d$Roti$d$, $d$Rice$d$, $d$ਰੋਟੀ ਜਾਂ ਚੌਲ?$d$, $d$Roti jaan chaul?$d$),
  ($d$Sweet or savoury?$d$, $d$Sweet$d$, $d$Savoury$d$, $d$ਮੀਠਾ ਜਾਂ ਨਮਕੀਨ?$d$, $d$Meetha jaan namkeen?$d$),
  ($d$Early bird or night owl?$d$, $d$Early bird$d$, $d$Night owl$d$, null, null),
  ($d$WhatsApp voice notes or texts?$d$, $d$Voice notes$d$, $d$Texts$d$, null, null),
  ($d$Phone calls: love them or avoid them?$d$, $d$Love them$d$, $d$Avoid them$d$, null, null),
  ($d$Shower in the morning or at night?$d$, $d$Morning$d$, $d$Night$d$, null, null),
  ($d$Tidy as you go or one big clean?$d$, $d$As you go$d$, $d$One big clean$d$, null, null),
  ($d$Plan the day or go with the flow?$d$, $d$Plan$d$, $d$Go with the flow$d$, null, null),
  ($d$One alarm or five snoozes?$d$, $d$One alarm$d$, $d$Five snoozes$d$, null, null),
  ($d$Socks with sliders: yes or no?$d$, $d$Yes$d$, $d$No$d$, null, null),
  ($d$Cinema or a film at home?$d$, $d$Cinema$d$, $d$At home$d$, null, null),
  ($d$Paper book or e-book?$d$, $d$Paper book$d$, $d$E-book$d$, null, null),
  ($d$Window seat or aisle seat?$d$, $d$Window$d$, $d$Aisle$d$, null, null),
  ($d$Walk or drive to the shops?$d$, $d$Walk$d$, $d$Drive$d$, null, null),
  ($d$Weekend lie-in or an early start?$d$, $d$Lie-in$d$, $d$Early start$d$, null, null),
  ($d$Read the last page first: yes or never?$d$, $d$Yes$d$, $d$Never$d$, null, null),
  ($d$Shopping online or in the shop?$d$, $d$Online$d$, $d$In the shop$d$, null, null),
  ($d$Kitchen or living room?$d$, $d$Kitchen$d$, $d$Living room$d$, null, null),
  ($d$Big get-togethers: love them or need a nap after?$d$, $d$Love them$d$, $d$Need a nap after$d$, null, null),
  ($d$Family WhatsApp: muted or always on?$d$, $d$Muted$d$, $d$Always on$d$, null, null),
  ($d$Visiting relatives: one chai or three?$d$, $d$One chai$d$, $d$Three chais$d$, null, null),
  ($d$Guests coming: tidy everything or leave the real house?$d$, $d$Tidy everything$d$, $d$Real house$d$, null, null),
  ($d$Leftovers: tomorrow's lunch or never again?$d$, $d$Tomorrow's lunch$d$, $d$Never again$d$, null, null),
  ($d$TV remote: share it or guard it?$d$, $d$Share$d$, $d$Guard$d$, null, null),
  ($d$Have you eaten: a question or a greeting?$d$, $d$A question$d$, $d$A greeting$d$, null, null),
  ($d$Gifts: useful or fun?$d$, $d$Useful$d$, $d$Fun$d$, null, null),
  ($d$Birthday: a big party or a quiet dinner?$d$, $d$Big party$d$, $d$Quiet dinner$d$, null, null),
  ($d$Cat or dog?$d$, $d$Cat$d$, $d$Dog$d$, $d$ਬਿੱਲੀ ਜਾਂ ਕੁੱਤਾ?$d$, $d$Billi jaan kutta?$d$),
  ($d$Garden: flowers or vegetables?$d$, $d$Flowers$d$, $d$Vegetables$d$, null, null),
  ($d$Photos: posed or natural?$d$, $d$Posed$d$, $d$Natural$d$, null, null),
  ($d$Sunday: family day or me-time?$d$, $d$Family day$d$, $d$Me-time$d$, null, null),
  ($d$Goodbye: a quick wave or a long goodbye at the door?$d$, $d$Quick wave$d$, $d$Long goodbye$d$, null, null),
  ($d$Wedding: the food or the dancing?$d$, $d$The food$d$, $d$The dancing$d$, null, null),
  ($d$Bhangra or giddha?$d$, $d$Bhangra$d$, $d$Giddha$d$, null, null),
  ($d$Mehndi night or the reception?$d$, $d$Mehndi night$d$, $d$The reception$d$, null, null),
  ($d$Dhol or a DJ?$d$, $d$Dhol$d$, $d$A DJ$d$, null, null),
  ($d$Outfit: comfortable or stunning?$d$, $d$Comfortable$d$, $d$Stunning$d$, null, null),
  ($d$Dance floor: first on or last off?$d$, $d$First on$d$, $d$Last off$d$, null, null),
  ($d$Ladoo or barfi?$d$, $d$Ladoo$d$, $d$Barfi$d$, null, null),
  ($d$Wedding: big or small?$d$, $d$Big$d$, $d$Small$d$, null, null),
  ($d$Thank-you note or a hug?$d$, $d$Thank-you note$d$, $d$A hug$d$, null, null),
  ($d$Birthday cake or mithai?$d$, $d$Cake$d$, $d$Mithai$d$, null, null),
  ($d$Fireworks or a bonfire?$d$, $d$Fireworks$d$, $d$A bonfire$d$, null, null),
  ($d$Mela: the rides or the food stalls?$d$, $d$The rides$d$, $d$The food stalls$d$, null, null),
  ($d$Beach holiday or city break?$d$, $d$Beach$d$, $d$City$d$, null, null),
  ($d$Visiting Punjab in winter or summer?$d$, $d$Winter$d$, $d$Summer$d$, null, null),
  ($d$Pack light or pack everything?$d$, $d$Pack light$d$, $d$Pack everything$d$, null, null),
  ($d$Road trip or a flight?$d$, $d$Road trip$d$, $d$A flight$d$, null, null),
  ($d$Mountains or the seaside?$d$, $d$Mountains$d$, $d$The seaside$d$, null, null),
  ($d$A hotel or staying with family?$d$, $d$A hotel$d$, $d$With family$d$, null, null),
  ($d$Travel photos: hundreds or hardly any?$d$, $d$Hundreds$d$, $d$Hardly any$d$, null, null),
  ($d$Abroad: local food or what you know?$d$, $d$Local food$d$, $d$What I know$d$, null, null),
  ($d$Plan every day or explore?$d$, $d$Plan every day$d$, $d$Explore$d$, null, null),
  ($d$A long flight: sleep or films?$d$, $d$Sleep$d$, $d$Films$d$, null, null),
  ($d$Souvenirs: fridge magnets or snacks?$d$, $d$Fridge magnets$d$, $d$Snacks$d$, null, null),
  ($d$Train or coach?$d$, $d$Train$d$, $d$Coach$d$, null, null),
  ($d$Old Punjabi songs or new ones?$d$, $d$Old songs$d$, $d$New songs$d$, null, null),
  ($d$Sing out loud or in your head?$d$, $d$Out loud$d$, $d$In my head$d$, null, null),
  ($d$Bollywood or Hollywood?$d$, $d$Bollywood$d$, $d$Hollywood$d$, null, null),
  ($d$Comedy or action?$d$, $d$Comedy$d$, $d$Action$d$, null, null),
  ($d$Music while you study: yes or no?$d$, $d$Yes$d$, $d$No$d$, null, null),
  ($d$Read the book first or watch the film first?$d$, $d$Book first$d$, $d$Film first$d$, null, null),
  ($d$Board games or video games?$d$, $d$Board games$d$, $d$Video games$d$, null, null),
  ($d$Football or cricket?$d$, $d$Football$d$, $d$Cricket$d$, null, null),
  ($d$Kabaddi or cricket?$d$, $d$Kabaddi$d$, $d$Cricket$d$, null, null),
  ($d$Concert: the front or further back?$d$, $d$The front$d$, $d$Further back$d$, null, null),
  ($d$Binge a series or one episode a week?$d$, $d$Binge$d$, $d$One a week$d$, null, null),
  ($d$Karaoke: grab the mic or hide?$d$, $d$Grab the mic$d$, $d$Hide$d$, null, null),
  ($d$A long drive: podcast or music?$d$, $d$Podcast$d$, $d$Music$d$, null, null),
  ($d$Dance or sit this one out?$d$, $d$Dance$d$, $d$Sit this one out$d$, null, null),
  ($d$Flying or invisibility?$d$, $d$Flying$d$, $d$Invisibility$d$, null, null),
  ($d$Talk to animals or speak every language?$d$, $d$Talk to animals$d$, $d$Every language$d$, null, null),
  ($d$Too hot or too cold?$d$, $d$Too hot$d$, $d$Too cold$d$, null, null),
  ($d$A week without chai or a week without music?$d$, $d$No chai$d$, $d$No music$d$, null, null),
  ($d$Time travel: the past or the future?$d$, $d$The past$d$, $d$The future$d$, null, null),
  ($d$A personal chef or a driver?$d$, $d$A chef$d$, $d$A driver$d$, null, null),
  ($d$A month of parathas or a month of pizza?$d$, $d$Parathas$d$, $d$Pizza$d$, null, null),
  ($d$A big city or a village?$d$, $d$A big city$d$, $d$A village$d$, null, null),
  ($d$A library that never closes or a kitchen that never runs out of snacks?$d$, $d$The library$d$, $d$The snack kitchen$d$, null, null),
  ($d$Never queue or never sit in traffic?$d$, $d$Never queue$d$, $d$Never traffic$d$, null, null),
  ($d$A parrot that talks or a dog that sings?$d$, $d$A talking parrot$d$, $d$A singing dog$d$, null, null),
  ($d$Wake up in Punjab or in a city you have never been to?$d$, $d$Punjab$d$, $d$A new city$d$, null, null);

notify pgrst, 'reload schema';
