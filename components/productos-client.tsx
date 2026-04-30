'use client';
import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PageHeader } from '@/components/ui';

type Product = { id: string; name: string; sale_price: number; stock: number; is_active: boolean };
type Category = { id: string; name: string };

type ProductForm = {
  name: string;
  sale_price: string;
  cost_price: string;
  stock: string;
  min_stock: string;
  sku: string;
  barcode: string;
  unit: string;
  category_id: string;
  description: string;
  is_active: boolean;
};

const initialForm: ProductForm = {
  name: '',
  sale_price: '',
  cost_price: '',
  stock: '',
  min_stock: '',
  sku: '',
  barcode: '',
  unit: 'pieza',
  category_id: '',
  description: '',
  is_active: true
};

export function ProductosClient({ organizationId, initialProducts, categories }: { organizationId: string; initialProducts: Product[]; categories: Category[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [form, setForm] = useState<ProductForm>(initialForm);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const refresh = async () => {
    const { data } = await supabase.from('products').select('id,name,sale_price,stock,is_active').eq('organization_id', organizationId).order('name');
    setProducts((data ?? []) as Product[]);
  };

  const fieldClass = 'w-full rounded-md border border-rack-gold/20 bg-rack-shell/70 p-2.5 text-sm outline-none transition focus:border-rack-gold/60 focus:ring-1 focus:ring-rack-gold/50';
  const labelClass = 'text-sm font-medium text-rack-cream';

  const save = async () => {
    setError('');
    setSuccess('');

    if (!form.name.trim()) {
      setError('El nombre del producto es obligatorio.');
      return;
    }
    if (!form.sale_price.trim()) {
      setError('El precio de venta es obligatorio.');
      return;
    }
    if (!form.stock.trim()) {
      setError('El stock actual es obligatorio.');
      return;
    }

    setIsSaving(true);
    const { error: insertError } = await supabase.from('products').insert({
      name: form.name.trim(),
      sale_price: Number(form.sale_price),
      cost_price: Number(form.cost_price || 0),
      stock: Number(form.stock),
      min_stock: Number(form.min_stock || 0),
      sku: form.sku.trim(),
      barcode: form.barcode.trim(),
      unit: form.unit.trim(),
      category_id: form.category_id || null,
      description: form.description.trim() || null,
      is_active: form.is_active,
      organization_id: organizationId
    });

    if (insertError) {
      setError('No se pudo guardar el producto. Intenta nuevamente.');
      setIsSaving(false);
      return;
    }

    await refresh();
    setForm(initialForm);
    setSuccess('Producto guardado correctamente.');
    setIsSaving(false);
  };

  return <div className='space-y-4'><PageHeader title='Productos' description='Productos vendibles y stock.' />
    <div className='rounded-xl border border-rack-gold/20 bg-rack-shell/30 p-4 md:p-5'>
      <div className='grid gap-4'>
        <section className='space-y-3'>
          <h3 className='text-sm font-semibold uppercase tracking-wide text-rack-gold'>Información básica</h3>
          <div className='grid gap-3 md:grid-cols-2'>
            <label className='space-y-1'>
              <span className={labelClass}>Nombre del producto</span>
              <input className={fieldClass} placeholder='Coca-Cola 600ml' value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className='space-y-1'>
              <span className={labelClass}>Categoría</span>
              <select className={fieldClass} value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
                <option value=''>Selecciona una categoría</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className='space-y-1'>
              <span className={labelClass}>Unidad</span>
              <input className={fieldClass} placeholder='pieza' value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} />
            </label>
            <label className='space-y-1 md:col-span-2'>
              <span className={labelClass}>Descripción (opcional)</span>
              <textarea className={fieldClass} placeholder='Detalle breve para identificar el producto.' value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} />
            </label>
          </div>
        </section>

        <section className='space-y-3'>
          <h3 className='text-sm font-semibold uppercase tracking-wide text-rack-gold'>Precios</h3>
          <div className='grid gap-3 md:grid-cols-2'>
            <label className='space-y-1'>
              <span className={labelClass}>Precio de venta ($)</span>
              <input type='number' min='0' step='0.01' className={fieldClass} placeholder='25.00' value={form.sale_price} onChange={e => setForm({ ...form, sale_price: e.target.value })} />
            </label>
            <label className='space-y-1'>
              <span className={labelClass}>Costo unitario ($)</span>
              <input type='number' min='0' step='0.01' className={fieldClass} placeholder='15.00' value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value })} />
            </label>
          </div>
        </section>

        <section className='space-y-3'>
          <h3 className='text-sm font-semibold uppercase tracking-wide text-rack-gold'>Stock</h3>
          <div className='grid gap-3 md:grid-cols-2'>
            <label className='space-y-1'>
              <span className={labelClass}>Stock actual</span>
              <input type='number' min='0' step='1' className={fieldClass} placeholder='24' value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} />
            </label>
            <label className='space-y-1'>
              <span className={labelClass}>Stock mínimo</span>
              <input type='number' min='0' step='1' className={fieldClass} placeholder='6' value={form.min_stock} onChange={e => setForm({ ...form, min_stock: e.target.value })} />
              <p className='text-xs text-rack-muted'>Te ayuda a detectar cuándo necesitas reabastecer.</p>
            </label>
          </div>
        </section>

        <section className='space-y-3'>
          <h3 className='text-sm font-semibold uppercase tracking-wide text-rack-gold'>Identificación / código de barras</h3>
          <div className='grid gap-3 md:grid-cols-2'>
            <label className='space-y-1'>
              <span className={labelClass}>SKU interno</span>
              <input className={fieldClass} placeholder='COCA-600' value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} />
            </label>
            <label className='space-y-1'>
              <span className={labelClass}>Código de barras</span>
              <input className={fieldClass} placeholder='750105530...' value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} />
            </label>
          </div>
        </section>

        {error && <div className='rounded-md border border-red-400/40 bg-red-950/40 px-3 py-2 text-sm text-red-200'>{error}</div>}
        {success && <div className='rounded-md border border-emerald-400/40 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200'>{success}</div>}

        <div>
          <button className='rounded border border-rack-gold/40 px-4 py-2 font-medium hover:bg-rack-gold/10 disabled:opacity-60' onClick={save} disabled={isSaving}>
            {isSaving ? 'Guardando...' : 'Guardar producto'}
          </button>
        </div>
      </div>
    </div>

    <div className='space-y-2'>{products.map((p) => <div key={p.id} className='flex justify-between rounded border border-rack-gold/20 p-3'><div>{p.name} · ${p.sale_price} · stock {p.stock}</div><span>{p.is_active ? 'Activo' : 'Inactivo'}</span></div>)}</div>
  </div>;
}
