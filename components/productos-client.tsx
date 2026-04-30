'use client';
import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PageHeader } from '@/components/ui';

type Product = { id: string; name: string; sale_price: number; stock: number; is_active: boolean };
type Category = { id: string; name: string };

type ProductForm = { name: string; sale_price: number; cost_price: number; stock: number; min_stock: number; sku: string; barcode: string; unit: string; category_id: string; is_active: boolean };

export function ProductosClient({ organizationId, initialProducts, categories }: { organizationId: string; initialProducts: Product[]; categories: Category[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [form, setForm] = useState<ProductForm>({ name: '', sale_price: 0, cost_price: 0, stock: 0, min_stock: 0, sku: '', barcode: '', unit: 'pieza', category_id: '', is_active: true });
  const refresh = async () => { const { data } = await supabase.from('products').select('id,name,sale_price,stock,is_active').eq('organization_id', organizationId).order('name'); setProducts((data ?? []) as Product[]); };
  const save = async () => { await supabase.from('products').insert({ ...form, organization_id: organizationId, category_id: form.category_id || null, description: null }); await refresh(); };
  return <div className='space-y-4'><PageHeader title='Productos' description='Productos vendibles y stock.' />
    <div className='grid gap-2 md:grid-cols-4'>
      <input className='rounded bg-rack-shell/70 p-2' placeholder='nombre' value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
      <input className='rounded bg-rack-shell/70 p-2' placeholder='sku' value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} />
      <input className='rounded bg-rack-shell/70 p-2' placeholder='barcode' value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} />
      <input className='rounded bg-rack-shell/70 p-2' placeholder='unidad' value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} />
      <input type='number' className='rounded bg-rack-shell/70 p-2' placeholder='precio venta' value={form.sale_price} onChange={e => setForm({ ...form, sale_price: Number(e.target.value) })} />
      <input type='number' className='rounded bg-rack-shell/70 p-2' placeholder='costo' value={form.cost_price} onChange={e => setForm({ ...form, cost_price: Number(e.target.value) })} />
      <input type='number' className='rounded bg-rack-shell/70 p-2' placeholder='stock' value={form.stock} onChange={e => setForm({ ...form, stock: Number(e.target.value) })} />
      <select className='rounded bg-rack-shell/70 p-2' value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}><option value=''>Sin categoría</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <button className='rounded border px-3' onClick={save}>Guardar</button>
    </div>
    <div className='space-y-2'>{products.map((p) => <div key={p.id} className='rounded border border-rack-gold/20 p-3 flex justify-between'><div>{p.name} · ${p.sale_price} · stock {p.stock}</div><span>{p.is_active ? 'Activo' : 'Inactivo'}</span></div>)}</div>
  </div>;
}
