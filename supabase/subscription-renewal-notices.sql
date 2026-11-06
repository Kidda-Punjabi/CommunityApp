-- 7-day subscription renewal notices: new notification type, plus a ledger so
-- each billing period is only ever notified once.

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
    'community_session_live',
    'subscription_renewal'
  ]::text[]));

create table if not exists public.subscription_renewal_notices (
  stripe_subscription_id text not null,
  period_end timestamptz not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (stripe_subscription_id, period_end)
);

create index if not exists idx_subscription_renewal_notices_user
  on public.subscription_renewal_notices (user_id);

-- Server only: RLS on with no policies, so only the service role can read or write.
alter table public.subscription_renewal_notices enable row level security;

notify pgrst, 'reload schema';
