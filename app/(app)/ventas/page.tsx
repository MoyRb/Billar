import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import VentasClient from '@/components/ventas-client';
import { createClient } from '@/lib/supabase/server';

type OrderRow = {
  id: string;
  status: 'open' | 'pending_payment' | 'paid' | 'cancelled';
  table_total: number;
  products_total: number;
  discount_total: number;
  total: number;
  payment_method: string | null;
  created_at: string;
  pool_tables: { name: string } | { name: string }[] | null;
};


type CutOrderRow = {
  sales_cut_id: string;
  order_id: string;
  orders: {
    id: string;
    total: number;
    pool_tables: { name: string } | { name: string }[] | null;
  } | {
    id: string;
    total: number;
    pool_tables: { name: string } | { name: string }[] | null;
  }[] | null;
};

type CutRow = {
  id: string;
  cut_type: 'shift' | 'day';
  status: 'closed' | 'cancelled';
  started_at: string;
  ended_at: string;
  total_orders: number;
  gross_total: number;
  table_total: number;
  products_total: number;
  discount_total: number;
  cash_total: number;
  card_total: number;
  transfer_total: number;
  other_total: number;
  users: { email: string | null } | { email: string | null }[] | null;
};

export default async function Page() {
  const s = await createClient();
  const { data: { user } } = await s.auth.getUser();
  if (!user) redirect('/login');

  const { data: m } = await s.from('organization_members').select('organization_id').eq('user_id', user.id).maybeSingle();
  if (!m) return null;

  const { data: org } = await s.from('organizations').select('name').eq('id', m.organization_id).maybeSingle();
  const { data: orderData } = await s.from('orders').select('id,status,table_total,products_total,discount_total,total,payment_method,created_at,pool_tables(name)').eq('organization_id', m.organization_id).order('created_at', { ascending: false });
  const { data: cutData } = await s.from('sales_cuts').select('id,cut_type,status,started_at,ended_at,total_orders,gross_total,table_total,products_total,discount_total,cash_total,card_total,transfer_total,other_total,users:created_by(email)').eq('organization_id', m.organization_id).order('created_at', { ascending: false });
  const { data: cutOrders } = await s.from('sales_cut_orders').select('sales_cut_id,order_id,orders(id,total,pool_tables(name))').eq('organization_id', m.organization_id);

  const orders = ((orderData ?? []) as OrderRow[]).map((o) => ({
    id: o.id,
    status: o.status,
    tableTotal: Number(o.table_total ?? 0),
    productsTotal: Number(o.products_total ?? 0),
    discountTotal: Number(o.discount_total ?? 0),
    total: Number(o.total ?? 0),
    paymentMethod: o.payment_method,
    createdAt: o.created_at,
    tableName: (Array.isArray(o.pool_tables) ? o.pool_tables[0]?.name : o.pool_tables?.name) ?? 'Sin mesa',
  }));

  const grouped = new Map<string, { id: string; tableName: string; total: number }[]>();
  for (const rel of ((cutOrders ?? []) as unknown as CutOrderRow[])) {
    const order = Array.isArray(rel.orders) ? rel.orders[0] : rel.orders;
    const list = grouped.get(rel.sales_cut_id) ?? [];
    list.push({ id: order?.id ?? rel.order_id, tableName: (Array.isArray(order?.pool_tables) ? order.pool_tables[0]?.name : order?.pool_tables?.name) ?? 'Sin mesa', total: Number(order?.total ?? 0) });
    grouped.set(rel.sales_cut_id, list);
  }

  const cuts = ((cutData ?? []) as CutRow[]).map((c) => ({
    id: c.id,
    cutType: c.cut_type,
    status: c.status,
    startedAt: c.started_at,
    endedAt: c.ended_at,
    totalOrders: Number(c.total_orders ?? 0),
    grossTotal: Number(c.gross_total ?? 0),
    tableTotal: Number(c.table_total ?? 0),
    productsTotal: Number(c.products_total ?? 0),
    discountTotal: Number(c.discount_total ?? 0),
    cashTotal: Number(c.cash_total ?? 0),
    cardTotal: Number(c.card_total ?? 0),
    transferTotal: Number(c.transfer_total ?? 0),
    otherTotal: Number(c.other_total ?? 0),
    cashierEmail: (Array.isArray(c.users) ? c.users[0]?.email : c.users?.email) ?? '—',
    orders: grouped.get(c.id) ?? [],
  }));

  return <div className='space-y-4'><PageHeader title='Ventas' description='Historial, pendientes y cortes de ventas.' /><VentasClient initialOrders={orders} initialCuts={cuts} businessName={org?.name} userEmail={user.email ?? '—'} /></div>;
}
