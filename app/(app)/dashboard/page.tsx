import { redirect } from 'next/navigation';
import { MetricCard, PageHeader } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: membership } = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).maybeSingle();
  if (!membership) return null;
  const orgId = membership.organization_id;
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: tables }, { data: lowProducts }, { data: paidOrders }] = await Promise.all([
    supabase.from('pool_tables').select('status').eq('organization_id', orgId),
    supabase.from('products').select('id,stock,min_stock').eq('organization_id', orgId),
    supabase.from('orders').select('total').eq('organization_id', orgId).eq('status', 'paid').gte('created_at', `${today}T00:00:00Z`),
  ]);
  const occupied = (tables ?? []).filter((t) => t.status === 'occupied').length;
  const available = (tables ?? []).filter((t) => t.status === 'available').length;
  const low = (lowProducts ?? []).filter((p) => Number(p.stock) <= Number(p.min_stock)).length;
  const sales = (paidOrders ?? []).reduce((sum, o) => sum + Number(o.total), 0);
  const stats: [string, string | number, string][] = [
    ['Mesas disponibles', available, '🎱'], ['Mesas ocupadas', occupied, '🟦'], ['Ventas del día', `$${sales.toFixed(2)}`, '💵'], ['Caja actual', '$0', '🧾'], ['Productos bajos', low, '📦'],
  ];
  return <div className='space-y-6'><PageHeader title='Dashboard' description='Resumen general de operación y desempeño del salón.' /><section className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>{stats.map(([title, value, icon]) => <MetricCard key={title} title={title} value={value} icon={icon} />)}</section></div>;
}
