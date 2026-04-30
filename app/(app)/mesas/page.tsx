import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MesasClient } from '@/components/mesas-client';
import type { TableSession, TableWithCurrentSession } from '@/lib/types';

export default async function Mesas() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return <div className="text-rack-cream">No encontramos una organización activa.</div>;
  }

  const organizationId = membership.organization_id;
  const { data: tables } = await supabase
    .from('pool_tables')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name');

  const tableIds = (tables ?? []).map((t) => t.id);
  const { data: sessions } = await supabase
    .from('table_sessions')
    .select('*')
    .in('pool_table_id', tableIds.length ? tableIds : ['00000000-0000-0000-0000-000000000000'])
    .in('status', ['active', 'paused', 'pending_payment']);

  const sessionRows = (sessions as TableSession[] | null ?? []);
  const sessionIds = sessionRows.map((session) => session.id);
  const { data: orders } = await supabase
    .from('orders')
    .select('id,status,table_total,products_total,discount_total,total,table_session_id,order_items(id,product_name,quantity,unit_price,line_total,status)')
    .eq('organization_id', organizationId)
    .in('table_session_id', sessionIds.length ? sessionIds : ['00000000-0000-0000-0000-000000000000'])
    .in('status', ['open', 'pending_payment'])
    .order('created_at', { ascending: false });

  const byTable = new Map(sessionRows.map((session) => [session.pool_table_id, session]));
  const bySessionOrder = new Map((orders ?? []).map((openOrder) => [openOrder.table_session_id, openOrder]));
  const initialTables: TableWithCurrentSession[] = (tables ?? []).map((table) => {
    const currentSession = byTable.get(table.id) ?? null;
    const currentOrder = currentSession ? bySessionOrder.get(currentSession.id) ?? null : null;
    return { ...table, currentSession, currentOrder };
  });

  return <MesasClient initialTables={initialTables} organizationId={organizationId} userId={user.id} />;
}
