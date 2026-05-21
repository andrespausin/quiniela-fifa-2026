import { EliminatoriasClient } from "./eliminatorias-client";

export const metadata = { title: "Eliminatorias · Quiniela FIFA 2026" };

export default function EliminatoriasPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Eliminatorias</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Tabla actual de cada grupo y cuadro de eliminación directa con los
          equipos clasificados (calculados a partir de los partidos jugados).
        </p>
      </header>
      <EliminatoriasClient />
    </main>
  );
}
