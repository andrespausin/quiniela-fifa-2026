import { ClasificacionClient } from "./clasificacion-client";

export const metadata = { title: "Clasificación · Quiniela FIFA 2026" };

export default function ClasificacionPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Clasificación</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Tabla en tiempo real de todos los participantes.
        </p>
      </header>
      <ClasificacionClient />
    </main>
  );
}
