create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  unique(organization_id, user_id)
);

create table if not exists public.pool_tables (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, status text not null default 'available', table_type text not null default 'pool', hourly_rate numeric(10,2) not null default 0,
  is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, name text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  category_id uuid references public.product_categories(id) on delete set null, name text not null, sku text, sale_price numeric(10,2) not null default 0,
  cost_price numeric(10,2) not null default 0, stock integer not null default 0, min_stock integer not null default 0,
  is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.cash_registers (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  opened_by uuid references auth.users(id), opening_amount numeric(10,2) not null default 0, closing_amount numeric(10,2),
  status text not null default 'open', opened_at timestamptz not null default now(), closed_at timestamptz
);
create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null unique references public.organizations(id) on delete cascade,
  business_name text not null, logo_url text, default_hourly_rate numeric(10,2) not null default 0, currency text not null default 'MXN',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create or replace function public.user_in_org(org_id uuid)
returns boolean language sql stable as $$
  select exists(select 1 from public.organization_members om where om.organization_id = org_id and om.user_id = auth.uid())
$$;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.pool_tables enable row level security;
alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.cash_registers enable row level security;
alter table public.settings enable row level security;

create policy "org members read organizations" on public.organizations for select using (public.user_in_org(id));
create policy "own profile" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "read own memberships" on public.organization_members for select using (user_id = auth.uid());
create policy "manage own memberships" on public.organization_members for insert with check (user_id = auth.uid());

create policy "pool_tables org scoped" on public.pool_tables for all using (public.user_in_org(organization_id)) with check (public.user_in_org(organization_id));
create policy "product_categories org scoped" on public.product_categories for all using (public.user_in_org(organization_id)) with check (public.user_in_org(organization_id));
create policy "products org scoped" on public.products for all using (public.user_in_org(organization_id)) with check (public.user_in_org(organization_id));
create policy "cash_registers org scoped" on public.cash_registers for all using (public.user_in_org(organization_id)) with check (public.user_in_org(organization_id));
create policy "settings org scoped" on public.settings for all using (public.user_in_org(organization_id)) with check (public.user_in_org(organization_id));

create or replace function public.bootstrap_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  org_id uuid;
  org_name text;
  org_slug text;
begin
  org_name := coalesce(new.raw_user_meta_data ->> 'organization_name', 'Mi Billar');
  org_slug := lower(regexp_replace(org_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(new.id::text,1,8);

  insert into public.organizations(name, slug) values (org_name, org_slug) returning id into org_id;
  insert into public.profiles(id, full_name, email) values (new.id, new.raw_user_meta_data ->> 'full_name', new.email);
  insert into public.organization_members(organization_id, user_id, role) values (org_id, new.id, 'owner');
  insert into public.settings(organization_id, business_name) values (org_id, org_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.bootstrap_new_user();
