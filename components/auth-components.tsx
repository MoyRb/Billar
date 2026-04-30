'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

function mapAuthError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid login credentials')) return 'Credenciales inválidas.';
  if (normalized.includes('email not confirmed')) return 'Correo no confirmado. En demo puedes desactivar confirmación en Supabase.';
  if (normalized.includes('user already registered')) return 'Este correo ya está registrado.';
  if (normalized.includes('network')) return 'Error de conexión. Verifica internet e intenta nuevamente.';
  return message;
}

export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <div className="w-full max-w-md rounded-2xl border border-rack-gold/20 bg-rack-panel/95 p-6 shadow-rack-lg">
    <p className="text-2xl font-semibold text-rack-cream">RackHouse</p>
    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-rack-gold/70">Sistema de gestión para salones de billar</p>
    <h1 className="mt-6 text-xl font-semibold text-rack-cream">{title}</h1>
    <p className="mt-1 text-sm text-rack-cream/70">{subtitle}</p>
    <div className="mt-5">{children}</div>
  </div>;
}

export function FormField({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="block space-y-1.5">
    <span className="text-sm text-rack-cream/80">{label}</span>
    <input {...props} className="w-full rounded-xl border border-rack-gold/20 bg-rack-shell/80 px-3 py-2 text-rack-cream outline-none placeholder:text-rack-cream/45 focus:border-rack-gold/45" />
  </label>;
}

export function SaveButton({ children, disabled, type = 'submit', onClick }: { children: React.ReactNode; disabled?: boolean; type?: 'button' | 'submit'; onClick?: () => void }) {
  return <button type={type} onClick={onClick} disabled={disabled} className="w-full rounded-xl border border-rack-gold/40 bg-rack-gold/20 px-3 py-2.5 font-medium text-rack-cream transition hover:bg-rack-gold/30 disabled:cursor-not-allowed disabled:opacity-60">{children}</button>;
}

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) return setError(mapAuthError(signInError.message));
    router.push('/dashboard');
    router.refresh();
  };

  return <form className="space-y-3" onSubmit={submit}>
    <FormField label="Email" type="email" autoComplete="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
    <FormField label="Contraseña" type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
    <SaveButton disabled={loading}>{loading ? 'Ingresando...' : 'Iniciar sesión'}</SaveButton>
    {error && <p className="text-sm text-red-300">{error}</p>}
    <p className="text-sm text-rack-cream/75">¿No tienes cuenta? <Link href="/registro" className="text-rack-gold hover:underline">Crear cuenta</Link></p>
  </form>;
}

export function RegisterForm() {
  const [fullName, setFullName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, organization_name: organizationName, business_name: organizationName } },
    });
    setLoading(false);
    if (signUpError) return setError(mapAuthError(signUpError.message));
    if (data.session) {
      router.push('/dashboard');
      router.refresh();
      return;
    }
    setMessage('Cuenta creada. Ahora inicia sesión para continuar.');
  };

  return <form className="space-y-3" onSubmit={submit}>
    <FormField label="Nombre completo" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
    <FormField label="Nombre del negocio" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} required />
    <FormField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
    <FormField label="Contraseña" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
    <SaveButton disabled={loading}>{loading ? 'Creando...' : 'Crear cuenta'}</SaveButton>
    {error && <p className="text-sm text-red-300">{error}</p>}
    {message && <p className="text-sm text-emerald-300">{message}</p>}
    <p className="text-sm text-rack-cream/75">¿Ya tienes cuenta? <Link href="/login" className="text-rack-gold hover:underline">Iniciar sesión</Link></p>
  </form>;
}
