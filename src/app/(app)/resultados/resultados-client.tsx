"use client";

import { useState, useMemo } from "react";
import {
  useMatchesQuery,
  useMatchPredictionsQuery,
  type MatchWithTeams,
} from "@/lib/queries";
import { stageLabel } from "@/lib/format";

const OUTCOME_LABEL: Record<string, string> = {
  home: "Local",
  away: "Visitante",
  draw: "Empate",
};

const STAGES = [
  "group",
  "round_of_32",
  "round_of_16",
  "quarter_final",
  "semi_final",
  "third_place",
  "final",
] as const;

export function ResultadosClient() {
  const matches = useMatchesQuery();
  const [selectedStage, setSelectedStage] =
    useState<(typeof STAGES)[number]>("group");
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const predictions = useMatchPredictionsQuery(selectedMatchId);

  const matchesData = matches.data ?? [];

  // Solo partidos terminados
  const finishedByStage = useMemo(() => {
    const out = new Map<string, MatchWithTeams[]>();
    for (const m of matchesData) {
      if (m.status !== "finished") continue;
      const list = out.get(m.stage) ?? [];
      list.push(m);
      out.set(m.stage, list);
    }
    return out;
  }, [matchesData]);

  const stagesWithFinished = STAGES.filter((s) => (finishedByStage.get(s)?.length ?? 0) > 0);

  const matchesForStage = useMemo(
    () =>
      (finishedByStage.get(selectedStage) ?? []).sort((a, b) =>
        a.kickoff_at.localeCompare(b.kickoff_at),
      ),
    [finishedByStage, selectedStage],
  );

  const selectedMatch = matchesData.find((m) => m.id === selectedMatchId) ?? null;

  if (matches.isLoading) {
    return <p className="text-sm text-zinc-500">Cargando partidos…</p>;
  }

  if (stagesWithFinished.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
        Todavía no hay partidos terminados.
        <br />
        Los resultados aparecerán aquí cuando se juegue el primer partido.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Filtro por etapa */}
      <div className="flex flex-wrap gap-1.5">
        {stagesWithFinished.map((s) => (
          <button
            key={s}
            onClick={() => {
              setSelectedStage(s);
              setSelectedMatchId(null);
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              selectedStage === s
                ? "bg-emerald-600 text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            {stageLabel[s]}
          </button>
        ))}
      </div>

      {/* Lista de partidos de la etapa seleccionada */}
      <div className="grid gap-2 sm:grid-cols-2">
        {matchesForStage.map((m) => {
          const active = m.id === selectedMatchId;
          return (
            <button
              key={m.id}
              onClick={() =>
                setSelectedMatchId(active ? null : m.id)
              }
              className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                active
                  ? "border-emerald-400 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950/30"
                  : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="text-xl">
                  {m.home_team?.flag_emoji ?? "🏳️"}
                </span>
                <span className="truncate font-medium">
                  {m.home_team?.name ?? m.home_placeholder ?? "?"}
                </span>
              </span>
              <span className="shrink-0 font-mono font-bold tabular-nums">
                {m.home_score} – {m.away_score}
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium">
                  {m.away_team?.name ?? m.away_placeholder ?? "?"}
                </span>
                <span className="text-xl">
                  {m.away_team?.flag_emoji ?? "🏳️"}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Tabla de predicciones del partido seleccionado */}
      {selectedMatch && (
        <MatchPredictionsTable
          match={selectedMatch}
          predictions={predictions.data ?? []}
          isLoading={predictions.isLoading}
          error={predictions.error ? (predictions.error as Error).message : null}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabla de predicciones del partido seleccionado
// ---------------------------------------------------------------------------
function MatchPredictionsTable({
  match,
  predictions,
  isLoading,
  error,
}: {
  match: MatchWithTeams;
  predictions: {
    display_name: string;
    quiniela_name: string;
    home_score: number;
    away_score: number;
    winner: "home" | "away" | "draw" | null;
    points: number | null;
  }[];
  isLoading: boolean;
  error: string | null;
}) {
  const sorted = useMemo(
    () =>
      [...predictions].sort((a, b) => (b.points ?? 0) - (a.points ?? 0)),
    [predictions],
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-3 text-sm font-semibold">
          <span>
            {match.home_team?.flag_emoji ?? "🏳️"}{" "}
            {match.home_team?.name ?? match.home_placeholder}
          </span>
          <span className="font-mono text-base tabular-nums">
            {match.home_score} – {match.away_score}
          </span>
          <span>
            {match.away_team?.name ?? match.away_placeholder}{" "}
            {match.away_team?.flag_emoji ?? "🏳️"}
          </span>
        </div>
        <span className="text-xs text-zinc-500">
          {predictions.length} predicci{predictions.length === 1 ? "ón" : "ones"}
        </span>
      </div>

      {isLoading ? (
        <p className="px-4 py-6 text-sm text-zinc-500">Cargando…</p>
      ) : error ? (
        <p className="px-4 py-6 text-sm text-red-500">{error}</p>
      ) : sorted.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-zinc-500">
          Nadie hizo predicciones para este partido.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-950">
            <tr>
              <th className="px-4 py-2 text-left">Participante</th>
              <th className="px-4 py-2 text-center">Predicción</th>
              <th className="hidden px-4 py-2 text-center sm:table-cell">
                Desempate
              </th>
              <th className="px-4 py-2 text-right">Puntos</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => {
              const pts = p.points;
              const ptsColor =
                pts === null
                  ? "text-zinc-400"
                  : pts >= 9
                    ? "text-emerald-600 dark:text-emerald-400"
                    : pts >= 3
                      ? "text-blue-600 dark:text-blue-400"
                      : pts === 0
                        ? "text-red-500 dark:text-red-400"
                        : "text-zinc-700 dark:text-zinc-300";

              return (
                <tr
                  key={i}
                  className="border-t border-zinc-100 dark:border-zinc-800"
                >
                  <td className="px-4 py-2">
                    <span className="font-medium">{p.display_name}</span>
                    {p.quiniela_name !== "Mi quiniela" ? (
                      <span className="ml-1.5 rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">
                        {p.quiniela_name}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-center font-mono tabular-nums">
                    {p.home_score} – {p.away_score}
                  </td>
                  <td className="hidden px-4 py-2 text-center text-xs text-zinc-500 sm:table-cell">
                    {p.winner ? OUTCOME_LABEL[p.winner] : "—"}
                  </td>
                  <td
                    className={`px-4 py-2 text-right font-semibold tabular-nums ${ptsColor}`}
                  >
                    {pts !== null ? pts : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
