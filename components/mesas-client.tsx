'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PageHeader, StatusBadge } from '@/components/ui';
import type { TableSession, TableStatus, TableWithCurrentSession } from '@/lib/types';
import { calculateChargeableSeconds, calculateChargedMinutes, calculateTableTotal, formatCurrency, formatDuration } from '@/lib/table-session-utils';

type Action = 'start' | 'pause' | 'resume' | 'close' | 'pay' | 'create';
type Product = { id: string; name: string; sku: string | null; barcode: string | null; sale_price: number; cost_price: number; stock: number; is_active: boolean };
type OrderItem = { id: string; product_name: string; quantity: number; unit_price: number; line_total: number; status: 'active' | 'cancelled' };
type TableOrder = { id: string; status: string; table_total: number; products_total: number; discount_total: number; total: number; order_items: OrderItem[] };

const ACTIVE_SESSION_STATUSES: TableSession['status'][] = ['active', 'paused', 'pending_payment'];

export function MesasClient({ initialTables, organizationId, userId }: { initialTables: TableWithCurrentSession[]; organizationId: string; userId: string }) {
  const [tables, setTables] = useState(initialTables);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [statusFilter] = useState<TableStatus | 'all'>('all');
  const [showInactive] = useState(false);
  const [accountTable, setAccountTable] = useState<TableWithCurrentSession | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [order, setOrder] = useState<TableOrder | null>(null);
  const [query, setQuery] = useState('');
  const [barcode, setBarcode] = useState('');
  const [qtyByProduct, setQtyByProduct] = useState<Record<string, number>>({});

  const supabase = useMemo(() => createClient(), []);

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
        const { data: existingOrder } = await supabase.from('orders').select('id,discount_total').eq('organization_id', organizationId).eq('table_session_id', session.id).in('status', ['open', 'pending_payment']).limit(1).maybeSingle();
        if (existingOrder) {
          const productsTotal = Number((await supabase.from('order_items').select('line_total').eq('organization_id', organizationId).eq('order_id', existingOrder.id).eq('status', 'active')).data?.reduce((sum, i) => sum + Number(i.line_total), 0) ?? 0);
          const total = tableTotal + productsTotal - Number(existingOrder.discount_total ?? 0);
          await supabase.from('orders').update({ status: 'pending_payment', table_total: tableTotal, products_total: productsTotal, subtotal: tableTotal + productsTotal, total, closed_by: userId, closed_at: new Date().toISOString() }).eq('id', existingOrder.id).eq('organization_id', organizationId);
        }
        await supabase.from('pool_tables').update({ status: 'pending_payment' }).eq('id', table.id).eq('organization_id', organizationId);
      }
      if (action === 'pay') {
        const session = table.currentSession; if (!session || session.status !== 'pending_payment') throw new Error('La mesa no está lista para cobro.');
        const { data: existingOrder } = await supabase.from('orders').select('id').eq('organization_id', organizationId).eq('table_session_id', session.id).eq('status', 'pending_payment').limit(1).maybeSingle();
        if (existingOrder) await supabase.from('orders').update({ status: 'paid', payment_method: 'cash', paid_at: new Date().toISOString() }).eq('id', existingOrder.id).eq('organization_id', organizationId);
        await supabase.from('table_sessions').update({ status: 'paid' }).eq('id', session.id).eq('organization_id', organizationId);
        await supabase.from('pool_tables').update({ status: 'available' }).eq('id', table.id).eq('organization_id', organizationId);
      }
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error inesperado.'); }
  };

  const addProduct = async (product: Product, qty = 1) => {
    if (!accountTable?.currentSession || !['occupied', 'paused'].includes(accountTable.status)) return setError('Solo puedes vender en mesas ocupadas o pausadas.');
    const quantity = Number(qtyByProduct[product.id] ?? qty);
    if (quantity <= 0) return setError('Cantidad inválida.');
    const { error: rpcError } = await supabase.rpc('add_product_to_table_session', { p_org: organizationId, p_pool_table: accountTable.id, p_session: accountTable.currentSession.id, p_product: product.id, p_qty: quantity, p_user: userId });
    if (rpcError) return setError(rpcError.message);
    setSuccess('Producto agregado.');
    await loadAccount(accountTable); await refresh();
  };

  const cancelItem = async (itemId: string) => {
    const reason = window.prompt('Motivo de cancelación del consumo:');
    if (!reason) return;
    const { error: rpcError } = await supabase.rpc('cancel_order_item', { p_org: organizationId, p_item: itemId, p_reason: reason, p_user: userId });
    if (rpcError) return setError(rpcError.message);
    if (accountTable) await loadAccount(accountTable);
    await refresh();
  };

  const filteredProducts = products.filter((p) => {
    const term = query.trim().toLowerCase();
    if (!term) return true;
    return p.name.toLowerCase().includes(term) || (p.sku ?? '').toLowerCase().includes(term) || (p.barcode ?? '').toLowerCase().includes(term);
  });

  const visibleTables = tables.filter((t) => (showInactive ? true : t.is_active)).filter((t) => statusFilter === 'all' ? true : t.status === statusFilter);

  return <div className="space-y-6">{/* UI omitted for brevity */}
    <PageHeader title="Mesas" description="Control y administración de mesas." />
    {error && <p className="text-sm text-red-300">{error}</p>}{success && <p className="text-sm text-emerald-300">{success}</p>}
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visibleTables.map((table) => { const s = table.currentSession; const tableRunning = s?.status === 'pending_payment' ? s.table_total : s ? calculateTableTotal(calculateChargedMinutes(calculateChargeableSeconds(s)), s.hourly_rate) : 0; const productsTotal = table.id === accountTable?.id ? Number(order?.products_total ?? 0) : 0; return <article key={table.id} className="rounded-2xl border border-rack-gold/10 bg-rack-panel p-4"><div className="flex items-center justify-between"><h3 className="text-lg font-semibold">{table.name}</h3><StatusBadge status={table.status} /></div><p className="text-sm">Tiempo: {s ? formatDuration(calculateChargeableSeconds(s)) : '--:--'}</p><p className="text-sm">Mesa: {formatCurrency(tableRunning)}</p><p className="text-sm">Productos: {formatCurrency(productsTotal)}</p><p className="text-sm">Total: {formatCurrency(tableRunning + productsTotal)}</p><div className="mt-3 flex flex-wrap gap-2 [&_button]:rounded-lg [&_button]:border [&_button]:border-rack-gold/40 [&_button]:px-2 [&_button]:py-1 [&_button]:text-sm">{table.status==='available'&&<button onClick={()=>runAction(table,'start')}>Iniciar</button>}{['occupied','paused'].includes(table.status)&&<><button onClick={async()=>{setAccountTable(table);await loadAccount(table);}}>Cuenta</button><button onClick={async()=>{setAccountTable(table);await loadAccount(table);}}>Agregar producto</button></>}{table.status==='occupied'&&<button onClick={()=>runAction(table,'pause')}>Pausar</button>}{table.status==='paused'&&<button onClick={()=>runAction(table,'resume')}>Reanudar</button>}{['occupied','paused'].includes(table.status)&&<button onClick={()=>runAction(table,'close')}>Cerrar</button>}{table.status==='pending_payment'&&<button onClick={()=>runAction(table,'pay')}>Cobrar</button>}</div></article>; })}</section>

    {accountTable && <div className="fixed inset-0 z-50 bg-black/70 p-4"><div className="mx-auto grid max-w-6xl gap-4 rounded-2xl border border-rack-gold/20 bg-rack-panel p-4 lg:grid-cols-2"><div><h3 className="text-lg font-semibold">Cuenta · {accountTable.name}</h3><input className="mt-3 w-full rounded bg-rack-shell/60 p-2" placeholder="Buscar por nombre/SKU/barcode" value={query} onChange={(e)=>setQuery(e.target.value)} /><input className="mt-2 w-full rounded bg-rack-shell/60 p-2" placeholder="Escanear código de barras" value={barcode} onChange={(e)=>setBarcode(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter'){ const p=products.find((x)=>x.barcode===barcode.trim()); if(!p) return setError('Producto no encontrado'); setBarcode(''); void addProduct(p,1); } }} />
      <div className="mt-3 max-h-80 space-y-2 overflow-auto">{filteredProducts.map((p)=><div key={p.id} className="rounded border border-rack-gold/10 p-2 text-sm"><div>{p.name} · {formatCurrency(p.sale_price)} · stock {p.stock}</div><div className="mt-1 flex gap-2"><input type="number" min={1} className="w-20 rounded bg-rack-shell/60 p-1" value={qtyByProduct[p.id] ?? 1} onChange={(e)=>setQtyByProduct((s)=>({...s,[p.id]:Number(e.target.value)}))} /><button className="rounded border border-rack-gold/40 px-2" onClick={()=>void addProduct(p)}>Agregar</button></div></div>)}</div></div>
      <div><h4 className="font-semibold">Consumo</h4><div className="mt-2 space-y-2">{(order?.order_items ?? []).map((item)=><div key={item.id} className="rounded border border-rack-gold/10 p-2 text-sm"><div>{item.quantity} x {item.product_name} = {formatCurrency(item.line_total)} ({item.status})</div>{item.status==='active'&&<button className="mt-1 rounded border border-red-400/40 px-2" onClick={()=>void cancelItem(item.id)}>Cancelar</button>}</div>)}</div><p className="mt-3">Total productos: {formatCurrency(Number(order?.products_total ?? 0))}</p><p>Total cuenta: {formatCurrency(Number(order?.total ?? 0))}</p><button className="mt-3 rounded border border-rack-gold/40 px-3 py-2" onClick={()=>setAccountTable(null)}>Cerrar</button></div></div></div>}
  </div>;
}
