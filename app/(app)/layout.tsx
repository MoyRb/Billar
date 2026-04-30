import { AppShell, Header, Sidebar } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userEmail = user?.email ?? 'Usuario';

  let businessName = 'Sin nombre de negocio';
  if (user) {
    const { data: membership } = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).maybeSingle();
    if (membership) {
      const { data: settings } = await supabase.from('settings').select('business_name').eq('organization_id', membership.organization_id).maybeSingle();
      businessName = settings?.business_name?.trim() || 'Sin nombre de negocio';
    }
  }

  return <AppShell sidebar={<Sidebar businessName={businessName} />} header={<Header userEmail={userEmail} />}>{children}</AppShell>;
}
