"use client";

import type { MatchWithTeams } from "@/lib/queries";
import { formatKickoff } from "@/lib/format";

interface Prediction {
  home_score: number;
  away_score: number;
  winner: "home" | "away" | "draw" | null;
  points: number | null;
}

interface Props {
  match: MatchWithTeams;
  prediction: Prediction | null;
}

const WINNER_LABEL: Record<string, string> = {
  home: "Local",
  away: "Visitante",
  draw: "Empate",
};

function pointsColor(pts: number | null) {
  if (pts === null) return "text-zinc-400";
  if (pts === 0) return "text-red-500 dark:text-red-400";
  if (pts <= 2) return "text-zinc-700 dark:text-zinc-300";
  if (pts <= 6) return "text-blue-600 dark:text-blue-400";
  return "text-emerald-600 dark:text-emerald-400";
}

export function ReadonlyPredictionCard({ match, prediction }: Props) {
  const homeFlag = match.home_team?.flag_emoji ?? "🏳️";
  const awayFlag = match.away_team?.flag_emoji ?? "🏳️";
  const homeName = match.home_team?.name ?? match.home_placeholder ?? "Por definir";
  const awayName = match.away_team?.name ?? match.away_placeholder ?? "Por definir";
  const finished = match.status === "finished";
  const hasResult = finished && match.home_score !== null && match.away_score !== null;
  const showPenaltyTiebreak =
    hasResult &&
    prediction !== null &&
    match.stage !== "group" &&
    prediction.home_score === prediction.away_score &&
    prediction.winner;

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      {/* Cabecera: fecha + puntos */}
      <header className="flex items-center justify-between gap-2 text-xs">
        <span className="text-zinc-500">{formatKickoff(match.kickoff_at)}</span>
        <div className="flex items-center gap-2">
          {prediction !== null && prediction.points !== null ? (
            <span
              className={`rounded-full bg-zinc-100 px-2 py-0.5 font-semibold tabular-nums dark:bg-zinc-800 ${pointsColor(prediction.points)}`}
            >
              {prediction.points} pt{prediction.points === 1 ? "" : "s"}
            </span>
          ) : finished ? (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-400 dark:bg-zinc-800">
              Sin predicción
            </span>
          ) : (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-400 dark:bg-zinc-800">
              Pendiente
            </span>
          )}
        </div>
      </header>

      {/* Equipos */}
      <div className="flex flex-col gap-2">
        {/* Local */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-2xl leading-none">{homeFlag}</span>
            <span className="truncate font-semibold">{homeName}</span>
          </div>
          <ScorePair
            real={hasResult ? match.home_score! : null}
            predicted={prediction?.home_score ?? null}
            finished={finished}
          />
        </div>
        {/* Visitante */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-2xl leading-none">{awayFlag}</span>
            <span className="truncate font-semibold">{awayName}</span>
          </div>
          <ScorePair
            real={hasResult ? match.away_score! : null}
            predicted={prediction?.away_score ?? null}
            finished={finished}
          />
        </div>
      </div>

      {/* Leyenda de columnas (solo si hay datos) */}
      {finished && prediction !== null && (
        <div className="flex justify-end gap-4 text-xs text-zinc-400">
          <span className="w-8 text-center">Real</span>
          <span className="w-8 text-center">Pred.</span>
        </div>
      )}

      {/* Desempate por penales */}
      {showPenaltyTiebreak && (
        <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-950">
          <span className="text-zinc-600 dark:text-zinc-300">Gana por penales (pred.):</span>
          <span className="font-medium">{WINNER_LABEL[prediction!.winner!] ?? prediction!.winner}</span>
        </div>
      )}
    </article>
  );
}

function ScorePair({
  real,
  predicted,
  finished,
}: {
  real: number | null;
  predicted: number | null;
  finished: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      {/* Resultado real */}
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 font-mono text-base font-bold tabular-nums dark:bg-zinc-800">
        {real !== null ? real : <span className="text-zinc-400 text-sm">–</span>}
      </div>
      {/* Predicción */}
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-lg font-mono text-base font-bold tabular-nums border ${
          !finished
            ? "border-dashed border-zinc-300 text-zinc-400 dark:border-zinc-700"
            : predicted !== null && real !== null && predicted === real
              ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-zinc-200 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        }`}
      >
        {predicted !== null ? predicted : <span className="text-zinc-400 text-sm">–</span>}
      </div>
    </div>
  );
}
