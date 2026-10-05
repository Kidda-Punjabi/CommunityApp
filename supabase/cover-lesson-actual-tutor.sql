-- Who actually taught a logged lesson when it was a cover.
-- Notion pay reads "Cover Session?" plus "Actual Tutor (New)".
alter table public.cohort_lesson_log_entries
  add column if not exists actual_tutor_id uuid references public.profiles (id),
  add column if not exists actual_tutor_notion_user_id text;

notify pgrst, 'reload schema';
