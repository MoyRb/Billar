import { MetricCard, PageHeader } from '@/components/ui';

const stats = [
  ['Mesas disponibles', 0, '🎱'],
  ['Mesas ocupadas', 0, '🟦'],
  ['Ventas del día', '$0', '💵'],
  ['Caja actual', '$0', '🧾'],
  ['Productos bajos', 0, '📦'],
  ['Reservaciones de hoy', 0, '📅'],
] as const;

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Resumen general de operación y desempeño del salón." />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {stats.map(([title, value, icon]) => <MetricCard key={title} title={title} value={value} icon={icon} />)}
      </section>
      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-rack-gold/10 bg-rack-panel p-5 shadow-rack">
          <h2 className="text-lg font-semibold text-rack-cream">Pulso del turno</h2>
          <p className="mt-1 text-sm text-rack-cream/70">Aquí podrás ver tendencias de mesas, ventas y caja en tiempo real.</p>
        </div>
        <div className="rounded-2xl border border-rack-gold/10 bg-rack-panel p-5 shadow-rack">
          <h2 className="text-lg font-semibold text-rack-cream">Atajos rápidos</h2>
          <p className="mt-1 text-sm text-rack-cream/70">Accede a apertura de mesa, cobro y reservaciones desde este panel.</p>
        </div>
      </section>
    </div>
  );
}
