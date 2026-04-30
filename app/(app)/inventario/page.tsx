import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { InventarioClient } from '@/components/inventario-client';
export default async function Page(){const s=await createClient(); const {data:{user}}=await s.auth.getUser(); if(!user) redirect('/login'); const {data:m}=await s.from('organization_members').select('organization_id').eq('user_id',user.id).maybeSingle(); if(!m) return null; const {data}=await s.from('business_assets').select('*').eq('organization_id',m.organization_id).order('name'); return <InventarioClient organizationId={m.organization_id} initialAssets={data??[]} />;}
