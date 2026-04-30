import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type SalesCutOrderRow = {
  sales_cut_id: string;
  order_id: string;
  cut_type: 'shift' | 'day' | null;
  orders: { id: string; total: number; pool_tables: { name: string } | { name: string }[] | null } | { id: string; total: number; pool_tables: { name: string } | { name: string }[] | null }[] | null;
};


type PaidOrderRow = {
  id: string;
  status: 'paid';
  table_total: number;
  products_total: number;
  discount_total: number;
  total: number;
  payment_method: string | null;
  created_at: string;
  closed_at: string | null;
  paid_at: string | null;
  pool_tables: { name: string } | { name: string }[] | null;
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

const toDate = (value: string | null | undefined) => new Date(value ?? new Date(0).toISOString());

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: member } = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).maybeSingle();
  if (!member) return NextResponse.json({ error: 'No organization' }, { status: 400 });

  const organizationId = member.organization_id;
  const { data: cutData, error: cutError } = await supabase.from('sales_cuts').select('id,cut_type,status,started_at,ended_at,total_orders,gross_total,table_total,products_total,discount_total,cash_total,card_total,transfer_total,other_total,users:created_by(email)').eq('organization_id', organizationId).eq('status', 'closed').order('ended_at', { ascending: false });
  if (cutError) return NextResponse.json({ error: cutError.message, details: cutError.details, hint: cutError.hint, code: cutError.code }, { status: 400 });

  const { data: cutOrders, error: cutOrdersError } = await supabase.from('sales_cut_orders').select('sales_cut_id,order_id,cut_type,orders(id,total,pool_tables(name))').eq('organization_id', organizationId);
  if (cutOrdersError) return NextResponse.json({ error: cutOrdersError.message, details: cutOrdersError.details, hint: cutOrdersError.hint, code: cutOrdersError.code }, { status: 400 });

  const { data: paidOrders, error: paidOrdersError } = await supabase.from('orders').select('id,status,table_total,products_total,discount_total,total,payment_method,created_at,closed_at,paid_at,pool_tables(name)').eq('organization_id', organizationId).eq('status', 'paid').eq('order_type', 'table').order('created_at', { ascending: false });
  if (paidOrdersError) return NextResponse.json({ error: paidOrdersError.message, details: paidOrdersError.details, hint: paidOrdersError.hint, code: paidOrdersError.code }, { status: 400 });

  const grouped = new Map<string, { id: string; tableName: string; total: number }[]>();
  for (const rel of (cutOrders ?? []) as unknown as SalesCutOrderRow[]) {
    const order = Array.isArray(rel.orders) ? rel.orders[0] : rel.orders;
    const list = grouped.get(rel.sales_cut_id) ?? [];
    list.push({ id: order?.id ?? rel.order_id, tableName: (Array.isArray(order?.pool_tables) ? order.pool_tables[0]?.name : order?.pool_tables?.name) ?? 'Sin mesa', total: Number(order?.total ?? 0) });
    grouped.set(rel.sales_cut_id, list);
  }

  const shiftCutOrderIds = new Set(
    (cutOrders ?? []).filter((row) => row.cut_type === 'shift').map((row) => row.order_id),
  );

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

  const pendingShiftOrders = ((paidOrders ?? []) as PaidOrderRow[]).filter((order) => !shiftCutOrderIds.has(order.id)).map((o) => ({
    id: o.id,
    status: o.status,
    tableTotal: Number(o.table_total ?? 0),
    productsTotal: Number(o.products_total ?? 0),
    discountTotal: Number(o.discount_total ?? 0),
    total: Number(o.total ?? 0),
    paymentMethod: o.payment_method,
    createdAt: o.created_at,
    closedAt: o.closed_at,
    paidAt: o.paid_at,
    tableName: (Array.isArray(o.pool_tables) ? o.pool_tables[0]?.name : o.pool_tables?.name) ?? 'Sin mesa',
  })).sort((a, b) => toDate(b.paidAt ?? b.closedAt ?? b.createdAt).getTime() - toDate(a.paidAt ?? a.closedAt ?? a.createdAt).getTime());

  console.debug('[ventas/debug] snapshot', { organizationId, cutsLoaded: cuts.length, paidOrdersFound: paidOrders?.length ?? 0, pendingShiftOrdersFound: pendingShiftOrders.length });
  return NextResponse.json({ cuts, pendingShiftOrders });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await request.json();
  const { data: member } = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).maybeSingle();
  if (!member) return NextResponse.json({ error: 'No organization' }, { status: 400 });

  const cutInsert = {
    organization_id: member.organization_id,
    cut_type: payload.cutType,
    status: 'closed',
    started_at: payload.startedAt,
    ended_at: payload.endedAt,
    total_orders: payload.totalOrders,
    gross_total: payload.grossTotal,
    table_total: payload.tableTotal,
    products_total: payload.productsTotal,
    discount_total: payload.discountTotal,
    cash_total: payload.cashTotal,
    card_total: payload.cardTotal,
    transfer_total: payload.transferTotal,
    other_total: payload.otherTotal,
    created_by: user.id,
  };

  const { data: created, error } = await supabase.from('sales_cuts').insert(cutInsert).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const links = (payload.orders as { id: string }[]).map((order) => ({ organization_id: member.organization_id, sales_cut_id: created.id, order_id: order.id, cut_type: payload.cutType }));
  if (links.length > 0) {
    const { error: linksError } = await supabase.from('sales_cut_orders').insert(links);
    if (linksError) {
      await supabase.from('sales_cuts').delete().eq('id', created.id).eq('organization_id', member.organization_id);
      return NextResponse.json({ error: linksError.message }, { status: 400 });
    }
  }

  return NextResponse.json({
    id: created.id,
    cutType: created.cut_type,
    status: created.status,
    startedAt: created.started_at,
    endedAt: created.ended_at,
    totalOrders: created.total_orders,
    grossTotal: Number(created.gross_total),
    tableTotal: Number(created.table_total),
    productsTotal: Number(created.products_total),
    discountTotal: Number(created.discount_total),
    cashTotal: Number(created.cash_total),
    cardTotal: Number(created.card_total),
    transferTotal: Number(created.transfer_total),
    otherTotal: Number(created.other_total),
    cashierEmail: user.email ?? '—',
    orders: payload.orders,
  });
}
