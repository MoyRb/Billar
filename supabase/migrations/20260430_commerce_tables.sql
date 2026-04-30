create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.product_categories
  add column if not exists description text,
  add column if not exists is_active boolean not null default true;

alter table public.products
  add column if not exists description text,
  add column if not exists barcode text,
  add column if not exists unit text not null default 'pieza',
  add column if not exists image_url text;

alter table public.products
  alter column sale_price type numeric(12,2),
  alter column cost_price type numeric(12,2),
  alter column stock type numeric(12,2) using stock::numeric,
  alter column min_stock type numeric(12,2) using min_stock::numeric;

create unique index if not exists products_org_barcode_unique on public.products(organization_id, barcode) where barcode is not null and barcode <> '';
create unique index if not exists products_org_sku_unique on public.products(organization_id, sku) where sku is not null and sku <> '';

create table if not exists public.business_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  asset_type text not null,
  quantity numeric(12,2) not null default 1,
  location text,
  status text not null default 'active' check (status in ('active','maintenance','damaged','lost','retired')),
  purchase_cost numeric(12,2),
  purchase_date date,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_type text not null default 'table' check (order_type in ('table','direct_sale')),
  status text not null default 'open' check (status in ('open','pending_payment','paid','cancelled')),
  pool_table_id uuid references public.pool_tables(id),
  table_session_id uuid references public.table_sessions(id),
  subtotal numeric(12,2) not null default 0,
  table_total numeric(12,2) not null default 0,
  products_total numeric(12,2) not null default 0,
  discount_total numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  payment_method text,
  created_by uuid references auth.users(id),
  closed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  updated_at timestamptz not null default now()
);
create unique index if not exists orders_open_session_unique on public.orders(table_session_id) where table_session_id is not null and status in ('open','pending_payment');

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  product_name text not null,
  quantity numeric(12,2) not null,
  unit_price numeric(12,2) not null,
  unit_cost numeric(12,2),
  line_total numeric(12,2) not null,
  status text not null default 'active' check (status in ('active','cancelled')),
  created_by uuid references auth.users(id),
  cancelled_by uuid references auth.users(id),
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id),
  movement_type text not null,
  quantity numeric(12,2) not null,
  previous_stock numeric(12,2) not null,
  new_stock numeric(12,2) not null,
  reason text,
  reference_type text,
  reference_id uuid,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.business_assets enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.inventory_movements enable row level security;

create policy if not exists "business_assets org scoped" on public.business_assets for all using (public.user_in_org(organization_id)) with check (public.user_in_org(organization_id));
create policy if not exists "orders org scoped" on public.orders for all using (public.user_in_org(organization_id)) with check (public.user_in_org(organization_id));
create policy if not exists "order_items org scoped" on public.order_items for all using (public.user_in_org(organization_id)) with check (public.user_in_org(organization_id));
create policy if not exists "inventory_movements org scoped" on public.inventory_movements for all using (public.user_in_org(organization_id)) with check (public.user_in_org(organization_id));

create or replace function public.add_product_to_table_session(p_org uuid, p_pool_table uuid, p_session uuid, p_product uuid, p_qty numeric, p_user uuid)
returns uuid language plpgsql security definer as $$
declare
  v_product public.products%rowtype;
  v_order_id uuid;
  v_item_id uuid;
  v_prev numeric(12,2);
begin
  if p_qty <= 0 then raise exception 'Cantidad inválida'; end if;
  select * into v_product from public.products where id = p_product and organization_id = p_org for update;
  if not found then raise exception 'Producto no encontrado'; end if;
  if not v_product.is_active then raise exception 'Producto inactivo'; end if;
  if v_product.stock < p_qty then raise exception 'Stock insuficiente'; end if;

  select id into v_order_id from public.orders where table_session_id = p_session and organization_id = p_org and status in ('open','pending_payment') limit 1;
  if v_order_id is null then
    insert into public.orders(organization_id, order_type, status, pool_table_id, table_session_id, created_by)
    values (p_org, 'table', 'open', p_pool_table, p_session, p_user) returning id into v_order_id;
  end if;

  v_prev := v_product.stock;
  update public.products set stock = stock - p_qty, updated_at = now() where id = v_product.id;

  insert into public.order_items(organization_id, order_id, product_id, product_name, quantity, unit_price, unit_cost, line_total, created_by)
  values (p_org, v_order_id, v_product.id, v_product.name, p_qty, v_product.sale_price, v_product.cost_price, p_qty * v_product.sale_price, p_user)
  returning id into v_item_id;

  insert into public.inventory_movements(organization_id, product_id, movement_type, quantity, previous_stock, new_stock, reason, reference_type, reference_id, created_by)
  values (p_org, v_product.id, 'table_consumption', p_qty, v_prev, v_prev - p_qty, 'Consumo en mesa', 'order_item', v_item_id, p_user);

  return v_item_id;
end; $$;
create or replace function public.cancel_order_item(p_org uuid, p_item uuid, p_reason text, p_user uuid)
returns void language plpgsql security definer as $$
declare v_item public.order_items%rowtype; v_prev numeric(12,2);
begin
  select * into v_item from public.order_items where id = p_item and organization_id = p_org for update;
  if not found then raise exception 'Consumo no encontrado'; end if;
  if v_item.status = 'cancelled' then raise exception 'Ya cancelado'; end if;
  select stock into v_prev from public.products where id = v_item.product_id for update;
  update public.order_items set status='cancelled', cancelled_by=p_user, cancelled_at=now(), cancel_reason=p_reason where id = p_item;
  update public.products set stock = stock + v_item.quantity, updated_at=now() where id = v_item.product_id;
  insert into public.inventory_movements(organization_id, product_id, movement_type, quantity, previous_stock, new_stock, reason, reference_type, reference_id, created_by)
  values (p_org, v_item.product_id, 'cancellation_return', v_item.quantity, v_prev, v_prev + v_item.quantity, coalesce(p_reason,'Cancelación de consumo'), 'order_item', p_item, p_user);
end; $$;
