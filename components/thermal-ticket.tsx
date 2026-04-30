'use client';

import type { OrderItem, PoolTable, TableOrder, TableSession } from '@/lib/types';
import { calculateChargeableSeconds, calculateChargedMinutes, calculateProductsTotal, calculateTableTotal, formatCurrency, formatDuration } from '@/lib/table-session-utils';

type ThermalTicketProps = {
  businessName?: string | null;
  userEmail?: string | null;
  table: PoolTable;
  session: TableSession;
  order: TableOrder | null;
  orderItems: OrderItem[];
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('es-MX', { hour12: false });
};

const formatTime = (value?: string | null) => {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('es-MX', { hour12: false, hour: '2-digit', minute: '2-digit' });
};

const shortFolio = (orderId?: string) => (orderId ? `RH-${orderId.slice(0, 4).toUpperCase()}` : '—');

export function ThermalTicket({ businessName, userEmail, table, session, order, orderItems }: ThermalTicketProps) {
  const activeItems = orderItems.filter((item) => item.status === 'active');
  const sessionEnd = session.ended_at ?? new Date().toISOString();
  const chargeableSeconds = calculateChargeableSeconds(session, new Date(sessionEnd));
  const chargedMinutes = session.charged_minutes ?? calculateChargedMinutes(chargeableSeconds);
  const productsTotal = Number(order?.products_total ?? calculateProductsTotal(activeItems));
  const tableTotal = Number(order?.table_total ?? calculateTableTotal(chargedMinutes, session.hourly_rate));
  const discountTotal = Number(order?.discount_total ?? 0);
  const total = Number(order?.total ?? tableTotal + productsTotal - discountTotal);

  return (
    <article className="thermal-ticket mx-auto w-[48mm] rounded border border-black/20 bg-white p-2 text-[10px] leading-tight text-black shadow-none">
      <p className="text-center text-[11px] font-bold">RACKHOUSE</p>
      <p className="text-center">{businessName?.trim() || 'Billar'}</p>
      <p className="mt-1 text-center">Ticket de consumo</p>
      <p className="my-1">------------------------</p>

      <p>Folio: {shortFolio(order?.id)}</p>
      <p>Mesa: {table.name || '—'}</p>
      <p>Fecha: {formatDateTime(order ? session.ended_at ?? new Date().toISOString() : null)}</p>
      <p>Cajero: {userEmail || '—'}</p>
      <p>Método: {order?.status === 'paid' ? 'Efectivo' : '—'}</p>
      <p>Estado: {order?.status ?? session.status ?? '—'}</p>

      <p className="my-1">------------------------</p>
      <p className="font-bold">TIEMPO</p>
      <p>Inicio: {formatTime(session.started_at)}</p>
      <p>Fin: {session.ended_at ? formatTime(session.ended_at) : 'En curso'}</p>
      <p>Tiempo: {formatDuration(chargeableSeconds)}</p>
      <p>Tarifa: {formatCurrency(session.hourly_rate)}/h</p>
      <p>Mesa: {formatCurrency(tableTotal)}</p>

      <p className="my-1">------------------------</p>
      <p className="font-bold">PRODUCTOS</p>
      {activeItems.length === 0 ? (
        <p>Sin productos</p>
      ) : (
        activeItems.map((item) => (
          <div key={item.id} className="mb-1">
            <p>{item.quantity} x {item.product_name}</p>
            <p className="pl-2">{formatCurrency(item.unit_price)} {"  "} {formatCurrency(item.line_total)}</p>
          </div>
        ))
      )}

      <p className="my-1">------------------------</p>
      <p>Productos: {formatCurrency(productsTotal)}</p>
      <p>Mesa: {formatCurrency(tableTotal)}</p>
      {discountTotal > 0 && <p>Descuento: -{formatCurrency(discountTotal)}</p>}
      <p className="font-bold">TOTAL: {formatCurrency(total)}</p>
      <p className="my-1">------------------------</p>
      <p className="text-center">Gracias por su visita</p>
      <p className="text-center">RackHouse</p>
    </article>
  );
}

type TicketModalProps = {
  isOpen: boolean;
  onClose: () => void;
  businessName?: string | null;
  userEmail?: string | null;
  table: PoolTable | null;
  session: TableSession | null;
  order: TableOrder | null;
};

export function TicketModal({ isOpen, onClose, businessName, userEmail, table, session, order }: TicketModalProps) {
  if (!isOpen) return null;

  const items = order?.order_items ?? [];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 p-4">
      <div className="mx-auto max-w-sm rounded-2xl border border-rack-gold/20 bg-rack-panel p-4">
        <div className="mb-3 flex items-center justify-between no-print">
          <h3 className="text-lg font-semibold">Ticket</h3>
          <button className="rounded border border-rack-gold/40 px-3 py-1" onClick={onClose}>Cerrar</button>
        </div>
        {!table || !session ? (
          <p className="text-sm">No hay cuenta asociada a esta mesa.</p>
        ) : (
          <>
            <ThermalTicket businessName={businessName} userEmail={userEmail} table={table} session={session} order={order} orderItems={items} />
            <div className="mt-3 flex justify-end gap-2 no-print">
              <button className="rounded border border-rack-gold/40 px-3 py-1" onClick={() => window.print()}>Imprimir</button>
              <button className="rounded border border-rack-gold/40 px-3 py-1" onClick={onClose}>Cerrar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
