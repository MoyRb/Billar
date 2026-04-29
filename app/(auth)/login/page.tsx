'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function LoginPage(){ const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [error,setError]=useState(''); const router=useRouter();
const submit=async(e:React.FormEvent)=>{e.preventDefault(); const supabase=createClient(); const {error}=await supabase.auth.signInWithPassword({email,password}); if(error) return setError(error.message); router.push('/dashboard');};
return <main className="flex min-h-screen items-center justify-center p-4"><form onSubmit={submit} className="w-full max-w-sm space-y-3 rounded-xl border bg-white p-6"><h1 className="text-xl font-semibold">Iniciar sesión</h1><input className="w-full rounded border p-2" placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} /><input type="password" className="w-full rounded border p-2" placeholder="Contraseña" value={password} onChange={(e)=>setPassword(e.target.value)} /><button className="w-full rounded bg-slate-900 p-2 text-white">Entrar</button>{error && <p className="text-sm text-red-600">{error}</p>}</form></main>; }
