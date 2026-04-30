import { calculateOrderTotal, calculateProductsTotal } from './table-session-utils';
import type { TableSession } from './types';
import type { SupabaseClient } from '@supabase/supabase-js';

type CloseTableSessionParams = {
  supabase: SupabaseClient;
  organizationId: string;
  poolTableId: string;
  userId: string;
  session: TableSession;
  chargedMinutes: number;
  tableTotal: number;
};

type PayTableOrderParams = {
  supabase: SupabaseClient;
  organizationId: string;
  poolTableId: string;
  session: TableSession;
  paymentMethod?: string;
};

export async function closeTableSession(params: CloseTableSessionParams): Promise<void> {
  const { supabase, organizationId, poolTableId, userId, session, chargedMinutes, tableTotal } = params;
  const now = new Date().toISOString();

  const { data: activeSession, error: sessionLookupError } = await supabase
    .from('table_sessions')
    .select('id,status')
    .eq('id', session.id)
    .eq('organization_id', organizationId)
    .in('status', ['active', 'paused'])
    .maybeSingle();
  if (sessionLookupError) {
    console.error('[mesas/close] falla lookup table_session', sessionLookupError);
    throw sessionLookupError;
  }
  if (!activeSession) {
    throw new Error('La sesión de mesa no está activa para cierre.');
  }

  const { data: matchedOrder, error: orderLookupError } = await supabase
    .from('orders')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('table_session_id', session.id)
    .in('status', ['open', 'pending_payment'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (orderLookupError) {
    console.error('[mesas/close] falla lookup order', orderLookupError);
    throw orderLookupError;
  }

  const baseOrderPayload = {
    status: 'pending_payment',
    order_type: 'table',
    organization_id: organizationId,
    pool_table_id: poolTableId,
    table_session_id: session.id,
    closed_at: now,
    updated_at: now,
  };

  let orderId = matchedOrder?.id;
  if (!orderId) {
    const { data: createdOrder, error: orderInsertError } = await supabase
      .from('orders')
      .insert(baseOrderPayload)
      .select('id')
      .single();
    if (orderInsertError) {
      console.error('[mesas/close] falla insert orders', orderInsertError);
      throw orderInsertError;
    }
    orderId = createdOrder.id;
  }

  const { data: orderItems, error: itemsError } = await supabase
    .from('order_items')
    .select('id,line_total,quantity,status')
    .eq('organization_id', organizationId)
    .eq('order_id', orderId)
    .or('status.eq.active,status.is.null');

  if (itemsError) {
    console.error('[mesas/close] falla lookup order_items', {
      error: itemsError,
      message: itemsError?.message,
      details: itemsError?.details,
      hint: itemsError?.hint,
      code: itemsError?.code,
      orderId,
      sessionId: session.id,
      organizationId,
    });
    throw itemsError;
  }

  const productsTotal = calculateProductsTotal(
    (orderItems ?? []).map((item) => ({
      line_total: Number(item.line_total ?? 0),
      status: 'active' as const,
    })),
  );
  const discountTotal = 0;
  const total = calculateOrderTotal(tableTotal, productsTotal, discountTotal);

  const orderPayload = {
    ...baseOrderPayload,
    table_total: tableTotal,
    products_total: productsTotal,
    discount_total: discountTotal,
    total,
  };

  const { error: orderUpdateError } = await supabase.from('orders').update(orderPayload).eq('id', orderId).eq('organization_id', organizationId);
  if (orderUpdateError) {
    console.error('[mesas/close] falla update orders', orderUpdateError);
    throw orderUpdateError;
  }

  const { error: sessionUpdateError } = await supabase
    .from('table_sessions')
    .update({ status: 'pending_payment', ended_at: now, charged_minutes: chargedMinutes, table_total: tableTotal, closed_by: userId, updated_at: now })
    .eq('id', session.id)
    .eq('organization_id', organizationId);
  if (sessionUpdateError) {
    console.error('[mesas/close] falla update table_sessions', sessionUpdateError);
    throw sessionUpdateError;
  }

  const { error: tableUpdateError } = await supabase.from('pool_tables').update({ status: 'pending_payment', updated_at: now }).eq('id', poolTableId).eq('organization_id', organizationId);
  if (tableUpdateError) {
    console.error('[mesas/close] falla update pool_tables', tableUpdateError);
    throw tableUpdateError;
  }
}

export async function payTableOrder(params: PayTableOrderParams): Promise<void> {
  const { supabase, organizationId, poolTableId, session, paymentMethod = 'cash' } = params;
  const now = new Date().toISOString();

  const { data: existingOrder, error: orderLookupError } = await supabase
    .from('orders')
    .select('id,closed_at,table_total,products_total,discount_total,total,status')
    .eq('organization_id', organizationId)
    .eq('table_session_id', session.id)
    .eq('pool_table_id', poolTableId)
    .in('status', ['pending_payment', 'open'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (orderLookupError) {
    console.error('[mesas/pay] falla lookup order', orderLookupError);
    throw orderLookupError;
  }
  if (!existingOrder) {
    console.error('[mesas/pay] no encuentra order para cobro', { organizationId, poolTableId, sessionId: session.id });
    throw new Error('No se encontró una orden para esta mesa.');
  }

  const { error: orderUpdateError } = await supabase
    .from('orders')
    .update({
      status: 'paid',
      payment_method: paymentMethod,
      paid_at: now,
      closed_at: existingOrder.closed_at ?? now,
      updated_at: now,
    })
    .eq('id', existingOrder.id)
    .eq('organization_id', organizationId)
    .in('status', ['pending_payment', 'open']);
  if (orderUpdateError) {
    console.error('[mesas/pay] falla update orders', orderUpdateError);
    throw new Error('No se pudo registrar el cobro. La mesa NO fue liberada.');
  }

  const { error: sessionError } = await supabase.from('table_sessions').update({ status: 'paid', updated_at: now }).eq('id', session.id).eq('organization_id', organizationId);
  if (sessionError) {
    console.error('[mesas/pay] falla update table_sessions', sessionError);
    throw sessionError;
  }

  const { error: tableError } = await supabase.from('pool_tables').update({ status: 'available', updated_at: now }).eq('id', poolTableId).eq('organization_id', organizationId);
  if (tableError) {
    console.error('[mesas/pay] falla update pool_tables', tableError);
    throw tableError;
  }
}
