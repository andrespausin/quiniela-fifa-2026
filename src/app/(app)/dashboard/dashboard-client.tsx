"use client";

import { useMemo, useState } from "react";
import { useMatchesQuery, usePredictionsQuery } from "@/lib/queries";
import { PredictionCard } from "@/components/prediction-card";
import { stageLabel } from "@/lib/format";

const STAGES = [
  "group",
  "round_of_32",
  "round_of_16",
  "quarter_final",
  "semi_final",
  "third_place",
  "final",
] as const;

export function DashboardClient() {
  const matches = useMatchesQuery();
  const predictions = usePredictionsQuery();
  const [stage, setStage] = useState<(typeof STAGES)[number]>("group");

  const predictionsData = predictions.data;
  const byMatchId = useMemo(() => {
    const m = new Map<number, NonNullable<typeof predictionsData>[number]>();
    for (const p of predictionsData ?? []) m.set(p.match_id, p);
    return m;
  }, [predictionsData]);

  const filtered = (matches.data ?? []).filter((m) => m.stage === stage);

  if (matches.isLoading) {
    return <p className="text-sm text-zinc-500">Cargando partidos…</p>;
  }
  if (matches.error) {
    return (
      <p className="text-sm text-red-500">
        Error: {(matches.error as Error).message}
      </p>
    );
  }
  if ((matches.data ?? []).length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
        Aún no se han cargado los partidos. El administrador debe ejecutar
        <code className="mx-1 rounded bg-zinc-100 px-1 dark:bg-zinc-800">
          POST /api/cron/sync-fixtures
        </code>
        para inicializar el calendario.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        {STAGES.map((s) => {
          const count = (matches.data ?? []).filter(
            (m) => m.stage === s,
          ).length;
          if (count === 0) return null;
          return (
            <button
              key={s}
              onClick={() => setStage(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                stage === s
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              {stageLabel[s]} · {count}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Aún no hay partidos en esta ronda.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((m) => (
            <PredictionCard
              key={m.id}
              match={m}
              prediction={byMatchId.get(m.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
