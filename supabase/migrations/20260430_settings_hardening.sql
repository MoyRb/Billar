alter table if exists public.settings
  add column if not exists business_name text,
  add column if not exists logo_url text,
  add column if not exists default_hourly_rate numeric(10,2) not null default 0,
  add column if not exists currency text not null default 'MXN',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.settings
set business_name = coalesce(nullif(trim(business_name), ''), 'Mi negocio'),
    updated_at = now()
where business_name is null or trim(business_name) = '';

alter table public.settings
  alter column business_name set not null;
