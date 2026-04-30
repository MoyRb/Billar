import { redirect } from 'next/navigation';
import { InventarioClient } from '@/components/inventario-client';
import { createClient } from '@/lib/supabase/server';

export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: member } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!member) {
    return null;
  }

  const { data } = await supabase
    .from('business_assets')
    .select('*')
    .eq('organization_id', member.organization_id)
    .order('name');

  return <InventarioClient organizationId={member.organization_id} initialAssets={data ?? []} />;
}
