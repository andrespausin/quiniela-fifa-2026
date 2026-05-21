import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl text-center">
        <p className="mb-3 text-sm font-medium uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
          Mundial FIFA 2026
        </p>
        <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
          Quiniela privada del grupo
        </h1>
        <p className="mx-auto mb-10 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
          Predice los 104 partidos, compite contra tus amigos y sigue la
          clasificación en tiempo real. Acceso restringido por código de
          invitación.
        </p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/registro"
            className="inline-flex h-12 w-full items-center justify-center rounded-full bg-emerald-600 px-6 font-medium text-white transition-colors hover:bg-emerald-700 sm:w-auto"
          >
            Registrarme con el PIN
          </Link>
          <Link
            href="/login"
            className="inline-flex h-12 w-full items-center justify-center rounded-full border border-zinc-300 px-6 font-medium transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900 sm:w-auto"
          >
            Iniciar sesión
          </Link>
        </div>
      </div>
    </main>
  );
}
