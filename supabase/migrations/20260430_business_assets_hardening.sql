-- Ajustes seguros para reforzar el módulo de activos
alter table public.business_assets
  add column if not exists asset_type text,
  add column if not exists quantity numeric(12,2) not null default 1,
  add column if not exists location text,
  add column if not exists status text not null default 'active',
  add column if not exists purchase_cost numeric(12,2),
  add column if not exists purchase_date date,
  add column if not exists notes text,
  add column if not exists is_active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

alter table public.business_assets
  alter column asset_type set not null,
  alter column status set not null,
  alter column quantity set default 1;

alter table public.business_assets
  drop constraint if exists business_assets_status_check;

alter table public.business_assets
  add constraint business_assets_status_check
  check (status in ('active','maintenance','damaged','lost','retired'));
