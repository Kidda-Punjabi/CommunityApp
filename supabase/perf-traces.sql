create table if not exists public.perf_traces (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  route text not null,
  method text not null default 'GET',
  persona text,
  prefetch boolean not null default false,
  total_ms integer not null,
  middleware_ms integer not null default 0,
  query_count integer not null,
  sequential_depth integer not null,
  sequential_ms integer not null default 0,
  parallel_count integer not null default 0,
  response_bytes integer,
  client_js_bytes integer,
  slowest jsonb not null default '[]'::jsonb,
  spans jsonb not null default '[]'::jsonb
);

create index if not exists perf_traces_created_at_idx on public.perf_traces (created_at desc);
create index if not exists perf_traces_route_created_idx on public.perf_traces (route, created_at desc);

alter table public.perf_traces enable row level security;

revoke all on public.perf_traces from anon, authenticated;
grant select, insert, delete on public.perf_traces to service_role;

comment on table public.perf_traces is 'Per-request server timings. Rows older than 7 days are deleted while tracing is on.';

notify pgrst, 'reload schema';
