import { PageHeader } from '@/components/ui';

export default function Configuracion(){
  return <div className="space-y-6"><PageHeader title="Configuración" description="Parámetros base del negocio" />
  <section className="grid gap-4 lg:grid-cols-2">
    <div className="rounded-xl border bg-white p-4"><h2 className="font-semibold">Datos del negocio</h2><div className="mt-3 space-y-2"><input className="w-full rounded border p-2" placeholder="Nombre comercial" /><input className="w-full rounded border p-2" placeholder="URL del logo" /></div></div>
    <div className="rounded-xl border bg-white p-4"><h2 className="font-semibold">Operación general</h2><div className="mt-3 space-y-2"><input className="w-full rounded border p-2" placeholder="Tarifa general por hora" /><select className="w-full rounded border p-2"><option>MXN</option><option>USD</option></select></div></div>
  </section>
  <section className="rounded-xl border bg-white p-4"><h2 className="font-semibold">Gestión básica de mesas</h2><p className="text-sm text-slate-500">Aquí podrás crear/editar mesas en la siguiente fase.</p></section>
  </div>;
}
