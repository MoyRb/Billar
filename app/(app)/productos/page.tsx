import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ProductosClient } from '@/components/productos-client';

export default async function ProductosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: membership } = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).maybeSingle();
  if (!membership) return null;
  const orgId = membership.organization_id;
  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase.from('products').select('*').eq('organization_id', orgId).order('name'),
    supabase.from('product_categories').select('*').eq('organization_id', orgId).order('name'),
  ]);
  return <ProductosClient organizationId={orgId} initialProducts={products ?? []} categories={categories ?? []} />;
}
