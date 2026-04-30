import { AuthCard, RegisterForm } from '@/components/auth-components';

export default function RegistroPage() {
  return <main className="relative flex min-h-screen items-center justify-center bg-rack-obsidian p-4">
    <div className="pointer-events-none absolute inset-0 bg-radial-rack opacity-40" />
    <div className="pointer-events-none absolute inset-0 bg-grain" />
    <div className="relative w-full max-w-md">
      <AuthCard title="Crear cuenta" subtitle="Comienza tu operación en RackHouse.">
        <RegisterForm />
      </AuthCard>
    </div>
  </main>;
}
