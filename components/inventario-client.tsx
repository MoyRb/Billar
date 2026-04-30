'use client';
import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PageHeader } from '@/components/ui';

type Asset = { id: string; name: string; asset_type: string; quantity: number; status: string; location: string | null };
export function InventarioClient({ organizationId, initialAssets }: { organizationId: string; initialAssets: Asset[] }) {
  const supabase = useMemo(() => createClient(), []); const [assets, setAssets] = useState(initialAssets); const [name, setName] = useState('');
  const refresh = async () => { const { data } = await supabase.from('business_assets').select('id,name,asset_type,quantity,status,location').eq('organization_id', organizationId).order('name'); setAssets((data ?? []) as Asset[]); };
  const add = async () => { await supabase.from('business_assets').insert({ organization_id: organizationId, name, asset_type: 'other' }); setName(''); await refresh(); };
  return <div className='space-y-4'><PageHeader title='Inventario' description='Activos físicos internos del negocio.' /><div className='flex gap-2'><input className='rounded bg-rack-shell/70 p-2' value={name} onChange={e=>setName(e.target.value)} placeholder='Nombre activo' /><button className='rounded border px-3' onClick={add}>Agregar</button></div>{assets.map(a=><div key={a.id} className='rounded border p-3'>{a.name} · {a.asset_type} · {a.quantity} · {a.status}</div>)}</div>;
}
