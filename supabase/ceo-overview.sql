-- CEO overview: config, targets, and one snapshot per day.
-- The admin home reads these tables only. It does not call Notion, Stripe, or Meta.

create table if not exists public.ceo_config (
  id text primary key default 'default',
  vat_registered_from date not null default '2026-09-01',
  prices_include_vat boolean not null default true,
  default_tutor_hourly_rate numeric not null default 25,
  gross_margin_for_ltgp numeric
);

insert into public.ceo_config (id)
values ('default')
on conflict (id) do nothing;

create table if not exists public.ceo_metric_targets (
  metric_id text primary key,
  label text not null,
  area text not null check (area in ('acquisition', 'operations', 'delivery')),
  format text not null,
  direction text not null check (direction in ('min', 'max')),
  target numeric,
  sort_order integer not null
);

insert into public.ceo_metric_targets (metric_id, label, area, format, direction, target, sort_order)
values
  ('cash_collected', 'Cash collected', 'acquisition', 'currency', 'min', 20000, 1),
  ('deals_closed', 'Deals closed', 'acquisition', 'number', 'min', 67, 2),
  ('avg_order_value', 'Average order value', 'acquisition', 'currency', 'min', 300, 3),
  ('leads', 'Leads', 'acquisition', 'number', 'min', 1060, 4),
  ('booking_rate', 'Booking rate', 'acquisition', 'percent', 'min', 0.35, 5),
  ('show_rate', 'Show rate', 'acquisition', 'percent', 'min', 0.60, 6),
  ('close_rate', 'Close rate', 'acquisition', 'percent', 'min', 0.30, 7),
  ('ltgp_cac', 'LTGP:CAC', 'acquisition', 'ratio', 'min', 3, 8),
  ('gross_margin', 'Gross margin', 'operations', 'percent', 'min', 0.75, 1),
  ('net_margin', 'Net margin', 'operations', 'percent', 'min', 0.20, 2),
  ('overheads_pct', 'Overheads', 'operations', 'percent', 'max', 0.55, 3),
  ('net_profit', 'Net profit', 'operations', 'currency', 'min', null, 4),
  ('cohort_fill_rate', 'Cohort fill rate', 'operations', 'percent', 'min', 0.95, 5),
  ('delivery_pot_cover', 'Delivery pot cover', 'operations', 'ratio', 'min', 1, 6),
  ('cash_in_bank', 'Cash in bank', 'operations', 'currency', 'min', null, 7),
  ('working_capital_months', 'Working capital', 'operations', 'months', 'min', 3, 8),
  ('attendance', 'Attendance', 'delivery', 'percent', 'min', 0.75, 1),
  ('homework_completion', 'Homework completion', 'delivery', 'percent', 'min', 0.50, 2),
  ('quiz_score', 'Quiz score', 'delivery', 'percent', 'min', 0.90, 3),
  ('tutor_effectiveness', 'Tutor effectiveness', 'delivery', 'score', 'min', 4.8, 4),
  ('learning_relevance', 'Learning relevance', 'delivery', 'score', 'min', 4.8, 5),
  ('confidence', 'Confidence', 'delivery', 'score', 'min', 4.2, 6),
  ('course_completion', 'Course completion', 'delivery', 'percent', 'min', 0.75, 7),
  ('continuation_rate', 'Continuation rate', 'delivery', 'percent', 'min', 0.30, 8)
on conflict (metric_id) do nothing;

create table if not exists public.ceo_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null unique,
  period_start date not null,
  period_end date not null,
  metrics jsonb not null,
  actions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ceo_config enable row level security;
alter table public.ceo_metric_targets enable row level security;
alter table public.ceo_metric_snapshots enable row level security;

drop policy if exists ceo_config_admin_read on public.ceo_config;
create policy ceo_config_admin_read on public.ceo_config
  for select to authenticated
  using (is_master_admin());

drop policy if exists ceo_metric_targets_admin_read on public.ceo_metric_targets;
create policy ceo_metric_targets_admin_read on public.ceo_metric_targets
  for select to authenticated
  using (is_master_admin());

drop policy if exists ceo_metric_targets_admin_update on public.ceo_metric_targets;
create policy ceo_metric_targets_admin_update on public.ceo_metric_targets
  for update to authenticated
  using (is_master_admin())
  with check (is_master_admin());

drop policy if exists ceo_metric_snapshots_admin_read on public.ceo_metric_snapshots;
create policy ceo_metric_snapshots_admin_read on public.ceo_metric_snapshots
  for select to authenticated
  using (is_master_admin());
