'use client';

import { useMemo, useState } from 'react';
import { MetricCard } from '@/components/ui';
import { SalesCutTicketModal } from '@/components/sales-cut-thermal-ticket';

type OrderStatus = 'open' | 'pending_payment' | 'paid' | 'cancelled';
type DateFilter = 'today' | 'shift' | 'yesterday' | 'last7';

type OrderView = {
  id: string;
  status: OrderStatus;
  tableTotal: number;
  productsTotal: number;
  discountTotal: number;
  total: number;
  paymentMethod: string | null;
  createdAt: string;
  tableName: string;
};

type SalesCutView = {
  id: string;
  cutType: 'shift' | 'day';
  status: 'closed' | 'cancelled';
  startedAt: string;
  endedAt: string;
  totalOrders: number;
  grossTotal: number;
  tableTotal: number;
  productsTotal: number;
  discountTotal: number;
  cashTotal: number;
  cardTotal: number;
  transferTotal: number;
  otherTotal: number;
  cashierEmail: string;
  orders: { id: string; tableName: string; total: number }[];
};

const money = (v: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v);
const startsToday = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };

export default function VentasClient({ initialOrders, initialCuts, businessName, userEmail }: { initialOrders: OrderView[]; initialCuts: SalesCutView[]; businessName?: string | null; userEmail: string; }) {
  const [orders] = useState(initialOrders);
  const [cuts, setCuts] = useState(initialCuts);
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [tab, setTab] = useState<'ventas' | 'pendientes' | 'cortes'>('ventas');
  const [previewCut, setPreviewCut] = useState<SalesCutView | null>(null);
  const [ticketCut, setTicketCut] = useState<SalesCutView | null>(null);

  const filteredOrders = useMemo(() => {
    const now = new Date();
    const startToday = startsToday();
    const startYesterday = new Date(startToday); startYesterday.setDate(startYesterday.getDate() - 1);
    const startLast7 = new Date(startToday); startLast7.setDate(startLast7.getDate() - 6);
    const lastShift = cuts.filter((c) => c.cutType === 'shift').sort((a,b)=>a.endedAt.localeCompare(b.endedAt)).at(-1);
    const startShift = lastShift ? new Date(lastShift.endedAt) : startToday;

    return orders.filter((o) => {
      if (tab === 'pendientes' && o.status !== 'pending_payment') return false;
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      const created = new Date(o.createdAt);
      if (dateFilter === 'today') return created >= startToday && created <= now;
      if (dateFilter === 'yesterday') return created >= startYesterday && created < startToday;
      if (dateFilter === 'last7') return created >= startLast7 && created <= now;
      return created >= startShift && created <= now;
    });
  }, [orders, statusFilter, dateFilter, tab, cuts]);

  const summary = useMemo(() => {
    const todayPaid = orders.filter((o) => o.status === 'paid' && new Date(o.createdAt) >= startsToday());
    const pendings = orders.filter((o) => o.status === 'pending_payment').length;
    return {
      paidToday: todayPaid.length,
      soldToday: todayPaid.reduce((acc, o) => acc + o.total, 0),
      tableToday: todayPaid.reduce((acc, o) => acc + o.tableTotal, 0),
      productsToday: todayPaid.reduce((acc, o) => acc + o.productsTotal, 0),
      pendings,
      totalOrders: orders.length,
    };
  }, [orders]);

  const prepareCut = (cutType: 'shift' | 'day') => {
    const now = new Date();
    const startToday = startsToday();
    const lastShift = cuts.filter((c) => c.cutType === 'shift').sort((a,b)=>a.endedAt.localeCompare(b.endedAt)).at(-1);
    const startShift = lastShift ? new Date(lastShift.endedAt) : startToday;
    const selected = orders.filter((o) => o.status === 'paid' && (cutType === 'day' ? new Date(o.createdAt) >= startToday : new Date(o.createdAt) >= startShift));
    if (selected.length === 0) return;
    const totalBy = (m: string) => selected.filter((o) => (o.paymentMethod ?? 'other') === m).reduce((a,o)=>a+o.total,0);
    const computed: SalesCutView = {
      id: crypto.randomUUID(),
      cutType,
      status: 'closed',
      startedAt: (cutType === 'day' ? startToday : startShift).toISOString(),
      endedAt: now.toISOString(),
      totalOrders: selected.length,
      grossTotal: selected.reduce((a,o)=>a+o.total,0),
      tableTotal: selected.reduce((a,o)=>a+o.tableTotal,0),
      productsTotal: selected.reduce((a,o)=>a+o.productsTotal,0),
      discountTotal: selected.reduce((a,o)=>a+o.discountTotal,0),
      cashTotal: totalBy('cash'),
      cardTotal: totalBy('card'),
      transferTotal: totalBy('transfer'),
      otherTotal: selected.reduce((a,o)=>a+o.total,0) - totalBy('cash') - totalBy('card') - totalBy('transfer'),
      cashierEmail: userEmail,
      orders: selected.map((o) => ({ id: o.id, tableName: o.tableName, total: o.total })),
    };
    setPreviewCut(computed);
  };

  const confirmCut = async () => {
    if (!previewCut) return;
    const res = await fetch('/api/sales-cuts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(previewCut) });
    if (!res.ok) return;
    const saved = (await res.json()) as SalesCutView;
    setCuts((prev) => [saved, ...prev]);
    setTicketCut(saved);
    setPreviewCut(null);
  };

  return <div className='space-y-4'>
    <div className='grid gap-3 md:grid-cols-3 lg:grid-cols-6'>
      <MetricCard title='Ventas pagadas hoy' value={summary.paidToday} />
      <MetricCard title='Total vendido hoy' value={money(summary.soldToday)} />
      <MetricCard title='Mesas hoy' value={money(summary.tableToday)} />
      <MetricCard title='Productos hoy' value={money(summary.productsToday)} />
      <MetricCard title='Pendientes pago' value={summary.pendings} />
      <MetricCard title='Núm. ventas' value={summary.totalOrders} />
    </div>
    <div className='rounded-2xl border border-rack-gold/10 bg-rack-panel p-4'>
      <div className='mb-3 flex flex-wrap gap-2'>
        {['ventas','pendientes','cortes'].map((v) => <button key={v} onClick={() => setTab(v as 'ventas' | 'pendientes' | 'cortes')} className='rounded border border-rack-gold/40 px-3 py-1'>{v}</button>)}
        <button className='ml-auto rounded border border-rack-gold/40 px-3 py-1' onClick={() => prepareCut('shift')}>Hacer corte turno</button>
        <button className='rounded border border-rack-gold/40 px-3 py-1' onClick={() => prepareCut('day')}>Hacer corte día</button>
      </div>
      {tab !== 'cortes' && <div className='mb-4 flex flex-wrap gap-2'>
        <select className='rounded bg-rack-shell px-2 py-1' value={dateFilter} onChange={(e) => setDateFilter(e.target.value as DateFilter)}><option value='today'>Hoy</option><option value='shift'>Este turno</option><option value='yesterday'>Ayer</option><option value='last7'>Últimos 7 días</option></select>
        <select className='rounded bg-rack-shell px-2 py-1' value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | OrderStatus)}><option value='all'>Todas</option><option value='open'>Abiertas</option><option value='pending_payment'>Pendientes</option><option value='paid'>Pagadas</option><option value='cancelled'>Canceladas</option></select>
      </div>}
      {tab === 'cortes' ? <table className='w-full text-sm'><thead><tr className='text-left text-rack-cream/70'><th>Folio</th><th>Tipo</th><th>Fecha</th><th>Usuario</th><th>Ventas</th><th>Total</th><th>Acciones</th></tr></thead><tbody>{cuts.map((c)=><tr key={c.id} className='border-t border-rack-gold/10'><td>CUT-{c.id.slice(0,4).toUpperCase()}</td><td>{c.cutType}</td><td>{new Date(c.endedAt).toLocaleString('es-MX')}</td><td>{c.cashierEmail}</td><td>{c.totalOrders}</td><td>{money(c.grossTotal)}</td><td><button onClick={()=>setTicketCut(c)}>Ver ticket</button></td></tr>)}</tbody></table> : <table className='w-full text-sm'><thead><tr className='text-left text-rack-cream/70'><th>Folio</th><th>Fecha/hora</th><th>Mesa</th><th>Estado</th><th>Mesa</th><th>Productos</th><th>Total</th><th>Método</th><th>Acciones</th></tr></thead><tbody>{filteredOrders.map((o)=><tr key={o.id} className='border-t border-rack-gold/10'><td>#{o.id.slice(0,6)}</td><td>{new Date(o.createdAt).toLocaleString('es-MX')}</td><td>{o.tableName}</td><td>{o.status}</td><td>{money(o.tableTotal)}</td><td>{money(o.productsTotal)}</td><td>{money(o.total)}</td><td>{o.paymentMethod ?? 'other'}</td><td>Ver detalle</td></tr>)}</tbody></table>}
    </div>

    {previewCut && <div className='fixed inset-0 z-50 bg-black/70 p-4'><div className='mx-auto max-w-2xl rounded-2xl border border-rack-gold/20 bg-rack-panel p-4'><h3 className='text-lg font-semibold'>Vista previa de corte</h3><p>{previewCut.cutType}</p><p>Ventas: {previewCut.totalOrders}</p><p>Total: {money(previewCut.grossTotal)}</p><div className='mt-3 flex justify-end gap-2'><button className='rounded border px-3 py-1' onClick={()=>setPreviewCut(null)}>Cancelar</button><button className='rounded border px-3 py-1' onClick={confirmCut}>Confirmar corte</button></div></div></div>}
    <SalesCutTicketModal open={Boolean(ticketCut)} onClose={() => setTicketCut(null)} businessName={businessName} data={ticketCut} />
  </div>;
}
