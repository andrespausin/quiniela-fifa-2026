"use client";

import { useMemo } from "react";
import type { MatchWithTeams } from "@/lib/queries";
import { isLocked, stageLabel } from "@/lib/format";

interface StageSummary {
  stage: string;
  total: number;
  closingSoon: number; // < 24 h pero aún desbloqueado
}

interface Props {
  matches: MatchWithTeams[];
  /** IDs de partidos que ya tienen predicción guardada */
  predictedMatchIds: Set<number>;
  /** Llama a este callback cuando el usuario hace clic en una etapa */
  onGoToStage: (stage: string) => void;
}

/**
 * Muestra un recordatorio de cuántos partidos le faltan por predecir al
 * usuario, agrupados por etapa. Solo muestra partidos cuyo cierre aún no
 * llegó y cuyos equipos ya se conocen.
 * Retorna null cuando no hay nada pendiente (no ocupa espacio).
 */
export function PendingReminder({ matches, predictedMatchIds, onGoToStage }: Props) {
  const now = useMemo(() => new Date(), []);

  const byStage = useMemo<StageSummary[]>(() => {
    const map = new Map<string, StageSummary>();

    for (const m of matches) {
      // Solo partidos con equipos conocidos y aún editables
      if (!m.home_team_id || !m.away_team_id) continue;
      if (isLocked(m.kickoff_at, now)) continue;
      if (predictedMatchIds.has(m.id)) continue;

      const entry = map.get(m.stage) ?? { stage: m.stage, total: 0, closingSoon: 0 };
      entry.total++;

      const msLeft = new Date(m.kickoff_at).getTime() - now.getTime() - 60 * 60 * 1000; // hasta el lock
      if (msLeft < 24 * 60 * 60 * 1000) entry.closingSoon++;

      map.set(m.stage, entry);
    }

    // Ordenar por stage para respetar el orden del torneo
    const order = [
      "group", "round_of_32", "round_of_16",
      "quarter_final", "semi_final", "third_place", "final",
    ];
    return [...map.values()].sort(
      (a, b) => order.indexOf(a.stage) - order.indexOf(b.stage),
    );
  }, [matches, predictedMatchIds, now]);

  if (byStage.length === 0) return null;

  const totalPending = byStage.reduce((s, e) => s + e.total, 0);
  const totalUrgent = byStage.reduce((s, e) => s + e.closingSoon, 0);

  return (
    <div
      role="status"
      className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/60 dark:bg-amber-950/30"
    >
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          {totalPending === 1
            ? "1 partido sin predicción"
            : `${totalPending} partidos sin predicción`}
          {totalUrgent > 0 && (
            <span className="ml-2 inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/50 dark:text-red-300">
              {totalUrgent} {totalUrgent === 1 ? "cierra" : "cierran"} en menos de 24 h
            </span>
          )}
        </p>
      </div>

      {/* Desglose por etapa */}
      <ul className="mt-2 flex flex-wrap gap-2">
        {byStage.map((s) => (
          <li key={s.stage}>
            <button
              onClick={() => onGoToStage(s.stage)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                s.closingSoon > 0
                  ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/70"
                  : "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-900/70"
              }`}
            >
              {stageLabel[s.stage] ?? s.stage}
              <span className="rounded-full bg-white/60 px-1.5 py-0.5 tabular-nums dark:bg-black/20">
                {s.total}
              </span>
              {s.closingSoon > 0 && (
                <span className="font-bold text-red-600 dark:text-red-400">⚡</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
