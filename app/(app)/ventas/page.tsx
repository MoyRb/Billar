import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui';

type OrderRow = { id: string; status: string; table_total: number; products_total: number; total: number; payment_method: string | null; created_at: string; pool_tables: { name: string } | null };

export default async function Page(){
 const s=await createClient(); const {data:{user}}=await s.auth.getUser(); if(!user) redirect('/login');
 const {data:m}=await s.from('organization_members').select('organization_id').eq('user_id',user.id).maybeSingle(); if(!m) return null;
 const {data}=await s.from('orders').select('id,status,table_total,products_total,total,payment_method,created_at,pool_tables(name)').eq('organization_id',m.organization_id).order('created_at',{ascending:false});
 const orders=(data??[]) as OrderRow[];
 return <div className='space-y-4'><PageHeader title='Ventas' description='Historial de cuentas/ventas.' />{orders.map((o)=><div key={o.id} className='rounded border p-3'>#{o.id.slice(0,8)} · {o.pool_tables?.name ?? 'Sin mesa'} · {o.status} · Mesa ${o.table_total} · Prod ${o.products_total} · Total ${o.total}</div>)}</div>;
}
