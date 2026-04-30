import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';
import { SettingsForm } from '@/components/settings-form';

export default async function Configuracion() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: membership } = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).maybeSingle();
  if (!membership) redirect('/dashboard');

  const { data: settings } = await supabase.from('settings').select('business_name,logo_url,default_hourly_rate,currency').eq('organization_id', membership.organization_id).maybeSingle();

  return <div className="space-y-6">
    <PageHeader title="Configuración" description="Parámetros base del negocio" />
    <SettingsForm initial={{
      organizationId: membership.organization_id,
      businessName: settings?.business_name ?? '',
      logoUrl: settings?.logo_url ?? '',
      defaultHourlyRate: Number(settings?.default_hourly_rate ?? 0),
      currency: settings?.currency ?? 'MXN',
    }} />
  </div>;
}
