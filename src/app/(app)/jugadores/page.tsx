import { JugadoresClient } from "./jugadores-client";

export const metadata = { title: "Jugadores · Quiniela FIFA 2026" };

export default function JugadoresPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Jugadores</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Selecciona un participante para ver sus predicciones y resultados.
        </p>
      </header>
      <JugadoresClient />
    </main>
  );
}
