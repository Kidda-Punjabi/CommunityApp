-- Level-based Practise tab: per-learner progress, rounds, level checks, cached audio.
-- Content lives in src/lib/practise/master-lists.json, keyed by stable item ids.
create table if not exists public.practise_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  skill text not null check (skill in ('words','grammar','listening','speaking')),
  correct_count integer not null default 0,
  attempts integer not null default 0,
  last_correct boolean,
  last_seen_at timestamptz not null default now(),
  primary key (user_id, item_id, skill)
);
create table if not exists public.practise_rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  level integer not null,
  skill text not null,
  correct integer not null,
  total integer not null,
  local_date date not null,
  created_at timestamptz not null default now()
);
create index if not exists practise_rounds_user_date on public.practise_rounds (user_id, local_date desc);
create table if not exists public.practise_level_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  level integer not null,
  part text not null check (part in ('words','listening')),
  answer_key jsonb not null,
  score integer,
  total integer not null,
  passed boolean,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists practise_level_checks_user on public.practise_level_checks (user_id, level, part, created_at desc);
create table if not exists public.practise_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  seen_level integer,
  updated_at timestamptz not null default now()
);
create table if not exists public.practise_audio (
  audio_key text primary key,
  storage_path text not null,
  created_at timestamptz not null default now()
);
alter table public.practise_progress enable row level security;
alter table public.practise_rounds enable row level security;
alter table public.practise_level_checks enable row level security;
alter table public.practise_state enable row level security;
alter table public.practise_audio enable row level security;
create policy "own practise progress" on public.practise_progress for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own practise rounds" on public.practise_rounds for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own practise state" on public.practise_state for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Level checks and cached audio are written only by the server (service role): the answer key must stay hidden.
NOTIFY pgrst, 'reload schema';
alter table public.practise_rounds add column if not exists xp integer not null default 0;
