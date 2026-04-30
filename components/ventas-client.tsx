'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SalesCutTicketModal } from '@/components/sales-cut-thermal-ticket';

type OrderStatus = 'open' | 'pending_payment' | 'paid' | 'cancelled';

type OrderView = {
  id: string;
  status: OrderStatus;
  tableTotal: number;
  productsTotal: number;
  discountTotal: number;
  total: number;
  paymentMethod: string | null;
  createdAt: string;
  closedAt: string | null;
  paidAt: string | null;
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
const startsToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const getOrderPaidDate = (order: OrderView) => new Date(order.paidAt ?? order.closedAt ?? order.createdAt);

export default function VentasClient({ initialOrders, initialCuts, businessName, userEmail, organizationId }: { initialOrders: OrderView[]; initialCuts: SalesCutView[]; businessName?: string | null; userEmail: string; organizationId: string; }) {
  const router = useRouter();
  const [orders] = useState(initialOrders);
  const [cuts, setCuts] = useState(initialCuts);
  const [previewCut, setPreviewCut] = useState<SalesCutView | null>(null);
  const [ticketCut, setTicketCut] = useState<SalesCutView | null>(null);

  const cutsSorted = useMemo(() => [...cuts].sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime()), [cuts]);

  const pendingShiftOrders = useMemo(() => {
    const now = new Date();
    const startToday = startsToday();
    const todayShiftCuts = cuts
      .filter((cut) => cut.cutType === 'shift' && cut.status === 'closed' && new Date(cut.endedAt) >= startToday && new Date(cut.endedAt) <= now)
      .sort((a, b) => new Date(a.endedAt).getTime() - new Date(b.endedAt).getTime());
    const lastShiftCut = todayShiftCuts.at(-1);
    const rangeStart = lastShiftCut ? new Date(lastShiftCut.endedAt) : startToday;

    const shiftOrderIds = new Set(
      cuts
        .filter((cut) => cut.cutType === 'shift' && cut.status === 'closed')
        .flatMap((cut) => cut.orders.map((order) => order.id)),
    );

    const paidOrders = orders.filter((order) => order.status === 'paid');
    const pending = paidOrders.filter((order) => {
      const paidDate = getOrderPaidDate(order);
      if (paidDate < rangeStart || paidDate > now) return false;
      return !shiftOrderIds.has(order.id);
    });

    console.debug('[ventas/debug] pending shift orders', {
      organizationId,
      lastShiftCut: lastShiftCut?.id ?? null,
      rangeStart: rangeStart.toISOString(),
      rangeEnd: now.toISOString(),
      paidOrdersFound: paidOrders.length,
      pendingOrdersFound: pending.length,
      excludedBySalesCutOrders: paidOrders.length - pending.length
    });

    return { pending, rangeStart, rangeEnd: now };
  }, [cuts, orders, organizationId]);


  const computeCutPreview = (cutType: 'shift' | 'day') => {
    const now = new Date();
    const startToday = startsToday();
    const rangeStart = cutType === 'shift' ? pendingShiftOrders.rangeStart : startToday;

    const selected = (cutType === 'shift' ? pendingShiftOrders.pending : orders.filter((order) => order.status === 'paid')).filter((order) => {
      const paidDate = getOrderPaidDate(order);
      return paidDate >= rangeStart && paidDate <= now;
    });

    if (selected.length === 0) {
      setPreviewCut(null);
      alert('No hay ventas pagadas pendientes de corte.');
      return;
    }

    const totalBy = (method: string) => selected.filter((o) => (o.paymentMethod ?? 'other') === method).reduce((acc, o) => acc + o.total, 0);
    setPreviewCut({
      id: crypto.randomUUID(),
      cutType,
      status: 'closed',
      startedAt: rangeStart.toISOString(),
      endedAt: now.toISOString(),
      totalOrders: selected.length,
      grossTotal: selected.reduce((acc, o) => acc + o.total, 0),
      tableTotal: selected.reduce((acc, o) => acc + o.tableTotal, 0),
      productsTotal: selected.reduce((acc, o) => acc + o.productsTotal, 0),
      discountTotal: selected.reduce((acc, o) => acc + o.discountTotal, 0),
      cashTotal: totalBy('cash'),
      cardTotal: totalBy('card'),
      transferTotal: totalBy('transfer'),
      otherTotal: selected.reduce((acc, o) => acc + o.total, 0) - totalBy('cash') - totalBy('card') - totalBy('transfer'),
      cashierEmail: userEmail,
      orders: selected.map((o) => ({ id: o.id, tableName: o.tableName, total: o.total })),
    });
  };

  const confirmCut = async () => {
    if (!previewCut) return;
    const response = await fetch('/api/sales-cuts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(previewCut),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      alert(errorBody?.error ?? 'No se pudo guardar el corte.');
      return;
    }
    const saved = (await response.json()) as SalesCutView;
    setCuts((prev) => [saved, ...prev]);
    setTicketCut(saved);
    setPreviewCut(null);
    router.refresh();
  };

  return (
    <div className='space-y-4'>
      <section className='rounded-2xl border border-rack-gold/10 bg-rack-panel p-4'>
        <div className='mb-4 flex flex-wrap gap-2'>
          <button className='rounded border border-rack-gold/40 px-3 py-2' onClick={() => computeCutPreview('shift')}>Hacer corte turno</button>
          <button className='rounded border border-rack-gold/40 px-3 py-2' onClick={() => computeCutPreview('day')}>Hacer corte día</button>
        </div>

        <h3 className='mb-2 text-sm font-semibold uppercase tracking-wide text-rack-cream/80'>Ventas pagadas pendientes de corte</h3>
        {pendingShiftOrders.pending.length === 0 ? (
          <p className='mb-4 text-sm text-rack-cream/70'>No hay ventas pagadas pendientes de corte.</p>
        ) : (
          <div className='mb-4 overflow-x-auto'>
            <table className='w-full min-w-[820px] text-sm'>
              <thead><tr className='text-left text-rack-cream/70'><th className='pb-2'>Folio</th><th className='pb-2'>Mesa</th><th className='pb-2'>Hora pago</th><th className='pb-2'>Total mesa</th><th className='pb-2'>Total productos</th><th className='pb-2'>Total</th><th className='pb-2'>Método</th></tr></thead>
              <tbody>
                {pendingShiftOrders.pending.map((order) => (
                  <tr key={order.id} className='border-t border-rack-gold/10'>
                    <td className='py-2'>#{order.id.slice(0, 6).toUpperCase()}</td>
                    <td className='py-2'>{order.tableName}</td>
                    <td className='py-2'>{getOrderPaidDate(order).toLocaleString('es-MX')}</td>
                    <td className='py-2'>{money(order.tableTotal)}</td>
                    <td className='py-2'>{money(order.productsTotal)}</td>
                    <td className='py-2'>{money(order.total)}</td>
                    <td className='py-2'>{order.paymentMethod ?? 'other'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h3 className='mb-2 text-sm font-semibold uppercase tracking-wide text-rack-cream/80'>Historial de cortes</h3>
        <div className='overflow-x-auto'>
          <table className='w-full min-w-[820px] text-sm'>
            <thead>
              <tr className='text-left text-rack-cream/70'>
                <th className='pb-2'>Folio</th>
                <th className='pb-2'>Tipo</th>
                <th className='pb-2'>Inicio</th>
                <th className='pb-2'>Fin</th>
                <th className='pb-2'>Usuario</th>
                <th className='pb-2'>Ventas</th>
                <th className='pb-2'>Total</th>
                <th className='pb-2'>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cutsSorted.map((cut) => (
                <tr key={cut.id} className='border-t border-rack-gold/10'>
                  <td className='py-2'>CUT-{cut.id.slice(0, 4).toUpperCase()}</td>
                  <td className='py-2'>{cut.cutType === 'shift' ? 'Turno' : 'Día'}</td>
                  <td className='py-2'>{new Date(cut.startedAt).toLocaleString('es-MX')}</td>
                  <td className='py-2'>{new Date(cut.endedAt).toLocaleString('es-MX')}</td>
                  <td className='py-2'>{cut.cashierEmail}</td>
                  <td className='py-2'>{cut.totalOrders}</td>
                  <td className='py-2'>{money(cut.grossTotal)}</td>
                  <td className='py-2'>
                    <div className='flex gap-3'>
                      <button className='underline' onClick={() => setTicketCut(cut)}>Ver ticket</button>
                      <button className='underline' onClick={() => { setTicketCut(cut); setTimeout(() => window.print(), 100); }}>Imprimir ticket</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {previewCut && (
        <div className='fixed inset-0 z-50 bg-black/70 p-4'>
          <div className='mx-auto max-w-2xl rounded-2xl border border-rack-gold/20 bg-rack-panel p-4'>
            <h3 className='text-lg font-semibold'>Vista previa de corte</h3>
            <p>Tipo: {previewCut.cutType === 'shift' ? 'Corte de turno' : 'Corte del día'}</p>
            <p>Rango: {new Date(previewCut.startedAt).toLocaleString('es-MX')} - {new Date(previewCut.endedAt).toLocaleString('es-MX')}</p>
            <p>Ventas: {previewCut.totalOrders}</p>
            <p>Total mesas: {money(previewCut.tableTotal)}</p>
            <p>Total productos: {money(previewCut.productsTotal)}</p>
            <p>Total vendido: {money(previewCut.grossTotal)}</p>
            <p>Pagos: Efectivo {money(previewCut.cashTotal)} · Tarjeta {money(previewCut.cardTotal)} · Transferencia {money(previewCut.transferTotal)} · Otros {money(previewCut.otherTotal)}</p>
            <div className='mt-3 max-h-48 overflow-y-auto rounded border border-rack-gold/20 p-2 text-xs'>
              {previewCut.orders.map((order) => <p key={order.id}>#{order.id.slice(0, 6)} {order.tableName} {money(order.total)}</p>)}
            </div>
            <div className='mt-3 flex justify-end gap-2'>
              <button className='rounded border px-3 py-1' onClick={() => setPreviewCut(null)}>Cancelar</button>
              <button className='rounded border px-3 py-1' onClick={confirmCut}>Confirmar corte</button>
            </div>
          </div>
        </div>
      )}

      <SalesCutTicketModal open={Boolean(ticketCut)} onClose={() => setTicketCut(null)} businessName={businessName} data={ticketCut} />
    </div>
  );
}
