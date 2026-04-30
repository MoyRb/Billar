alter table public.sales_cut_orders
add column if not exists cut_type text;

update public.sales_cut_orders sco
set cut_type = sc.cut_type
from public.sales_cuts sc
where sc.id = sco.sales_cut_id
  and sco.cut_type is null;

create unique index if not exists sales_cut_orders_unique_shift_order
on public.sales_cut_orders (organization_id, order_id)
where cut_type = 'shift';
