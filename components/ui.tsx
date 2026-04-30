import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { PoolTable, TableStatus } from '@/lib/types';

const navItems = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'mesas', label: 'Mesas' },
  { key: 'ventas', label: 'Ventas' },
  { key: 'productos', label: 'Productos' },
  { key: 'activos', label: 'Activos' },
  { key: 'configuracion', label: 'Configuración' },
] as const;

export function AppShell({ children, sidebar, header }: { children: React.ReactNode; sidebar: React.ReactNode; header: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-rack-obsidian text-rack-cream">
      <div className="pointer-events-none absolute inset-0 bg-radial-rack opacity-40" />
      <div className="pointer-events-none absolute inset-0 bg-grain" />
      <div className="relative lg:grid lg:grid-cols-[280px_1fr]">
        {sidebar}
        <main className="min-h-screen border-l border-rack-gold/10 bg-rack-shell/70 backdrop-blur-sm">
          {header}
          <div className="p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6 rounded-2xl border border-rack-gold/10 bg-rack-panel/75 p-5 shadow-rack">
      <h1 className="text-2xl font-semibold tracking-tight text-rack-cream">{title}</h1>
      {description && <p className="mt-1 text-sm text-rack-cream/70">{description}</p>}
    </div>
  );
}

export function MetricCard({ title, value, icon }: { title: string; value: string | number; icon?: string }) {
  return (
    <div className="rounded-2xl border border-rack-gold/10 bg-rack-panel p-4 shadow-rack">
      <div className="flex items-center justify-between text-rack-cream/70">
        <p className="text-sm">{title}</p>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <p className="mt-2 text-3xl font-semibold text-rack-cream">{value}</p>
    </div>
  );
}

export const StatCard = MetricCard;

const statusMap: Record<TableStatus, string> = {
  available: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200',
  occupied: 'border-cyan-400/30 bg-cyan-500/15 text-cyan-200',
  paused: 'border-amber-400/30 bg-amber-500/15 text-amber-200',
  pending_payment: 'border-orange-400/30 bg-orange-500/15 text-orange-200',
  maintenance: 'border-slate-400/30 bg-slate-500/20 text-slate-200',
  reserved: 'border-violet-400/30 bg-violet-500/15 text-violet-200',
  out_of_service: 'border-rose-400/30 bg-rose-500/15 text-rose-200',
};

const statusLabel: Record<TableStatus, string> = {
  available: 'Disponible',
  occupied: 'Ocupada',
  paused: 'Pausada',
  pending_payment: 'Pendiente de pago',
  maintenance: 'Mantenimiento',
  reserved: 'Reservada',
  out_of_service: 'Fuera de servicio',
};

export function StatusBadge({ status }: { status: TableStatus }) {
  return <span className={cn('rounded-full border px-2.5 py-1 text-xs font-medium', statusMap[status])}>{statusLabel[status]}</span>;
}

export function TableCard({ table }: { table: PoolTable }) {
  const action = table.status === 'available' ? 'Iniciar sesión' : table.status === 'pending_payment' ? 'Cobrar mesa' : 'Gestionar mesa';
  return (
    <article className="overflow-hidden rounded-2xl border border-rack-gold/10 bg-rack-panel shadow-rack transition hover:-translate-y-0.5 hover:shadow-rack-lg">
      <div className="relative p-4">
        <div className="mb-4 rounded-xl border border-rack-gold/20 bg-rack-felt px-4 py-6 shadow-inner-felt">
          <div className="pointer-events-none absolute left-6 top-[70px] h-2.5 w-2.5 rounded-full bg-rack-wood-dark" />
          <div className="pointer-events-none absolute right-6 top-[70px] h-2.5 w-2.5 rounded-full bg-rack-wood-dark" />
          <div className="pointer-events-none absolute left-6 top-[120px] h-2.5 w-2.5 rounded-full bg-rack-wood-dark" />
          <div className="pointer-events-none absolute right-6 top-[120px] h-2.5 w-2.5 rounded-full bg-rack-wood-dark" />
          <p className="text-center text-xs uppercase tracking-[0.3em] text-rack-gold/70">Mesa activa</p>
        </div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-rack-cream">{table.name}</h3>
            <p className="mt-1 text-sm text-rack-cream/65">{table.table_type}</p>
          </div>
          <StatusBadge status={table.status} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg bg-rack-shell/70 p-3"><p className="text-rack-cream/65">Tarifa</p><p className="font-medium text-rack-cream">${table.hourly_rate}/h</p></div>
          <div className="rounded-lg bg-rack-shell/70 p-3"><p className="text-rack-cream/65">Tiempo</p><p className="font-medium text-rack-cream">--:--</p></div>
          <div className="col-span-2 rounded-lg bg-rack-shell/70 p-3"><p className="text-rack-cream/65">Consumo</p><p className="font-medium text-rack-cream">$0.00 (próximo)</p></div>
        </div>
        <button className="mt-4 w-full rounded-xl border border-rack-gold/40 bg-rack-gold/15 px-3 py-2.5 text-sm font-medium text-rack-cream transition hover:bg-rack-gold/25">{action}</button>
      </div>
    </article>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="rounded-2xl border border-dashed border-rack-gold/20 bg-rack-panel/60 p-10 text-center"><h3 className="font-semibold text-rack-cream">{title}</h3><p className="mt-1 text-sm text-rack-cream/70">{description}</p></div>;
}

export function Sidebar({ businessName }: { businessName: string }) {
  return (
    <aside className="border-r border-rack-gold/10 bg-rack-shell/90 p-5 backdrop-blur-sm">
      <div className="mb-8 rounded-2xl border border-rack-gold/20 bg-rack-panel p-4 shadow-rack">
        <p className="text-2xl font-semibold text-rack-cream">RackHouse</p>
        <p className="mt-2 text-xs text-rack-cream/65">Negocio: {businessName}</p>
      </div>
      <nav className="space-y-1.5">
        {navItems.map((i) => (
          <Link key={i.key} href={`/${i.key}`} className="block rounded-xl border border-transparent px-3 py-2.5 text-sm text-rack-cream/80 transition hover:border-rack-gold/20 hover:bg-rack-panel hover:text-rack-cream">
            {i.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

export function Header({ userEmail }: { userEmail: string }) {
  return (
    <header className="border-b border-rack-gold/10 bg-rack-panel/80 px-6 py-4 backdrop-blur-sm lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-rack-gold/70">RackHouse Control Center</p>
          <p className="text-sm text-rack-cream/70">Sistema de gestión para salón de billar</p>
        </div>
        <p className="rounded-full border border-rack-gold/20 bg-rack-shell/70 px-3 py-1.5 text-sm text-rack-cream/80">{userEmail}</p>
      </div>
    </header>
  );
}
