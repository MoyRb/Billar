import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-rack-obsidian px-6 py-16">
      <div className="pointer-events-none absolute inset-0 bg-radial-rack opacity-60" />
      <div className="pointer-events-none absolute inset-0 bg-grain" />

      <section className="relative w-full max-w-4xl rounded-3xl border border-white/10 bg-rack-shell/80 p-8 shadow-rack-lg backdrop-blur sm:p-12">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-4 inline-flex rounded-full border border-rack-gold/40 bg-rack-panel/60 px-4 py-1 text-sm text-rack-gold">
            Rackhouse · Plataforma de administración
          </p>

          <h1 className="text-3xl font-semibold leading-tight text-rack-cream sm:text-5xl">
            Administra tu billar de forma sencilla
          </h1>

          <p className="mt-5 text-base text-rack-cream/80 sm:text-lg">
            Controla mesas, ventas, inventario y caja desde un solo lugar.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center rounded-xl bg-rack-gold px-6 py-3 font-medium text-rack-obsidian transition hover:brightness-110 sm:w-auto"
            >
              Acceder
            </Link>
            <Link
              href="/registro"
              className="inline-flex w-full items-center justify-center rounded-xl border border-rack-cream/30 bg-transparent px-6 py-3 font-medium text-rack-cream transition hover:bg-rack-cream/10 sm:w-auto"
            >
              Registrarse
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
