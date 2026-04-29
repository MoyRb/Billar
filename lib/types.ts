export type PoolTableStatus = 'available' | 'occupied' | 'paused' | 'pending_payment' | 'maintenance' | 'reserved';

export interface PoolTable {
  id: string;
  name: string;
  status: PoolTableStatus;
  table_type: string;
  hourly_rate: number;
}
