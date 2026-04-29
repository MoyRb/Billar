import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { PoolTable, PoolTableStatus } from '@/lib/types';

export function AppShell({ children, sidebar, header }: { children: React.ReactNode; sidebar: React.ReactNode; header: React.ReactNode }) {
  return <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">{sidebar}<main className="flex flex-col">{header}<div className="p-6">{children}</div></main></div>;
}

export function PageHeader({ title, description }: { title: string; description?: string }) { return <div className="mb-6"><h1 className="text-2xl font-bold">{title}</h1>{description && <p className="text-slate-500">{description}</p>}</div>; }

export function StatCard({ title, value }: { title: string; value: string | number }) { return <div className="rounded-xl border bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">{title}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>; }

const statusMap: Record<PoolTableStatus, string> = { available: 'bg-emerald-100 text-emerald-700', occupied: 'bg-blue-100 text-blue-700', paused: 'bg-yellow-100 text-yellow-700', pending_payment: 'bg-orange-100 text-orange-700', maintenance: 'bg-slate-200 text-slate-700', reserved: 'bg-purple-100 text-purple-700' };
export function StatusBadge({ status }: { status: PoolTableStatus }) { return <span className={cn('rounded-full px-2 py-1 text-xs font-medium', statusMap[status])}>{status}</span>; }

export function TableCard({ table }: { table: PoolTable }) { const action = table.status === 'available' ? 'Iniciar' : table.status === 'pending_payment' ? 'Cobrar' : 'Gestionar'; return <div className="rounded-xl border bg-white p-4"><div className="flex items-center justify-between"><h3 className="font-semibold">{table.name}</h3><StatusBadge status={table.status} /></div><p className="mt-2 text-sm text-slate-500">Tipo: {table.table_type}</p><p className="text-sm text-slate-500">Tarifa: ${table.hourly_rate}/h</p><button className="mt-4 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white">{action}</button></div>; }

export function EmptyState({ title, description }: { title: string; description: string }) { return <div className="rounded-xl border border-dashed bg-white p-8 text-center"><h3 className="font-semibold">{title}</h3><p className="text-slate-500">{description}</p></div>; }

export function Sidebar({ businessName }: { businessName: string }) { const items = ['dashboard','mesas','ventas','productos','inventario','caja','clientes','reservaciones','reportes','configuracion']; return <aside className="border-r bg-white p-4"><p className="mb-6 text-lg font-bold">{businessName}</p><nav className="space-y-1">{items.map((i)=><Link key={i} href={`/${i}`} className="block rounded-lg px-3 py-2 capitalize hover:bg-slate-100">{i}</Link>)}</nav></aside>; }

export function Header({ userEmail }: { userEmail: string }) { return <header className="border-b bg-white px-6 py-4"><div className="flex justify-end text-sm text-slate-600">{userEmail}</div></header>; }
