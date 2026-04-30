export type TableStatus = 'available' | 'occupied' | 'paused' | 'pending_payment' | 'maintenance' | 'reserved' | 'out_of_service';
export type SessionStatus = 'active' | 'paused' | 'pending_payment' | 'paid' | 'cancelled';

export interface PoolTable {
  id: string;
  organization_id: string;
  name: string;
  status: TableStatus;
  table_type: string;
  hourly_rate: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TableSession {
  id: string;
  organization_id: string;
  pool_table_id: string;
  opened_by: string | null;
  closed_by: string | null;
  status: SessionStatus;
  started_at: string;
  ended_at: string | null;
  paused_at: string | null;
  total_paused_seconds: number;
  charged_minutes: number | null;
  hourly_rate: number;
  table_total: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TableWithCurrentSession extends PoolTable {
  currentSession: TableSession | null;
  currentOrder: TableOrder | null;
}

export interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  status: 'active' | 'cancelled';
}

export interface TableOrder {
  id: string;
  status: string;
  table_total: number;
  products_total: number;
  discount_total: number;
  total: number;
  order_items: OrderItem[];
}
