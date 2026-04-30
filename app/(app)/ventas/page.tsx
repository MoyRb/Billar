export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import VentasClient from '@/components/ventas-client';
import { createClient } from '@/lib/supabase/server';

export default async function Page() {
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  if (!user) redirect('/login');

  const { data: m } = await s
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!m) return null;

  const { data: org } = await s
    .from('organizations')
    .select('name')
    .eq('id', m.organization_id)
    .maybeSingle();

  return (
    <div className='space-y-4'>
      <PageHeader
        title='Ventas / Cortes'
        description='Genera cortes de turno y cortes diarios de ventas pagadas.'
      />
      <VentasClient
        initialOrders={[]}
        initialCuts={[]}
        businessName={org?.name}
        userEmail={user.email ?? '—'}
        organizationId={m.organization_id}
      />
    </div>
  );
}
