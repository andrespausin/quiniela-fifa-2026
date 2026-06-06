import { ResultadosClient } from "./resultados-client";

export const metadata = { title: "Resultados · Quiniela FIFA 2026" };

export default function ResultadosPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Resultados por partido</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Selecciona un partido terminado para ver las predicciones y puntos de todos los participantes.
        </p>
      </header>
      <ResultadosClient />
    </main>
  );
}
