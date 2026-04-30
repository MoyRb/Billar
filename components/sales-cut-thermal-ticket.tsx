'use client';

type CutOrderLine = {
  id: string;
  tableName: string;
  total: number;
};

type SalesCutTicketData = {
  id: string;
  cutType: 'shift' | 'day';
  startedAt: string;
  endedAt: string;
  cashierEmail: string;
  totalOrders: number;
  tableTotal: number;
  productsTotal: number;
  discountTotal: number;
  grossTotal: number;
  cashTotal: number;
  cardTotal: number;
  transferTotal: number;
  otherTotal: number;
  orders: CutOrderLine[];
};

const currency = (value: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
const date = (value: string) => new Date(value).toLocaleDateString('es-MX');
const time = (value: string) => new Date(value).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });

export function SalesCutThermalTicket({ businessName, data }: { businessName?: string | null; data: SalesCutTicketData }) {
  return (
    <article className="thermal-ticket mx-auto w-[48mm] rounded border border-black/20 bg-white p-2 font-mono text-[10px] leading-tight text-black shadow-none">
      <p className="text-center text-[11px] font-bold">RACKHOUSE</p>
      <p className="text-center">{businessName?.trim() || 'Billar'}</p>
      <p className="mt-1 text-center">{data.cutType === 'shift' ? 'CORTE DE TURNO' : 'CORTE DEL DÍA'}</p>
      <p className="my-1">------------------------</p>
      <p>Folio: CUT-{data.id.slice(0, 4).toUpperCase()}</p>
      <p>Tipo: {data.cutType === 'shift' ? 'Turno' : 'Día'}</p>
      <p>Fecha: {date(data.endedAt)}</p>
      <p>Inicio: {time(data.startedAt)}</p>
      <p>Fin: {time(data.endedAt)}</p>
      <p>Cajero: {data.cashierEmail || '—'}</p>
      <p className="my-1">------------------------</p>
      <p className="font-bold">RESUMEN</p>
      <p>Ventas: {data.totalOrders}</p>
      <p>Mesas: {currency(data.tableTotal)}</p>
      <p>Productos: {currency(data.productsTotal)}</p>
      <p>Descuentos: {currency(data.discountTotal)}</p>
      <p className="font-bold">TOTAL: {currency(data.grossTotal)}</p>
      <p className="my-1">------------------------</p>
      <p className="font-bold">PAGOS</p>
      <p>Efectivo: {currency(data.cashTotal)}</p>
      <p>Tarjeta: {currency(data.cardTotal)}</p>
      <p>Transferencia: {currency(data.transferTotal)}</p>
      <p>Otros: {currency(data.otherTotal)}</p>
      <p className="my-1">------------------------</p>
      <p className="font-bold">VENTAS</p>
      {data.orders.map((order) => (
        <p key={order.id}>#{order.id.slice(0, 6)} {order.tableName} {currency(order.total)}</p>
      ))}
      <p className="my-1">------------------------</p>
      <p className="text-center">Gracias</p>
      <p className="text-center">RackHouse</p>
    </article>
  );
}

export function SalesCutTicketModal({ open, onClose, businessName, data }: { open: boolean; onClose: () => void; businessName?: string | null; data: SalesCutTicketData | null }) {
  if (!open || !data) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/70 p-4">
      <div className="mx-auto max-w-sm rounded-2xl border border-rack-gold/20 bg-rack-panel p-4">
        <div className="mb-3 flex items-center justify-between no-print">
          <h3 className="text-lg font-semibold">Ticket de corte</h3>
          <button className="rounded border border-rack-gold/40 px-3 py-1" onClick={onClose}>Cerrar</button>
        </div>
        <SalesCutThermalTicket businessName={businessName} data={data} />
        <div className="mt-3 flex justify-end gap-2 no-print">
          <button className="rounded border border-rack-gold/40 px-3 py-1" onClick={() => window.print()}>Imprimir corte</button>
          <button className="rounded border border-rack-gold/40 px-3 py-1" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
