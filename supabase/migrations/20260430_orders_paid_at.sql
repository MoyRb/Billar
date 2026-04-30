alter table public.orders
  add column if not exists paid_at timestamptz null;

alter table public.orders
  add column if not exists payment_method text null;
