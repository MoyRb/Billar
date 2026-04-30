'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SaveButton } from '@/components/auth-components';

export type SettingsData = {
  organizationId: string;
  businessName: string;
  logoUrl: string;
  defaultHourlyRate: number;
  currency: string;
};

export function SettingsForm({ initial }: { initial: SettingsData }) {
  const [businessName, setBusinessName] = useState(initial.businessName);
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl);
  const [defaultHourlyRate, setDefaultHourlyRate] = useState(String(initial.defaultHourlyRate));
  const [currency, setCurrency] = useState(initial.currency || 'MXN');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setError(null);
    setSuccess(null);
    const rate = Number(defaultHourlyRate);
    if (!businessName.trim()) return setError('Nombre comercial requerido.');
    if (!Number.isFinite(rate) || rate < 0) return setError('La tarifa general por hora debe ser mayor o igual a 0.');
    if (!currency.trim()) return setError('Moneda requerida.');

    setLoading(true);
    const supabase = createClient();
    const { error: upsertError } = await supabase.from('settings').upsert({
      organization_id: initial.organizationId,
      business_name: businessName.trim(),
      logo_url: logoUrl.trim() || null,
      default_hourly_rate: rate,
      currency: currency.trim(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'organization_id' });
    setLoading(false);
    if (upsertError) return setError(upsertError.message);
    setSuccess('Configuración guardada correctamente');
    window.location.reload();
  };

  return <div className="space-y-5">
    <section className="rounded-2xl border border-rack-gold/10 bg-rack-panel p-4">
      <h2 className="font-semibold text-rack-cream">Datos del negocio</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="space-y-1"><span className="text-sm text-rack-cream/80">Nombre comercial</span><input value={businessName} onChange={(e)=>setBusinessName(e.target.value)} className="w-full rounded-xl border border-rack-gold/20 bg-rack-shell/75 px-3 py-2 text-rack-cream" /></label>
        <label className="space-y-1"><span className="text-sm text-rack-cream/80">URL del logo</span><input value={logoUrl} onChange={(e)=>setLogoUrl(e.target.value)} className="w-full rounded-xl border border-rack-gold/20 bg-rack-shell/75 px-3 py-2 text-rack-cream" placeholder="https://..." /></label>
      </div>
    </section>
    <section className="rounded-2xl border border-rack-gold/10 bg-rack-panel p-4">
      <h2 className="font-semibold text-rack-cream">Operación general</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="space-y-1"><span className="text-sm text-rack-cream/80">Tarifa general por hora</span><input type="number" min={0} value={defaultHourlyRate} onChange={(e)=>setDefaultHourlyRate(e.target.value)} className="w-full rounded-xl border border-rack-gold/20 bg-rack-shell/75 px-3 py-2 text-rack-cream" /></label>
        <label className="space-y-1"><span className="text-sm text-rack-cream/80">Moneda</span><select value={currency} onChange={(e)=>setCurrency(e.target.value)} className="w-full rounded-xl border border-rack-gold/20 bg-rack-shell/75 px-3 py-2 text-rack-cream"><option>MXN</option><option>USD</option><option>EUR</option></select></label>
      </div>
    </section>
    <section className="rounded-2xl border border-rack-gold/10 bg-rack-panel p-4">
      <h2 className="font-semibold text-rack-cream">Vista previa / datos actuales</h2>
      <div className="mt-3 space-y-1 text-sm text-rack-cream/80"><p>Nombre actual del negocio: <span className="text-rack-cream">{businessName || 'Sin nombre de negocio'}</span></p><p>Moneda: <span className="text-rack-cream">{currency}</span></p><p>Tarifa general: <span className="text-rack-cream">{defaultHourlyRate || '0'}</span></p></div>
    </section>
    <div className="max-w-xs"><SaveButton type="button" onClick={save} disabled={loading}>{loading ? 'Guardando...' : 'Guardar configuración'}</SaveButton></div>
    {success && <p className="text-sm text-emerald-300">{success}</p>}
    {error && <p className="text-sm text-red-300">{error}</p>}
  </div>;
}
