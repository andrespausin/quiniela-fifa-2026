"use client";

import { useLeaderboardQuery } from "@/lib/queries";

export function ClasificacionClient() {
  const { data, isLoading, error } = useLeaderboardQuery();

  if (isLoading) {
    return <p className="text-sm text-zinc-500">Cargando tabla…</p>;
  }
  if (error) {
    return (
      <p className="text-sm text-red-500">
        Error: {(error as Error).message}
      </p>
    );
  }
  const rows = data ?? [];

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-950">
          <tr>
            <th className="px-4 py-2 text-left">#</th>
            <th className="px-4 py-2 text-left">Jugador</th>
            <th className="px-4 py-2 text-right">Partidos</th>
            <th className="px-4 py-2 text-right">Eliminatorias</th>
            <th className="px-4 py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={5}
                className="px-4 py-8 text-center text-zinc-500"
              >
                Aún no hay puntos registrados.
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr
                key={r.user_id}
                className="border-t border-zinc-100 dark:border-zinc-800"
              >
                <td className="px-4 py-2 font-mono text-zinc-500">{i + 1}</td>
                <td className="px-4 py-2 font-medium">{r.display_name}</td>
                <td className="px-4 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-300">
                  {r.match_points}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-300">
                  {r.bracket_points}
                </td>
                <td className="px-4 py-2 text-right tabular-nums font-semibold">
                  {r.total_points}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
