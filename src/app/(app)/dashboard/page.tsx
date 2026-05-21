import { DashboardClient } from "./dashboard-client";

export const metadata = { title: "Mis predicciones · Quiniela FIFA 2026" };

export default function DashboardPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Mis predicciones</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Edita tus pronósticos hasta 1 hora antes de cada partido.
        </p>
      </header>
      <DashboardClient />
    </main>
  );
}
