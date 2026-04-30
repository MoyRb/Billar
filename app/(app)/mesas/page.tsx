import { EmptyState, PageHeader, TableCard } from '@/components/ui';
import type { PoolTable } from '@/lib/types';

const tables: PoolTable[] = [];

export default function Mesas() {
  return (
    <div className="space-y-6">
      <PageHeader title="Mesas" description="Vista operativa de mesas con estado y acción principal." />
      {tables.length === 0 ? (
        <EmptyState title="No hay mesas registradas" description="Crea mesas desde Configuración para comenzar a operar en RackHouse." />
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tables.map((table) => <TableCard key={table.id} table={table} />)}
        </section>
      )}
    </div>
  );
}
