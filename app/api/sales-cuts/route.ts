import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

  const links = (payload.orders as { id: string }[]).map((order) => ({ organization_id: member.organization_id, sales_cut_id: created.id, order_id: order.id }));
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
