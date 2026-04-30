'use client';

import { useMemo, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { EmptyState, PageHeader, StatusBadge } from '@/components/ui';
import type { TableSession, TableStatus, TableWithCurrentSession } from '@/lib/types';
import { calculateChargeableSeconds, calculateChargedMinutes, calculateSessionElapsedSeconds, calculateTableTotal, formatCurrency, formatDuration } from '@/lib/table-session-utils';

type Action = 'start' | 'pause' | 'resume' | 'close' | 'pay' | 'create';

export function MesasClient({ initialTables, organizationId, userId }: { initialTables: TableWithCurrentSession[]; organizationId: string; userId: string }) {
  const [tables, setTables] = useState(initialTables);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newTable, setNewTable] = useState({ name: '', table_type: 'pool', hourly_rate: 0 });

  useEffect(() => { const id = setInterval(() => setTick((n) => n + 1), 1000); return () => clearInterval(id); }, []);
  const supabase = useMemo(() => createClient(), []);

  const refresh = async () => {
    const { data, error: tablesError } = await supabase.from('pool_tables').select('*').eq('organization_id', organizationId).eq('is_active', true).order('name');
    if (tablesError) throw tablesError;
    const ids = (data ?? []).map((t) => t.id);
    const { data: sessions, error: sessionsError } = await supabase.from('table_sessions').select('*').in('pool_table_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']).in('status', ['active', 'paused', 'pending_payment']);
    if (sessionsError) throw sessionsError;
    const byTable = new Map((sessions ?? []).map((s) => [s.pool_table_id, s]));
    setTables((data ?? []).map((t) => ({ ...t, currentSession: byTable.get(t.id) ?? null })));
  };

  const runAction = async (table: TableWithCurrentSession, action: Action) => {
    setError(null); setLoading(`${action}-${table.id}`);
    try {
      if (action === 'start') {
        if (table.status !== 'available') throw new Error('La mesa no está disponible para iniciar.');
        await supabase.from('table_sessions').insert({ organization_id: organizationId, pool_table_id: table.id, opened_by: userId, status: 'active', hourly_rate: table.hourly_rate });
        await supabase.from('pool_tables').update({ status: 'occupied' }).eq('id', table.id).eq('organization_id', organizationId);
      }
      if (action === 'pause') {
        if (!table.currentSession || table.currentSession.status !== 'active') throw new Error('No hay sesión activa para pausar.');
        await supabase.from('table_sessions').update({ status: 'paused', paused_at: new Date().toISOString() }).eq('id', table.currentSession.id).eq('organization_id', organizationId);
        await supabase.from('pool_tables').update({ status: 'paused' }).eq('id', table.id).eq('organization_id', organizationId);
      }
      if (action === 'resume') {
        const session = table.currentSession;
        if (!session || session.status !== 'paused' || !session.paused_at) throw new Error('No hay sesión pausada para reanudar.');
        const pausedSeconds = Math.max(0, Math.floor((Date.now() - new Date(session.paused_at).getTime()) / 1000));
        await supabase.from('table_sessions').update({ status: 'active', paused_at: null, total_paused_seconds: session.total_paused_seconds + pausedSeconds }).eq('id', session.id).eq('organization_id', organizationId);
        await supabase.from('pool_tables').update({ status: 'occupied' }).eq('id', table.id).eq('organization_id', organizationId);
      }
      if (action === 'close') {
        const session = table.currentSession;
        if (!session || !['active', 'paused'].includes(session.status)) throw new Error('No hay sesión abierta para cerrar.');
        const chargeableSeconds = calculateChargeableSeconds(session);
        const chargedMinutes = calculateChargedMinutes(chargeableSeconds);
        const tableTotal = calculateTableTotal(chargedMinutes, session.hourly_rate);
        await supabase.from('table_sessions').update({ status: 'pending_payment', ended_at: new Date().toISOString(), charged_minutes: chargedMinutes, table_total: tableTotal, closed_by: userId }).eq('id', session.id).eq('organization_id', organizationId);
        await supabase.from('pool_tables').update({ status: 'pending_payment' }).eq('id', table.id).eq('organization_id', organizationId);
      }
      if (action === 'pay') {
        const session = table.currentSession;
        if (!session || session.status !== 'pending_payment' || table.status !== 'pending_payment') throw new Error('La mesa no está lista para cobro básico.');
        await supabase.from('table_sessions').update({ status: 'paid' }).eq('id', session.id).eq('organization_id', organizationId);
        await supabase.from('pool_tables').update({ status: 'available' }).eq('id', table.id).eq('organization_id', organizationId);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ocurrió un error inesperado.');
    } finally { setLoading(null); }
  };

  const createTable = async () => {
    setError(null); setLoading('create');
    try {
      if (!newTable.name.trim()) throw new Error('Ingresa nombre de mesa.');
      await supabase.from('pool_tables').insert({ organization_id: organizationId, name: newTable.name.trim(), table_type: newTable.table_type, hourly_rate: newTable.hourly_rate, status: 'available', is_active: true });
      setNewTable({ name: '', table_type: 'pool', hourly_rate: 0 });
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo crear la mesa.'); }
    finally { setLoading(null); }
  };

  const renderTimer = (session: TableSession | null) => {
    if (!session) return '--:--:--';
    const secs = calculateChargeableSeconds(session);
    return formatDuration(secs + tick - tick);
  };

  return <div className="space-y-6">
    <PageHeader title="Mesas" description="Control de mesas por tiempo en operación real." />
    <div className="rounded-2xl border border-rack-gold/10 bg-rack-panel p-4">
      <p className="mb-2 text-sm text-rack-cream/70">Nueva mesa</p>
      <div className="grid gap-2 md:grid-cols-4">
        <input className="rounded-lg bg-rack-shell/70 px-3 py-2 text-sm" placeholder="Nombre" value={newTable.name} onChange={(e) => setNewTable({ ...newTable, name: e.target.value })} />
        <input className="rounded-lg bg-rack-shell/70 px-3 py-2 text-sm" placeholder="Tipo" value={newTable.table_type} onChange={(e) => setNewTable({ ...newTable, table_type: e.target.value })} />
        <input className="rounded-lg bg-rack-shell/70 px-3 py-2 text-sm" type="number" placeholder="Tarifa" value={newTable.hourly_rate} onChange={(e) => setNewTable({ ...newTable, hourly_rate: Number(e.target.value) })} />
        <button onClick={createTable} className="rounded-lg border border-rack-gold/40 px-3 py-2 text-sm" disabled={loading === 'create'}>Crear mesa</button>
      </div>
    </div>
    {error && <p className="text-sm text-red-300">{error}</p>}
    {tables.length === 0 ? <EmptyState title="No hay mesas registradas" description="Crea una mesa para comenzar la operación." /> : <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {tables.map((table) => {
        const statusActions: Partial<Record<TableStatus, JSX.Element>> = {
          available: <button onClick={() => runAction(table, 'start')}>Iniciar mesa</button>,
          occupied: <div className="flex gap-2"><button onClick={() => runAction(table, 'pause')}>Pausar</button><button onClick={() => runAction(table, 'close')}>Cerrar</button></div>,
          paused: <div className="flex gap-2"><button onClick={() => runAction(table, 'resume')}>Reanudar</button><button onClick={() => runAction(table, 'close')}>Cerrar</button></div>,
          pending_payment: <button onClick={() => runAction(table, 'pay')}>Marcar como pagada</button>,
        };
        const session = table.currentSession;
        const total = session?.status === 'pending_payment' ? session.table_total : session ? calculateTableTotal(calculateChargedMinutes(calculateChargeableSeconds(session)), session.hourly_rate) : 0;
        return <article key={table.id} className="rounded-2xl border border-rack-gold/10 bg-rack-panel p-4"><div className="flex items-center justify-between"><h3 className="text-lg font-semibold">{table.name}</h3><StatusBadge status={table.status} /></div><p className="text-sm text-rack-cream/70">{table.table_type}</p><p className="mt-3 text-sm">Tarifa: {formatCurrency(table.hourly_rate)}/h</p><p className="text-sm">Tiempo: {renderTimer(session)}</p><p className="text-sm">Total: {formatCurrency(total)}</p><div className="mt-3 [&_button]:rounded-lg [&_button]:border [&_button]:border-rack-gold/40 [&_button]:px-2 [&_button]:py-1 [&_button]:text-sm">{statusActions[table.status] ?? <span className="text-sm text-rack-cream/60">Sin acción</span>}</div></article>;
      })}
    </section>}
  </div>;
}
