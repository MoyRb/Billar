create table if not exists public.sales_cuts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cut_type text not null check (cut_type in ('shift','day')),
  status text not null default 'closed' check (status in ('closed','cancelled')),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  total_orders integer not null default 0,
  gross_total numeric(12,2) not null default 0,
  table_total numeric(12,2) not null default 0,
  products_total numeric(12,2) not null default 0,
  discount_total numeric(12,2) not null default 0,
  cash_total numeric(12,2) not null default 0,
  card_total numeric(12,2) not null default 0,
  transfer_total numeric(12,2) not null default 0,
  other_total numeric(12,2) not null default 0,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.sales_cut_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sales_cut_id uuid not null references public.sales_cuts(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (sales_cut_id, order_id)
);

create index if not exists sales_cut_orders_org_order_idx on public.sales_cut_orders(organization_id, order_id);

alter table public.sales_cuts enable row level security;
alter table public.sales_cut_orders enable row level security;

drop policy if exists "sales_cuts org scoped" on public.sales_cuts;
create policy "sales_cuts org scoped" on public.sales_cuts for all
  using (public.user_in_org(organization_id))
  with check (public.user_in_org(organization_id));

drop policy if exists "sales_cut_orders org scoped" on public.sales_cut_orders;
create policy "sales_cut_orders org scoped" on public.sales_cut_orders for all
  using (public.user_in_org(organization_id))
  with check (public.user_in_org(organization_id));
