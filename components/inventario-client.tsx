'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PageHeader } from '@/components/ui';

type AssetType =
  | 'pool_cue'
  | 'ball_set'
  | 'domino_set'
  | 'pool_table'
  | 'fridge'
  | 'tv'
  | 'speaker'
  | 'lamp'
  | 'furniture'
  | 'other';

type AssetStatus = 'active' | 'maintenance' | 'damaged' | 'lost' | 'retired';

type Asset = {
  id: string;
  name: string;
  asset_type: AssetType;
  quantity: number;
  location: string | null;
  status: AssetStatus;
  purchase_cost: number | null;
  purchase_date: string | null;
  notes: string | null;
  is_active: boolean;
};

type AssetForm = {
  name: string;
  asset_type: AssetType;
  quantity: string;
  location: string;
  status: AssetStatus;
  purchase_cost: string;
  purchase_date: string;
  notes: string;
};

type AdjustMode = 'add' | 'subtract' | 'set';

const ASSET_TYPE_OPTIONS: { value: AssetType; label: string }[] = [
  { value: 'pool_cue', label: 'Taco de billar' },
  { value: 'ball_set', label: 'Juego de bolas' },
  { value: 'domino_set', label: 'Juego de dominó' },
  { value: 'pool_table', label: 'Mesa física' },
  { value: 'fridge', label: 'Refrigerador' },
  { value: 'tv', label: 'Pantalla / TV' },
  { value: 'speaker', label: 'Bocina' },
  { value: 'lamp', label: 'Lámpara' },
  { value: 'furniture', label: 'Mueble' },
  { value: 'other', label: 'Otro' }
];

const STATUS_OPTIONS: { value: AssetStatus; label: string }[] = [
  { value: 'active', label: 'Activo' },
  { value: 'maintenance', label: 'En mantenimiento' },
  { value: 'damaged', label: 'Dañado' },
  { value: 'lost', label: 'Perdido' },
  { value: 'retired', label: 'Retirado' }
];

const initialForm: AssetForm = {
  name: '',
  asset_type: 'other',
  quantity: '1',
  location: '',
  status: 'active',
  purchase_cost: '',
  purchase_date: '',
  notes: ''
};

const fieldClass = 'w-full rounded-md border border-rack-gold/20 bg-rack-shell/70 p-2.5 text-sm outline-none transition focus:border-rack-gold/60 focus:ring-1 focus:ring-rack-gold/50';
const labelClass = 'text-sm font-medium text-rack-cream';

export function InventarioClient({ organizationId, initialAssets }: { organizationId: string; initialAssets: Asset[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [assets, setAssets] = useState<Asset[]>(initialAssets);
  const [form, setForm] = useState<AssetForm>(initialForm);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AssetStatus>('all');
  const [showRetired, setShowRetired] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [adjustAsset, setAdjustAsset] = useState<Asset | null>(null);
  const [adjustMode, setAdjustMode] = useState<AdjustMode>('add');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  const refresh = async () => {
    const { data } = await supabase
      .from('business_assets')
      .select('id,name,asset_type,quantity,location,status,purchase_cost,purchase_date,notes,is_active')
      .eq('organization_id', organizationId)
      .order('name');
    setAssets((data ?? []) as Asset[]);
  };

  const validateForm = (): string | null => {
    if (!form.name.trim()) return 'El nombre del activo es obligatorio.';
    const quantity = Number(form.quantity);
    if (Number.isNaN(quantity) || quantity <= 0) return 'La cantidad debe ser mayor a 0.';
    if (form.purchase_cost.trim()) {
      const cost = Number(form.purchase_cost);
      if (Number.isNaN(cost) || cost < 0) return 'El costo estimado debe ser mayor o igual a 0.';
    }
    return null;
  };

  const saveAsset = async () => {
    setError('');
    setSuccess('');
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    const payload = {
      organization_id: organizationId,
      name: form.name.trim(),
      asset_type: form.asset_type,
      quantity: Number(form.quantity),
      location: form.location.trim() || null,
      status: form.status,
      purchase_cost: form.purchase_cost.trim() ? Number(form.purchase_cost) : null,
      purchase_date: form.purchase_date || null,
      notes: form.notes.trim() || null,
      is_active: form.status === 'retired' ? false : true
    };

    const response = editingAssetId
      ? await supabase.from('business_assets').update(payload).eq('id', editingAssetId).eq('organization_id', organizationId)
      : await supabase.from('business_assets').insert(payload);

    if (response.error) {
      setError('No se pudo guardar el activo. Intenta nuevamente.');
      setIsSaving(false);
      return;
    }

    await refresh();
    setForm(initialForm);
    setEditingAssetId(null);
    setSuccess(editingAssetId ? 'Activo actualizado correctamente.' : 'Activo registrado correctamente.');
    setIsSaving(false);
  };

  const startEdit = (asset: Asset) => {
    setError('');
    setSuccess('');
    setEditingAssetId(asset.id);
    setForm({
      name: asset.name,
      asset_type: asset.asset_type,
      quantity: String(asset.quantity),
      location: asset.location ?? '',
      status: asset.status,
      purchase_cost: asset.purchase_cost === null ? '' : String(asset.purchase_cost),
      purchase_date: asset.purchase_date ?? '',
      notes: asset.notes ?? ''
    });
  };

  const changeStatus = async (asset: Asset, status: AssetStatus) => {
    setError('');
    setSuccess('');
    const { error: updateError } = await supabase
      .from('business_assets')
      .update({ status, is_active: status === 'retired' ? false : true })
      .eq('id', asset.id)
      .eq('organization_id', organizationId);
    if (updateError) {
      setError('No se pudo cambiar el estado del activo.');
      return;
    }
    await refresh();
    setSuccess('Estado actualizado correctamente.');
  };

  const retireAsset = async (asset: Asset) => {
    if (!window.confirm(`¿Retirar "${asset.name}"? Se conservará en historial como inactivo.`)) return;
    await changeStatus(asset, 'retired');
  };

  const applyAdjustment = async () => {
    if (!adjustAsset) return;
    setError('');
    setSuccess('');
    const amount = Number(adjustAmount);
    if (Number.isNaN(amount) || amount < 0) {
      setError('La cantidad de ajuste debe ser mayor o igual a 0.');
      return;
    }

    let nextQuantity = adjustAsset.quantity;
    if (adjustMode === 'add') nextQuantity = adjustAsset.quantity + amount;
    if (adjustMode === 'subtract') nextQuantity = adjustAsset.quantity - amount;
    if (adjustMode === 'set') nextQuantity = amount;

    if (nextQuantity <= 0) {
      setError('La cantidad final debe ser mayor a 0.');
      return;
    }

    const notesPrefix = adjustReason.trim()
      ? `Ajuste (${adjustMode} ${amount}): ${adjustReason.trim()}`
      : `Ajuste (${adjustMode} ${amount})`;
    const mergedNotes = adjustAsset.notes ? `${adjustAsset.notes}\n${notesPrefix}` : notesPrefix;

    const { error: updateError } = await supabase
      .from('business_assets')
      .update({ quantity: nextQuantity, notes: mergedNotes })
      .eq('id', adjustAsset.id)
      .eq('organization_id', organizationId);

    if (updateError) {
      setError('No se pudo ajustar la cantidad.');
      return;
    }

    await refresh();
    setAdjustAsset(null);
    setAdjustAmount('');
    setAdjustReason('');
    setAdjustMode('add');
    setSuccess('Cantidad ajustada correctamente.');
  };

  const filteredAssets = assets.filter((asset) => {
    if (!showRetired && (!asset.is_active || asset.status === 'retired')) return false;
    if (statusFilter !== 'all' && asset.status !== statusFilter) return false;
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return [asset.name, asset.location ?? '', asset.asset_type].some((value) => value.toLowerCase().includes(term));
  });

  const getTypeLabel = (type: AssetType) => ASSET_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? 'Otro';
  const getStatusLabel = (status: AssetStatus) => STATUS_OPTIONS.find((option) => option.value === status)?.label ?? 'Activo';

  const badgeClass: Record<AssetStatus, string> = {
    active: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    maintenance: 'bg-amber-500/20 text-amber-200 border-amber-500/40',
    damaged: 'bg-orange-500/20 text-orange-200 border-orange-500/40',
    lost: 'bg-rose-500/20 text-rose-200 border-rose-500/40',
    retired: 'bg-zinc-500/20 text-zinc-200 border-zinc-500/40'
  };

  return (
    <div className='space-y-4'>
      <PageHeader title='Activos' description='Control interno de activos físicos del billar. No se mezclan con productos vendibles.' />

      <div className='rounded-xl border border-rack-gold/20 bg-rack-shell/30 p-4 md:p-5 space-y-4'>
        <h3 className='text-sm font-semibold uppercase tracking-wide text-rack-gold'>{editingAssetId ? 'Editar activo' : 'Registrar activo'}</h3>
        <div className='grid gap-3 md:grid-cols-2'>
          <label className='space-y-1'>
            <span className={labelClass}>Nombre del activo</span>
            <input className={fieldClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder='Tacos de billar' />
          </label>
          <label className='space-y-1'>
            <span className={labelClass}>Tipo de activo</span>
            <select className={fieldClass} value={form.asset_type} onChange={(e) => setForm({ ...form, asset_type: e.target.value as AssetType })}>
              {ASSET_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className='space-y-1'>
            <span className={labelClass}>Cantidad</span>
            <input type='number' min='1' step='1' className={fieldClass} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </label>
          <label className='space-y-1'>
            <span className={labelClass}>Ubicación</span>
            <input className={fieldClass} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder='Salón principal' />
          </label>
          <label className='space-y-1'>
            <span className={labelClass}>Estado</span>
            <select className={fieldClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as AssetStatus })}>
              {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className='space-y-1'>
            <span className={labelClass}>Costo estimado (opcional)</span>
            <input type='number' min='0' step='0.01' className={fieldClass} value={form.purchase_cost} onChange={(e) => setForm({ ...form, purchase_cost: e.target.value })} placeholder='4500.00' />
          </label>
          <label className='space-y-1'>
            <span className={labelClass}>Fecha de compra (opcional)</span>
            <input type='date' className={fieldClass} value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
          </label>
          <label className='space-y-1 md:col-span-2'>
            <span className={labelClass}>Notas (opcional)</span>
            <textarea className={fieldClass} rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder='Tacos de uso general' />
          </label>
        </div>

        {error && <p className='text-sm text-red-300'>{error}</p>}
        {success && <p className='text-sm text-emerald-300'>{success}</p>}

        <div className='flex flex-wrap gap-2'>
          <button className='rounded-md border border-rack-gold/40 bg-rack-gold/10 px-3 py-2 text-sm font-medium text-rack-cream' onClick={saveAsset} disabled={isSaving}>
            {editingAssetId ? 'Guardar cambios' : 'Registrar activo'}
          </button>
          {editingAssetId && (
            <button className='rounded-md border border-rack-gold/20 px-3 py-2 text-sm text-rack-cream/80' onClick={() => { setEditingAssetId(null); setForm(initialForm); }}>
              Cancelar edición
            </button>
          )}
        </div>
      </div>

      <div className='rounded-xl border border-rack-gold/20 bg-rack-shell/30 p-4 md:p-5 space-y-3'>
        <div className='grid gap-3 md:grid-cols-4'>
          <input className={fieldClass} placeholder='Buscar por nombre, tipo o ubicación' value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className={fieldClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | AssetStatus)}>
            <option value='all'>Todos los estados</option>
            {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <label className='flex items-center gap-2 text-sm text-rack-cream'>
            <input type='checkbox' checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)} />
            Mostrar retirados / inactivos
          </label>
        </div>

        <div className='overflow-x-auto'>
          <table className='min-w-full text-sm'>
            <thead>
              <tr className='border-b border-rack-gold/20 text-left text-rack-gold'>
                <th className='p-2'>Nombre</th><th className='p-2'>Tipo</th><th className='p-2'>Cantidad</th><th className='p-2'>Ubicación</th><th className='p-2'>Estado</th><th className='p-2'>Costo estimado</th><th className='p-2'>Notas</th><th className='p-2'>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.map((asset) => (
                <tr key={asset.id} className='border-b border-rack-gold/10 text-rack-cream/90'>
                  <td className='p-2'>{asset.name}</td>
                  <td className='p-2'>{getTypeLabel(asset.asset_type)}</td>
                  <td className='p-2'>{asset.quantity}</td>
                  <td className='p-2'>{asset.location ?? '—'}</td>
                  <td className='p-2'><span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${badgeClass[asset.status]}`}>{getStatusLabel(asset.status)}</span></td>
                  <td className='p-2'>{asset.purchase_cost !== null ? `$${asset.purchase_cost}` : '—'}</td>
                  <td className='p-2 max-w-xs truncate'>{asset.notes ?? '—'}</td>
                  <td className='p-2'>
                    <div className='flex flex-wrap gap-1'>
                      <button className='rounded border border-rack-gold/20 px-2 py-1 text-xs' onClick={() => startEdit(asset)}>Editar</button>
                      <button className='rounded border border-rack-gold/20 px-2 py-1 text-xs' onClick={() => setAdjustAsset(asset)}>Ajustar cantidad</button>
                      <select className='rounded border border-rack-gold/20 bg-rack-shell/70 px-2 py-1 text-xs' value={asset.status} onChange={(e) => changeStatus(asset, e.target.value as AssetStatus)}>
                        {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                      <button className='rounded border border-red-400/30 px-2 py-1 text-xs text-red-200' onClick={() => retireAsset(asset)}>Retirar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {adjustAsset && (
        <div className='rounded-xl border border-rack-gold/20 bg-rack-shell/40 p-4 space-y-3'>
          <h4 className='text-sm font-semibold text-rack-gold'>Ajustar cantidad: {adjustAsset.name}</h4>
          <div className='grid gap-3 md:grid-cols-3'>
            <select className={fieldClass} value={adjustMode} onChange={(e) => setAdjustMode(e.target.value as AdjustMode)}>
              <option value='add'>Sumar</option>
              <option value='subtract'>Restar</option>
              <option value='set'>Establecer exacta</option>
            </select>
            <input className={fieldClass} type='number' min='0' step='1' value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} placeholder='Cantidad' />
            <input className={fieldClass} value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder='Motivo: compra, pérdida, daño, corrección u otro' />
          </div>
          <div className='flex gap-2'>
            <button className='rounded-md border border-rack-gold/40 bg-rack-gold/10 px-3 py-2 text-sm' onClick={applyAdjustment}>Aplicar ajuste</button>
            <button className='rounded-md border border-rack-gold/20 px-3 py-2 text-sm' onClick={() => setAdjustAsset(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
