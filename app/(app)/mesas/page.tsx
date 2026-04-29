import { EmptyState, PageHeader, TableCard } from '@/components/ui';
import type { PoolTable } from '@/lib/types';

const tables: PoolTable[] = [];

export default function Mesas(){ return <div><PageHeader title="Mesas" description="Control operativo de mesas" />{tables.length===0 ? <EmptyState title="No hay mesas registradas" description="Crea mesas desde configuración para comenzar." /> : <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{tables.map((table)=><TableCard key={table.id} table={table} />)}</section>}</div>; }
