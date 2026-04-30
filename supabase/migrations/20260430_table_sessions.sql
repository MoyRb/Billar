create table if not exists public.table_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  pool_table_id uuid not null references public.pool_tables(id) on delete cascade,
  opened_by uuid references auth.users(id),
  closed_by uuid references auth.users(id),
  status text not null default 'active' check (status in ('active', 'paused', 'pending_payment', 'paid', 'cancelled')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  paused_at timestamptz,
  total_paused_seconds integer not null default 0,
  charged_minutes integer,
  hourly_rate numeric(12,2) not null default 0,
  table_total numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.table_sessions enable row level security;

create policy "table_sessions org scoped" on public.table_sessions
for all
using (public.user_in_org(organization_id))
with check (public.user_in_org(organization_id));

create unique index if not exists table_sessions_one_open_per_table
on public.table_sessions(pool_table_id)
where status in ('active', 'paused', 'pending_payment');

create index if not exists table_sessions_org_idx on public.table_sessions(organization_id);
create index if not exists table_sessions_pool_table_idx on public.table_sessions(pool_table_id);

alter table public.pool_tables
  drop constraint if exists pool_tables_status_check;

alter table public.pool_tables
  add constraint pool_tables_status_check
  check (status in ('available', 'occupied', 'paused', 'pending_payment', 'maintenance', 'reserved'));
