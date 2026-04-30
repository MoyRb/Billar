'use client';

import { useMemo, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { EmptyState, PageHeader, StatusBadge } from '@/components/ui';
import type { TableSession, TableStatus, TableWithCurrentSession } from '@/lib/types';
import { calculateChargeableSeconds, calculateChargedMinutes, calculateTableTotal, formatCurrency, formatDuration } from '@/lib/table-session-utils';

type Action = 'start' | 'pause' | 'resume' | 'close' | 'pay' | 'create';
type AdminAction = 'set_maintenance' | 'unset_maintenance' | 'set_out' | 'reactivate' | 'delete';

const ACTIVE_SESSION_STATUSES: TableSession['status'][] = ['active', 'paused', 'pending_payment'];

export function MesasClient({ initialTables, organizationId, userId }: { initialTables: TableWithCurrentSession[]; organizationId: string; userId: string }) {
  const [tables, setTables] = useState(initialTables);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TableStatus | 'all'>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [newTable, setNewTable] = useState({ name: '', table_type: 'pool', hourly_rate: 0 });
  const [editing, setEditing] = useState<TableWithCurrentSession | null>(null);
  const [editForm, setEditForm] = useState({ name: '', table_type: 'pool', hourly_rate: 0, status: 'available' as TableStatus, is_active: true });
  const [deleteTarget, setDeleteTarget] = useState<TableWithCurrentSession | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  useEffect(() => { const id = setInterval(() => setTick((n) => n + 1), 1000); return () => clearInterval(id); }, []);
  const supabase = useMemo(() => createClient(), []);

  const refresh = async () => {
    const { data, error: tablesError } = await supabase.from('pool_tables').select('*').eq('organization_id', organizationId).order('name');
    if (tablesError) throw tablesError;
    const ids = (data ?? []).map((t) => t.id);
    const { data: sessions, error: sessionsError } = await supabase.from('table_sessions').select('*').in('pool_table_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']).in('status', ACTIVE_SESSION_STATUSES);
    if (sessionsError) throw sessionsError;
    const byTable = new Map((sessions ?? []).map((s) => [s.pool_table_id, s]));
    setTables((data ?? []).map((t) => ({ ...t, currentSession: byTable.get(t.id) ?? null })));
  };

  const hasActiveSession = (table: TableWithCurrentSession) => Boolean(table.currentSession && ACTIVE_SESSION_STATUSES.includes(table.currentSession.status));

  const runAction = async (table: TableWithCurrentSession, action: Action) => {
    setError(null); setSuccess(null); setLoading(`${action}-${table.id}`);
    try {
      if (action === 'start') {
        if (!table.is_active || ['maintenance', 'out_of_service'].includes(table.status)) throw new Error('Esta mesa no se puede iniciar en su estado actual.');
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

  const runAdminAction = async (table: TableWithCurrentSession, action: AdminAction) => {
    setError(null); setSuccess(null); setLoading(`${action}-${table.id}`);
    try {
      if (action === 'set_maintenance') {
        if (table.status !== 'available') throw new Error('Solo una mesa disponible puede entrar a mantenimiento.');
        await supabase.from('pool_tables').update({ status: 'maintenance' }).eq('id', table.id).eq('organization_id', organizationId);
        setSuccess('La mesa fue puesta en mantenimiento.');
      }
      if (action === 'unset_maintenance') {
        if (table.status !== 'maintenance') throw new Error('La mesa no está en mantenimiento.');
        await supabase.from('pool_tables').update({ status: 'available', is_active: true }).eq('id', table.id).eq('organization_id', organizationId);
        setSuccess('La mesa fue reactivada.');
      }
      if (action === 'set_out') {
        if (hasActiveSession(table)) throw new Error('No puedes marcar fuera de servicio una mesa con sesión activa.');
        await supabase.from('pool_tables').update({ status: 'out_of_service', is_active: false }).eq('id', table.id).eq('organization_id', organizationId);
        setSuccess('La mesa fue marcada como fuera de servicio.');
      }
      if (action === 'reactivate') {
        if (!['maintenance', 'out_of_service'].includes(table.status)) throw new Error('Solo aplica para mesas en mantenimiento o fuera de servicio.');
        await supabase.from('pool_tables').update({ status: 'available', is_active: true }).eq('id', table.id).eq('organization_id', organizationId);
        setSuccess('La mesa fue reactivada.');
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la acción administrativa.');
    } finally { setLoading(null); }
  };

  const createTable = async () => {
    setError(null); setSuccess(null); setLoading('create');
    try {
      if (!newTable.name.trim()) throw new Error('Ingresa nombre de mesa.');
      if (newTable.hourly_rate < 0) throw new Error('La tarifa debe ser mayor o igual a 0.');
      await supabase.from('pool_tables').insert({ organization_id: organizationId, name: newTable.name.trim(), table_type: newTable.table_type, hourly_rate: newTable.hourly_rate, status: 'available', is_active: true });
      setNewTable({ name: '', table_type: 'pool', hourly_rate: 0 });
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo crear la mesa.'); }
    finally { setLoading(null); }
  };

  const openEdit = (table: TableWithCurrentSession) => {
    setEditing(table);
    setEditForm({ name: table.name, table_type: table.table_type, hourly_rate: table.hourly_rate, status: table.status, is_active: table.is_active });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setLoading(`edit-${editing.id}`); setError(null); setSuccess(null);
    try {
      if (!editForm.name.trim()) throw new Error('El nombre es obligatorio.');
      if (editForm.hourly_rate < 0) throw new Error('La tarifa debe ser mayor o igual a 0.');
      if (hasActiveSession(editing) && ['maintenance', 'out_of_service', 'available'].includes(editForm.status)) {
        throw new Error('No se permite un estado inconsistente con una sesión activa.');
      }
      await supabase.from('pool_tables').update({ ...editForm, name: editForm.name.trim() }).eq('id', editing.id).eq('organization_id', organizationId);
      setEditing(null);
      setSuccess('La mesa fue actualizada correctamente.');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar la mesa.');
    } finally { setLoading(null); }
  };

  const deleteTable = async () => {
    if (!deleteTarget) return;
    setError(null); setSuccess(null); setLoading(`delete-${deleteTarget.id}`);
    try {
      if (hasActiveSession(deleteTarget) || ['occupied', 'paused', 'pending_payment'].includes(deleteTarget.status)) {
        throw new Error('No puedes eliminar una mesa con sesión activa.');
      }
      const { count, error: countError } = await supabase.from('table_sessions').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('pool_table_id', deleteTarget.id);
      if (countError) throw countError;
      if ((count ?? 0) > 0) {
        throw new Error('Esta mesa tiene historial. Se recomienda desactivarla en lugar de eliminarla.');
      }
      if (deleteConfirm.trim() !== deleteTarget.name) throw new Error('Escribe el nombre exacto de la mesa para confirmar.');
      await supabase.from('pool_tables').delete().eq('id', deleteTarget.id).eq('organization_id', organizationId);
      setDeleteTarget(null);
      setDeleteConfirm('');
      setSuccess('Mesa eliminada correctamente.');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar la mesa.');
    } finally { setLoading(null); }
  };

  const renderTimer = (session: TableSession | null) => session ? formatDuration(calculateChargeableSeconds(session)) : '--:--:--';

  const visibleTables = tables.filter((t) => (showInactive ? true : t.is_active)).filter((t) => statusFilter === 'all' ? true : t.status === statusFilter);

  return <div className="space-y-6">
    <PageHeader title="Mesas" description="Control y administración de mesas sin romper el flujo de sesiones." />
    <div className="rounded-2xl border border-rack-gold/10 bg-rack-panel p-4">
      <p className="mb-2 text-sm text-rack-cream/70">Nueva mesa</p>
      <div className="grid gap-2 md:grid-cols-4">
        <input className="rounded-lg bg-rack-shell/70 px-3 py-2 text-sm" placeholder="Nombre" value={newTable.name} onChange={(e) => setNewTable({ ...newTable, name: e.target.value })} />
        <input className="rounded-lg bg-rack-shell/70 px-3 py-2 text-sm" placeholder="Tipo" value={newTable.table_type} onChange={(e) => setNewTable({ ...newTable, table_type: e.target.value })} />
        <input className="rounded-lg bg-rack-shell/70 px-3 py-2 text-sm" type="number" min={0} placeholder="Tarifa" value={newTable.hourly_rate} onChange={(e) => setNewTable({ ...newTable, hourly_rate: Number(e.target.value) })} />
        <button onClick={createTable} className="rounded-lg border border-rack-gold/40 px-3 py-2 text-sm" disabled={loading === 'create'}>Crear mesa</button>
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-rack-gold/10 bg-rack-panel/60 p-3 text-sm">
      <select className="rounded-lg bg-rack-shell/70 px-3 py-2" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TableStatus | 'all')}>
        <option value="all">Todos los estados</option><option value="available">Disponible</option><option value="occupied">Ocupada</option><option value="paused">Pausada</option><option value="pending_payment">Pendiente de pago</option><option value="maintenance">Mantenimiento</option><option value="reserved">Reservada</option><option value="out_of_service">Fuera de servicio</option>
      </select>
      <label className="flex items-center gap-2"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />Mostrar inactivas</label>
    </div>
    {error && <p className="text-sm text-red-300">{error}</p>}
    {success && <p className="text-sm text-emerald-300">{success}</p>}
    {visibleTables.length === 0 ? <EmptyState title="No hay mesas en este filtro" description="Ajusta los filtros o crea una nueva mesa." /> : <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {visibleTables.map((table) => {
        const session = table.currentSession;
        const total = session?.status === 'pending_payment' ? session.table_total : session ? calculateTableTotal(calculateChargedMinutes(calculateChargeableSeconds(session)), session.hourly_rate) : 0;
        return <article key={table.id} className="rounded-2xl border border-rack-gold/10 bg-rack-panel p-4"><div className="flex items-center justify-between"><h3 className="text-lg font-semibold">{table.name}</h3><StatusBadge status={table.status} /></div><p className="text-sm text-rack-cream/70">{table.table_type} {!table.is_active && '• Inactiva'}</p><p className="mt-3 text-sm">Tarifa: {formatCurrency(table.hourly_rate)}/h</p><p className="text-sm">Tiempo: {renderTimer(session)} {tick ? '' : ''}</p><p className="text-sm">Total: {formatCurrency(total)}</p>
          <div className="mt-3 flex flex-wrap gap-2 [&_button]:rounded-lg [&_button]:border [&_button]:border-rack-gold/40 [&_button]:px-2 [&_button]:py-1 [&_button]:text-sm">
            {table.status === 'available' && table.is_active && <button onClick={() => runAction(table, 'start')} disabled={loading === `start-${table.id}`}>Iniciar</button>}
            {table.status === 'occupied' && <><button onClick={() => runAction(table, 'pause')}>Pausar</button><button onClick={() => runAction(table, 'close')}>Cerrar</button></>}
            {table.status === 'paused' && <><button onClick={() => runAction(table, 'resume')}>Reanudar</button><button onClick={() => runAction(table, 'close')}>Cerrar</button></>}
            {table.status === 'pending_payment' && <button onClick={() => runAction(table, 'pay')}>Marcar pagada</button>}
            <button onClick={() => openEdit(table)}>Editar</button>
            {table.status === 'available' && <button onClick={() => runAdminAction(table, 'set_maintenance')}>Mantenimiento</button>}
            {table.status === 'maintenance' && <button onClick={() => runAdminAction(table, 'unset_maintenance')}>Quitar mantenimiento</button>}
            {table.status !== 'out_of_service' && !hasActiveSession(table) && <button onClick={() => runAdminAction(table, 'set_out')}>Fuera de servicio</button>}
            {['maintenance', 'out_of_service'].includes(table.status) && <button onClick={() => runAdminAction(table, 'reactivate')}>Reactivar</button>}
            <button onClick={() => setDeleteTarget(table)}>Eliminar</button>
          </div>
        </article>;
      })}
    </section>}

    {editing && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div className="w-full max-w-md rounded-2xl border border-rack-gold/20 bg-rack-panel p-4"><h3 className="mb-3 text-lg font-semibold">Editar mesa</h3><div className="space-y-2 text-sm"><input className="w-full rounded-lg bg-rack-shell/70 px-3 py-2" value={editForm.name} onChange={(e) => setEditForm((s) => ({ ...s, name: e.target.value }))} /><input className="w-full rounded-lg bg-rack-shell/70 px-3 py-2" value={editForm.table_type} onChange={(e) => setEditForm((s) => ({ ...s, table_type: e.target.value }))} /><input type="number" min={0} className="w-full rounded-lg bg-rack-shell/70 px-3 py-2" value={editForm.hourly_rate} onChange={(e) => setEditForm((s) => ({ ...s, hourly_rate: Number(e.target.value) }))} /><select className="w-full rounded-lg bg-rack-shell/70 px-3 py-2" value={editForm.status} onChange={(e) => setEditForm((s) => ({ ...s, status: e.target.value as TableStatus }))}><option value="available">Disponible</option><option value="occupied">Ocupada</option><option value="paused">Pausada</option><option value="pending_payment">Pendiente de pago</option><option value="maintenance">Mantenimiento</option><option value="reserved">Reservada</option><option value="out_of_service">Fuera de servicio</option></select><label className="flex items-center gap-2"><input type="checkbox" checked={editForm.is_active} onChange={(e) => setEditForm((s) => ({ ...s, is_active: e.target.checked }))} />Mesa activa</label></div><div className="mt-4 flex justify-end gap-2"><button className="rounded-lg border border-rack-gold/30 px-3 py-2 text-sm" onClick={() => setEditing(null)}>Cancelar</button><button className="rounded-lg border border-rack-gold/50 px-3 py-2 text-sm" onClick={saveEdit} disabled={loading === `edit-${editing.id}`}>Guardar</button></div></div></div>}

    {deleteTarget && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-rack-panel p-4"><h3 className="mb-2 text-lg font-semibold">Eliminar mesa</h3><p className="text-sm text-rack-cream/80">Esta acción es irreversible. Escribe <b>{deleteTarget.name}</b> para confirmar.</p><input className="mt-3 w-full rounded-lg bg-rack-shell/70 px-3 py-2 text-sm" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} /><div className="mt-4 flex justify-end gap-2"><button className="rounded-lg border border-rack-gold/30 px-3 py-2 text-sm" onClick={() => { setDeleteTarget(null); setDeleteConfirm(''); }}>Cancelar</button><button className="rounded-lg border border-red-500/50 px-3 py-2 text-sm" onClick={deleteTable} disabled={loading === `delete-${deleteTarget.id}`}>Confirmar eliminar</button></div></div></div>}
  </div>;
}
