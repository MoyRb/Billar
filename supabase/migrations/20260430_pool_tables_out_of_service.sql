alter table public.pool_tables
  drop constraint if exists pool_tables_status_check;

alter table public.pool_tables
  add constraint pool_tables_status_check
  check (status in ('available', 'occupied', 'paused', 'pending_payment', 'maintenance', 'reserved', 'out_of_service'));
