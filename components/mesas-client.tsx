'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PageHeader, StatusBadge } from '@/components/ui';
import type { PoolTable, TableSession, TableStatus, TableWithCurrentSession } from '@/lib/types';
import { calculateChargeableSeconds, calculateChargedMinutes, calculateTableTotal, formatCurrency, formatDuration } from '@/lib/table-session-utils';

type Action = 'start' | 'pause' | 'resume' | 'close' | 'pay' | 'set_maintenance' | 'set_out_of_service' | 'reactivate' | 'delete';
type Product = { id: string; name: string; sku: string | null; barcode: string | null; sale_price: number; cost_price: number; stock: number; is_active: boolean };
type OrderItem = { id: string; product_name: string; quantity: number; unit_price: number; line_total: number; status: 'active' | 'cancelled' };
type TableOrder = { id: string; status: string; table_total: number; products_total: number; discount_total: number; total: number; order_items: OrderItem[] };

type TableForm = { name: string; table_type: string; hourly_rate: string; status: Extract<TableStatus, 'available' | 'maintenance' | 'out_of_service' | 'reserved'>; is_active: boolean };

const ACTIVE_SESSION_STATUSES: TableSession['status'][] = ['active', 'paused', 'pending_payment'];
const ADMIN_STATUSES: TableStatus[] = ['available', 'occupied', 'paused', 'pending_payment', 'maintenance', 'reserved', 'out_of_service'];

export function MesasClient({ initialTables, organizationId, userId }: { initialTables: TableWithCurrentSession[]; organizationId: string; userId: string }) {
  const [tables, setTables] = useState(initialTables);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TableStatus | 'all'>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [accountTable, setAccountTable] = useState<TableWithCurrentSession | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [order, setOrder] = useState<TableOrder | null>(null);
  const [query, setQuery] = useState('');
  const [barcode, setBarcode] = useState('');
  const [qtyByProduct, setQtyByProduct] = useState<Record<string, number>>({});
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableWithCurrentSession | null>(null);
  const [form, setForm] = useState<TableForm>({ name: '', table_type: '', hourly_rate: '0', status: 'available', is_active: true });

  const supabase = useMemo(() => createClient(), []);
  const setFormFromTable = (table?: PoolTable) => setForm(table ? { name: table.name, table_type: table.table_type, hourly_rate: String(table.hourly_rate), status: table.status === 'occupied' || table.status === 'paused' || table.status === 'pending_payment' ? 'available' : table.status, is_active: table.is_active } : { name: '', table_type: '', hourly_rate: '0', status: 'available', is_active: true });

  const refresh = async () => {
    const { data: tableData, error: tablesError } = await supabase.from('pool_tables').select('*').eq('organization_id', organizationId).order('name');
    if (tablesError) throw tablesError;
    const ids = (tableData ?? []).map((t) => t.id);
    const { data: sessions, error: sessionsError } = await supabase.from('table_sessions').select('*').in('pool_table_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']).in('status', ACTIVE_SESSION_STATUSES);
    if (sessionsError) throw sessionsError;
    const byTable = new Map((sessions ?? []).map((s) => [s.pool_table_id, s]));
    setTables((tableData ?? []).map((t) => ({ ...t, currentSession: byTable.get(t.id) ?? null })));
  };

  const loadAccount = async (table: TableWithCurrentSession) => {
    if (!table.currentSession) throw new Error('No hay sesión activa para esta mesa.');
    const { data: orderData } = await supabase.from('orders').select('id,status,table_total,products_total,discount_total,total,order_items(id,product_name,quantity,unit_price,line_total,status)').eq('organization_id', organizationId).eq('table_session_id', table.currentSession.id).in('status', ['open', 'pending_payment', 'paid']).order('created_at', { ascending: false }).limit(1).maybeSingle();
    setOrder(orderData as TableOrder | null);
    const { data: productsData, error: productsError } = await supabase.from('products').select('id,name,sku,barcode,sale_price,cost_price,stock,is_active').eq('organization_id', organizationId).eq('is_active', true).gt('stock', 0).order('name');
    if (productsError) throw productsError;
    setProducts((productsData ?? []) as Product[]);
  };

  const runAction = async (table: TableWithCurrentSession, action: Action) => {
    setError(null); setSuccess(null);
    try {
      if (action === 'start') {
        if (table.status !== 'available') throw new Error('La mesa no está disponible para iniciar.');
        await supabase.from('table_sessions').insert({ organization_id: organizationId, pool_table_id: table.id, opened_by: userId, status: 'active', hourly_rate: table.hourly_rate });
        await supabase.from('pool_tables').update({ status: 'occupied' }).eq('id', table.id).eq('organization_id', organizationId);
      }
      if (action === 'pause') { await supabase.from('table_sessions').update({ status: 'paused', paused_at: new Date().toISOString() }).eq('id', table.currentSession?.id).eq('organization_id', organizationId); await supabase.from('pool_tables').update({ status: 'paused' }).eq('id', table.id).eq('organization_id', organizationId); }
      if (action === 'resume') {
        const session = table.currentSession;
        if (!session || session.status !== 'paused' || !session.paused_at) throw new Error('No hay sesión pausada para reanudar.');
        const pausedSeconds = Math.max(0, Math.floor((Date.now() - new Date(session.paused_at).getTime()) / 1000));
        await supabase.from('table_sessions').update({ status: 'active', paused_at: null, total_paused_seconds: session.total_paused_seconds + pausedSeconds }).eq('id', session.id).eq('organization_id', organizationId);
        await supabase.from('pool_tables').update({ status: 'occupied' }).eq('id', table.id).eq('organization_id', organizationId);
      }
      if (action === 'close') {
        const session = table.currentSession; if (!session || !['active', 'paused'].includes(session.status)) throw new Error('No hay sesión abierta para cerrar.');
        const chargeableSeconds = calculateChargeableSeconds(session); const chargedMinutes = calculateChargedMinutes(chargeableSeconds); const tableTotal = calculateTableTotal(chargedMinutes, session.hourly_rate);
        await supabase.from('table_sessions').update({ status: 'pending_payment', ended_at: new Date().toISOString(), charged_minutes: chargedMinutes, table_total: tableTotal, closed_by: userId }).eq('id', session.id).eq('organization_id', organizationId);
        await supabase.from('pool_tables').update({ status: 'pending_payment' }).eq('id', table.id).eq('organization_id', organizationId);
      }
      if (action === 'pay') {
        const session = table.currentSession; if (!session || session.status !== 'pending_payment') throw new Error('La mesa no está lista para cobro.');
        const { data: existingOrder } = await supabase.from('orders').select('id').eq('organization_id', organizationId).eq('table_session_id', session.id).eq('status', 'pending_payment').limit(1).maybeSingle();
        if (existingOrder) await supabase.from('orders').update({ status: 'paid', payment_method: 'cash', paid_at: new Date().toISOString() }).eq('id', existingOrder.id).eq('organization_id', organizationId);
        await supabase.from('table_sessions').update({ status: 'paid' }).eq('id', session.id).eq('organization_id', organizationId);
        await supabase.from('pool_tables').update({ status: 'available' }).eq('id', table.id).eq('organization_id', organizationId);
      }
      if (action === 'set_maintenance') await supabase.from('pool_tables').update({ status: 'maintenance' }).eq('id', table.id).eq('organization_id', organizationId);
      if (action === 'set_out_of_service') await supabase.from('pool_tables').update({ status: 'out_of_service' }).eq('id', table.id).eq('organization_id', organizationId);
      if (action === 'reactivate') await supabase.from('pool_tables').update({ status: 'available', is_active: true }).eq('id', table.id).eq('organization_id', organizationId);
      if (action === 'delete') {
        const { count } = await supabase.from('table_sessions').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('pool_table_id', table.id);
        if ((count ?? 0) > 0) throw new Error('No se puede eliminar una mesa con historial.');
        await supabase.from('pool_tables').delete().eq('id', table.id).eq('organization_id', organizationId);
      }
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error inesperado.'); }
  };

  const saveTable = async () => {
    setError(null); setSuccess(null);
    const hourlyRate = Number(form.hourly_rate);
    if (!form.name.trim()) return setError('El nombre de la mesa es obligatorio.');
    if (!Number.isFinite(hourlyRate) || hourlyRate < 0) return setError('La tarifa por hora debe ser mayor o igual a 0.');
    const duplicate = tables.find((t) => t.name.trim().toLowerCase() === form.name.trim().toLowerCase() && t.id !== editingTable?.id);
    if (duplicate) return setError('Ya existe una mesa con ese nombre.');
    const payload = { name: form.name.trim(), table_type: form.table_type.trim() || 'general', hourly_rate: hourlyRate, is_active: form.is_active };
    if (editingTable) {
      await supabase.from('pool_tables').update({ ...payload, status: ['occupied', 'paused', 'pending_payment'].includes(editingTable.status) ? editingTable.status : form.status }).eq('id', editingTable.id).eq('organization_id', organizationId);
      setSuccess('Mesa actualizada.');
    } else {
      await supabase.from('pool_tables').insert({ organization_id: organizationId, ...payload, status: 'available' });
      setSuccess('Mesa creada.');
    }
    setEditingTable(null); setIsCreateOpen(false); setFormFromTable();
    await refresh();
  };

  const addProduct = async (product: Product, qty = 1) => { /* unchanged */
    if (!accountTable?.currentSession || !['occupied', 'paused'].includes(accountTable.status)) return setError('Solo puedes vender en mesas ocupadas o pausadas.');
    const quantity = Number(qtyByProduct[product.id] ?? qty);
    if (quantity <= 0) return setError('Cantidad inválida.');
    const { error: rpcError } = await supabase.rpc('add_product_to_table_session', { p_org: organizationId, p_pool_table: accountTable.id, p_session: accountTable.currentSession.id, p_product: product.id, p_qty: quantity, p_user: userId });
    if (rpcError) return setError(rpcError.message);
    setSuccess('Producto agregado.');
    await loadAccount(accountTable); await refresh();
  };

  const visibleTables = tables.filter((t) => (showInactive ? true : t.is_active)).filter((t) => statusFilter === 'all' ? true : t.status === statusFilter);

  return <div className="space-y-6">
    <PageHeader title="Mesas" description="Control y administración de mesas." />
    {error && <p className="text-sm text-red-300">{error}</p>}{success && <p className="text-sm text-emerald-300">{success}</p>}
    <section className="rounded-2xl border border-rack-gold/20 bg-rack-panel p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button className="rounded border border-rack-gold/40 px-3 py-2" onClick={() => { setIsCreateOpen(true); setEditingTable(null); setFormFromTable(); }}>Nueva mesa</button>
        <select className="rounded bg-rack-shell/60 px-2 py-2" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TableStatus | 'all')}>
          <option value="all">Todos los estados</option>{ADMIN_STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Mostrar inactivas</label>
      </div>
    </section>
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visibleTables.map((table) => { const s = table.currentSession; const tableRunning = s?.status === 'pending_payment' ? s.table_total : s ? calculateTableTotal(calculateChargedMinutes(calculateChargeableSeconds(s)), s.hourly_rate) : 0; const productsTotal = table.id === accountTable?.id ? Number(order?.products_total ?? 0) : 0; return <article key={table.id} className="rounded-2xl border border-rack-gold/10 bg-rack-panel p-4"><div className="flex items-center justify-between"><h3 className="text-lg font-semibold">{table.name}</h3><StatusBadge status={table.status} /></div><p className="text-sm">Tiempo: {s ? formatDuration(calculateChargeableSeconds(s)) : '--:--'}</p><p className="text-sm">Mesa: {formatCurrency(tableRunning)}</p><p className="text-sm">Productos: {formatCurrency(productsTotal)}</p><p className="text-sm">Total: {formatCurrency(tableRunning + productsTotal)}</p><div className="mt-3 flex flex-wrap gap-2 [&_button]:rounded-lg [&_button]:border [&_button]:border-rack-gold/40 [&_button]:px-2 [&_button]:py-1 [&_button]:text-sm">{table.status==='available'&&<button onClick={()=>runAction(table,'start')}>Iniciar</button>}{['occupied','paused','pending_payment'].includes(table.status)&&<button onClick={async()=>{setAccountTable(table);await loadAccount(table);}}>{table.status==='pending_payment'?'Ver cuenta':'Cuenta'}</button>}{['occupied','paused'].includes(table.status)&&<button onClick={async()=>{setAccountTable(table);await loadAccount(table);}}>Agregar producto</button>}{table.status==='occupied'&&<button onClick={()=>runAction(table,'pause')}>Pausar</button>}{table.status==='paused'&&<button onClick={()=>runAction(table,'resume')}>Reanudar</button>}{['occupied','paused'].includes(table.status)&&<button onClick={()=>runAction(table,'close')}>Cerrar</button>}{table.status==='pending_payment'&&<button onClick={()=>runAction(table,'pay')}>Cobrar</button>}</div>
      <details className="mt-2 text-sm"><summary className="cursor-pointer text-rack-gold">Más acciones</summary><div className="mt-2 flex flex-wrap gap-2 [&_button]:rounded [&_button]:border [&_button]:border-rack-gold/30 [&_button]:px-2 [&_button]:py-1"><button onClick={()=>{setEditingTable(table);setFormFromTable(table);setIsCreateOpen(true);}}>Editar</button>{table.status==='available'&&<><button onClick={()=>runAction(table,'set_maintenance')}>Mantenimiento</button><button onClick={()=>runAction(table,'set_out_of_service')}>Fuera de servicio</button><button onClick={()=>runAction(table,'delete')}>Eliminar</button></>}{table.status==='maintenance'&&<><button onClick={()=>runAction(table,'reactivate')}>Reactivar</button><button onClick={()=>runAction(table,'set_out_of_service')}>Fuera de servicio</button><button onClick={()=>runAction(table,'delete')}>Eliminar</button></>}{table.status==='out_of_service'&&<><button onClick={()=>runAction(table,'reactivate')}>Reactivar</button><button onClick={()=>runAction(table,'delete')}>Eliminar</button></>}</div></details></article>; })}</section>
    {isCreateOpen && <div className="fixed inset-0 z-50 bg-black/70 p-4"><div className="mx-auto max-w-lg rounded-2xl border border-rack-gold/20 bg-rack-panel p-4 space-y-2"><h3 className="text-lg font-semibold">{editingTable ? 'Editar mesa' : 'Nueva mesa'}</h3><input className="w-full rounded bg-rack-shell/60 p-2" placeholder="Nombre" value={form.name} onChange={(e)=>setForm((s)=>({...s,name:e.target.value}))} /><input className="w-full rounded bg-rack-shell/60 p-2" placeholder="Tipo de mesa" value={form.table_type} onChange={(e)=>setForm((s)=>({...s,table_type:e.target.value}))} /><input type="number" min={0} className="w-full rounded bg-rack-shell/60 p-2" placeholder="Tarifa por hora" value={form.hourly_rate} onChange={(e)=>setForm((s)=>({...s,hourly_rate:e.target.value}))} />{editingTable && !['occupied','paused','pending_payment'].includes(editingTable.status) && <select className="w-full rounded bg-rack-shell/60 p-2" value={form.status} onChange={(e)=>setForm((s)=>({...s,status:e.target.value as TableForm['status']}))}>{['available','maintenance','reserved','out_of_service'].map((s)=><option key={s} value={s}>{s}</option>)}</select>}<label className="flex items-center gap-2"><input type="checkbox" checked={form.is_active} onChange={(e)=>setForm((s)=>({...s,is_active:e.target.checked}))} /> Activa</label><div className="flex gap-2"><button className="rounded border border-rack-gold/40 px-3 py-2" onClick={()=>void saveTable()}>Guardar</button><button className="rounded border border-rack-gold/40 px-3 py-2" onClick={()=>{setIsCreateOpen(false);setEditingTable(null);}}>Cancelar</button></div></div></div>}
  </div>;
}
