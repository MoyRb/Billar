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
    .eq('is_active', true)
    .order('name');

  const tableIds = (tables ?? []).map((t) => t.id);
  const { data: sessions } = await supabase
    .from('table_sessions')
    .select('*')
    .in('pool_table_id', tableIds.length ? tableIds : ['00000000-0000-0000-0000-000000000000'])
    .in('status', ['active', 'paused', 'pending_payment']);

  const byTable = new Map((sessions as TableSession[] | null ?? []).map((session) => [session.pool_table_id, session]));
  const initialTables: TableWithCurrentSession[] = (tables ?? []).map((table) => ({ ...table, currentSession: byTable.get(table.id) ?? null }));

  return <MesasClient initialTables={initialTables} organizationId={organizationId} userId={user.id} />;
}
