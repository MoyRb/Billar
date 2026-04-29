import { AppShell, Header, Sidebar } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userEmail = user?.email ?? 'Usuario';
  return <AppShell sidebar={<Sidebar businessName="Mi Billar" />} header={<Header userEmail={userEmail} />}>{children}</AppShell>;
}
