-- Homework recorder failures: one row per failed mic/recording attempt, so we
-- see broken recorders in the app instead of hearing about them on WhatsApp.
create table if not exists public.homework_recorder_failures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kid_profile_id uuid null,
  lesson_id uuid null,
  error_type text not null,
  error_name text null,
  error_message text null,
  user_agent text null,
  page_url text null,
  created_at timestamptz not null default now()
);

alter table public.homework_recorder_failures enable row level security;

drop policy if exists "insert own recorder failures" on public.homework_recorder_failures;
create policy "insert own recorder failures" on public.homework_recorder_failures
  for insert to authenticated with check (user_id = auth.uid());

create index if not exists homework_recorder_failures_user_created_idx
  on public.homework_recorder_failures (user_id, created_at desc);

notify pgrst, 'reload schema';
