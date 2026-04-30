'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PageHeader } from '@/components/ui';

type Product = {
  id: string;
  name: string;
  sale_price: number;
  cost_price: number;
  stock: number;
  min_stock: number;
  sku: string | null;
  barcode: string | null;
  unit: string;
  description: string | null;
  is_active: boolean;
};

type ProductForm = {
  name: string;
  sale_price: string;
  cost_price: string;
  stock: string;
  min_stock: string;
  sku: string;
  barcode: string;
  unit: string;
  description: string;
  is_active: boolean;
};

type RestockForm = {
  quantity: string;
  cost_price: string;
  note: string;
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
  description: '',
  is_active: true
};

const initialRestockForm: RestockForm = { quantity: '', cost_price: '', note: '' };

export function ProductosClient({ organizationId, initialProducts }: { organizationId: string; initialProducts: Product[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [form, setForm] = useState<ProductForm>(initialForm);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [restockForm, setRestockForm] = useState<RestockForm>(initialRestockForm);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const refresh = async () => {
    const { data } = await supabase
      .from('products')
      .select('id,name,sale_price,cost_price,stock,min_stock,sku,barcode,unit,description,is_active')
      .eq('organization_id', organizationId)
      .order('name');
    setProducts((data ?? []) as Product[]);
  };

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) =>
      p.name.toLowerCase().includes(term) ||
      (p.sku ?? '').toLowerCase().includes(term) ||
      (p.barcode ?? '').toLowerCase().includes(term)
    );
  }, [products, search]);

  const fieldClass = 'w-full rounded-md border border-rack-gold/20 bg-rack-shell/70 p-2.5 text-sm outline-none transition focus:border-rack-gold/60 focus:ring-1 focus:ring-rack-gold/50';
  const labelClass = 'text-sm font-medium text-rack-cream';

  const validateProductForm = () => {
    if (!form.name.trim()) return 'El nombre del producto es obligatorio.';
    const salePrice = Number(form.sale_price);
    const costPrice = Number(form.cost_price || 0);
    const stock = Number(form.stock || 0);
    const minStock = Number(form.min_stock || 0);
    if (Number.isNaN(salePrice) || salePrice < 0) return 'El precio de venta debe ser mayor o igual a 0.';
    if (Number.isNaN(costPrice) || costPrice < 0) return 'El costo unitario debe ser mayor o igual a 0.';
    if (Number.isNaN(stock) || stock < 0) return 'El stock inicial debe ser mayor o igual a 0.';
    if (Number.isNaN(minStock) || minStock < 0) return 'El stock mínimo debe ser mayor o igual a 0.';
    return null;
  };

  const save = async () => {
    setError('');
    setSuccess('');
    const validationError = validateProductForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    const payload = {
      name: form.name.trim(),
      sale_price: Number(form.sale_price),
      cost_price: Number(form.cost_price || 0),
      min_stock: Number(form.min_stock || 0),
      sku: form.sku.trim() || null,
      barcode: form.barcode.trim() || null,
      unit: form.unit.trim(),
      description: form.description.trim() || null,
      is_active: form.is_active,
      organization_id: organizationId
    };

    const response = editingProductId
      ? await supabase.from('products').update(payload).eq('id', editingProductId).eq('organization_id', organizationId)
      : await supabase.from('products').insert({ ...payload, stock: Number(form.stock || 0) });

    if (response.error) {
      if (response.error.code === '23505') {
        setError('SKU o código de barras ya existe en esta organización.');
      } else {
        setError('No se pudo guardar el producto. Intenta nuevamente.');
      }
      setIsSaving(false);
      return;
    }

    await refresh();
    setForm(initialForm);
    setEditingProductId(null);
    setSuccess(editingProductId ? 'Producto actualizado correctamente.' : 'Producto guardado correctamente.');
    setIsSaving(false);
  };

  const onEdit = (product: Product) => {
    setError('');
    setSuccess('');
    setEditingProductId(product.id);
    setForm({
      name: product.name,
      sale_price: String(product.sale_price),
      cost_price: String(product.cost_price),
      stock: String(product.stock),
      min_stock: String(product.min_stock),
      sku: product.sku ?? '',
      barcode: product.barcode ?? '',
      unit: product.unit,
      description: product.description ?? '',
      is_active: product.is_active
    });
  };

  const toggleActive = async (product: Product) => {
    setError('');
    setSuccess('');
    const { error: updateError } = await supabase.from('products').update({ is_active: !product.is_active }).eq('id', product.id).eq('organization_id', organizationId);
    if (updateError) {
      setError('No se pudo cambiar el estado del producto.');
      return;
    }
    await refresh();
    setSuccess('Estado del producto actualizado.');
  };

  const saveRestock = async () => {
    if (!restockProduct) return;
    setError('');
    setSuccess('');
    const quantity = Number(restockForm.quantity);
    const nextCostPrice = restockForm.cost_price.trim() ? Number(restockForm.cost_price) : null;
    if (Number.isNaN(quantity) || quantity <= 0) {
      setError('La cantidad a agregar debe ser mayor a 0.');
      return;
    }
    if (nextCostPrice !== null && (Number.isNaN(nextCostPrice) || nextCostPrice < 0)) {
      setError('El costo unitario debe ser mayor o igual a 0.');
      return;
    }

    const previousStock = Number(restockProduct.stock);
    const newStock = previousStock + quantity;
    setIsSaving(true);

    const updates: { stock: number; cost_price?: number } = { stock: newStock };
    if (nextCostPrice !== null) updates.cost_price = nextCostPrice;

    const { data: userData } = await supabase.auth.getUser();

    const { error: stockError } = await supabase
      .from('products')
      .update(updates)
      .eq('id', restockProduct.id)
      .eq('organization_id', organizationId);

    if (stockError) {
      setError('No se pudo actualizar el stock.');
      setIsSaving(false);
      return;
    }

    const { error: movementError } = await supabase.from('inventory_movements').insert({
      organization_id: organizationId,
      product_id: restockProduct.id,
      quantity,
      previous_stock: previousStock,
      new_stock: newStock,
      movement_type: 'purchase',
      created_by: userData.user?.id ?? null,
      reason: restockForm.note.trim() || null
    });

    if (movementError) {
      setError('Stock actualizado, pero no se pudo registrar el movimiento de inventario.');
      setIsSaving(false);
      await refresh();
      return;
    }

    await refresh();
    setRestockProduct(null);
    setRestockForm(initialRestockForm);
    setSuccess('Stock reabastecido correctamente.');
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

        {!editingProductId && <section className='space-y-3'>
          <h3 className='text-sm font-semibold uppercase tracking-wide text-rack-gold'>Stock inicial</h3>
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
        </section>}

        {editingProductId && <section className='space-y-3'>
          <h3 className='text-sm font-semibold uppercase tracking-wide text-rack-gold'>Stock</h3>
          <div className='rounded border border-rack-gold/20 bg-rack-shell/40 p-3 text-sm text-rack-muted'>
            El stock actual se administra desde la acción <strong>Reabastecer</strong> para mantener trazabilidad.
          </div>
          <label className='space-y-1'>
            <span className={labelClass}>Stock mínimo</span>
            <input type='number' min='0' step='1' className={fieldClass} placeholder='6' value={form.min_stock} onChange={e => setForm({ ...form, min_stock: e.target.value })} />
          </label>
        </section>}

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

        <div className='flex gap-2'>
          <button className='rounded border border-rack-gold/40 px-4 py-2 font-medium hover:bg-rack-gold/10 disabled:opacity-60' onClick={save} disabled={isSaving}>
            {isSaving ? 'Guardando...' : editingProductId ? 'Guardar cambios' : 'Guardar producto'}
          </button>
          {editingProductId && <button className='rounded border border-rack-gold/25 px-4 py-2 font-medium hover:bg-rack-gold/10' onClick={() => { setEditingProductId(null); setForm(initialForm); }}>
            Cancelar edición
          </button>}
        </div>
      </div>
    </div>

    <div className='rounded-xl border border-rack-gold/20 bg-rack-shell/30 p-4 md:p-5 space-y-3'>
      <div className='flex flex-col gap-2 md:flex-row md:items-center md:justify-between'>
        <h3 className='text-sm font-semibold uppercase tracking-wide text-rack-gold'>Lista de productos</h3>
        <input className='w-full md:w-80 rounded-md border border-rack-gold/20 bg-rack-shell/70 p-2 text-sm outline-none focus:border-rack-gold/60' placeholder='Buscar por nombre, SKU o código de barras' value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className='space-y-2'>
        {filteredProducts.map((p) => <div key={p.id} className='rounded border border-rack-gold/20 p-3'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div>
              <div className='font-semibold text-rack-cream'>{p.name}</div>
              <div className='text-sm text-rack-muted'>SKU: {p.sku || '—'} · Código: {p.barcode || '—'}</div>
            </div>
            <div className='text-right text-sm'>
              <div className='text-rack-cream'>Venta: ${Number(p.sale_price).toFixed(2)}</div>
              <div className='text-rack-muted'>Estado: {p.is_active ? 'Activo' : 'Inactivo'}</div>
            </div>
          </div>
          <div className='mt-2 flex flex-wrap items-center gap-2 text-sm'>
            <span className='rounded border border-rack-gold/20 px-2 py-0.5'>Stock: {p.stock}</span>
            <span className='rounded border border-rack-gold/20 px-2 py-0.5'>Mínimo: {p.min_stock}</span>
            {p.stock <= p.min_stock && <span className='rounded border border-amber-400/50 bg-amber-900/30 px-2 py-0.5 text-amber-200'>Stock bajo</span>}
          </div>
          <div className='mt-3 flex gap-2'>
            <button className='rounded border border-rack-gold/25 px-3 py-1 text-sm hover:bg-rack-gold/10' onClick={() => onEdit(p)}>Editar</button>
            <button className='rounded border border-rack-gold/25 px-3 py-1 text-sm hover:bg-rack-gold/10' onClick={() => { setRestockProduct(p); setRestockForm(initialRestockForm); }}>Reabastecer</button>
            <button className='rounded border border-rack-gold/25 px-3 py-1 text-sm hover:bg-rack-gold/10' onClick={() => toggleActive(p)}>{p.is_active ? 'Desactivar' : 'Activar'}</button>
          </div>
        </div>)}
        {filteredProducts.length === 0 && <p className='text-sm text-rack-muted'>No hay productos que coincidan con la búsqueda.</p>}
      </div>
    </div>

    {restockProduct && <div className='fixed inset-0 z-20 flex items-center justify-center bg-black/55 p-3'>
      <div className='w-full max-w-md rounded-xl border border-rack-gold/30 bg-rack-shell p-4 space-y-3'>
        <h4 className='text-lg font-semibold text-rack-cream'>Reabastecer stock</h4>
        <p className='text-sm text-rack-muted'>{restockProduct.name}</p>
        <p className='text-sm text-rack-muted'>Stock actual: <strong>{restockProduct.stock}</strong></p>
        <label className='space-y-1 block'>
          <span className={labelClass}>Cantidad a agregar</span>
          <input type='number' min='1' step='1' className={fieldClass} value={restockForm.quantity} onChange={(e) => setRestockForm({ ...restockForm, quantity: e.target.value })} />
        </label>
        <label className='space-y-1 block'>
          <span className={labelClass}>Costo unitario (opcional)</span>
          <input type='number' min='0' step='0.01' className={fieldClass} value={restockForm.cost_price} onChange={(e) => setRestockForm({ ...restockForm, cost_price: e.target.value })} />
        </label>
        <label className='space-y-1 block'>
          <span className={labelClass}>Nota (opcional)</span>
          <textarea rows={2} className={fieldClass} value={restockForm.note} onChange={(e) => setRestockForm({ ...restockForm, note: e.target.value })} />
        </label>
        <div className='flex gap-2 justify-end'>
          <button className='rounded border border-rack-gold/25 px-3 py-1 text-sm hover:bg-rack-gold/10' onClick={() => setRestockProduct(null)}>Cancelar</button>
          <button className='rounded border border-rack-gold/40 px-3 py-1 text-sm hover:bg-rack-gold/10 disabled:opacity-60' onClick={saveRestock} disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </div>
    </div>}
  </div>;
}
