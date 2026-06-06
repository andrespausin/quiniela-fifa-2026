"use client";

import { useMemo, useState } from "react";
import {
  useLeaderboardQuery,
  useMatchesQuery,
  useQuinielaPredictionsQuery,
  type MatchWithTeams,
} from "@/lib/queries";
import { ReadonlyPredictionCard } from "@/components/readonly-prediction-card";
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

const dateFmt = new Intl.DateTimeFormat("es", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

interface Participant {
  user_id: string;
  display_name: string;
  total_points: number;
  quinielas: { quiniela_id: string; quiniela_name: string; total_points: number }[];
}

export function JugadoresClient() {
  const leaderboard = useLeaderboardQuery();
  const matches = useMatchesQuery();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedQuinielaId, setSelectedQuinielaId] = useState<string | null>(null);
  const [stage, setStage] = useState<(typeof STAGES)[number]>("group");

  // Agrupar el leaderboard por usuario
  const participants = useMemo<Participant[]>(() => {
    const map = new Map<string, Participant>();
    for (const row of leaderboard.data ?? []) {
      const existing = map.get(row.user_id);
      const quinielaEntry = {
        quiniela_id: row.quiniela_id,
        quiniela_name: row.quiniela_name,
        total_points: row.total_points,
      };
      if (existing) {
        existing.quinielas.push(quinielaEntry);
        existing.total_points = Math.max(existing.total_points, row.total_points);
      } else {
        map.set(row.user_id, {
          user_id: row.user_id,
          display_name: row.display_name,
          total_points: row.total_points,
          quinielas: [quinielaEntry],
        });
      }
    }
    return [...map.values()].sort((a, b) => b.total_points - a.total_points);
  }, [leaderboard.data]);

  // Al seleccionar usuario, auto-seleccionar su primera quiniela
  const selectUser = (p: Participant) => {
    setSelectedUserId(p.user_id);
    setSelectedQuinielaId(p.quinielas[0]?.quiniela_id ?? null);
  };

  const selectedParticipant = participants.find((p) => p.user_id === selectedUserId) ?? null;

  const predictions = useQuinielaPredictionsQuery(selectedQuinielaId);

  type PredEntry = { home_score: number; away_score: number; winner: "home" | "away" | "draw" | null; points: number | null };
  const predMap = useMemo(() => {
    const m = new Map<number, PredEntry>();
    for (const p of predictions.data ?? []) m.set(p.match_id, p);
    return m;
  }, [predictions.data]);

  const matchesData = matches.data ?? [];

  const stagesWithMatches = STAGES.filter(
    (s) => matchesData.some((m) => m.stage === s),
  );

  const filteredMatches = useMemo(
    () => matchesData.filter((m) => m.stage === stage),
    [matchesData, stage],
  );

  if (leaderboard.isLoading || matches.isLoading) {
    return <p className="text-sm text-zinc-500">Cargando…</p>;
  }

  if (participants.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
        Todavía no hay participantes registrados.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Lista de participantes */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {participants.map((p) => (
          <button
            key={p.user_id}
            onClick={() => selectUser(p)}
            className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
              p.user_id === selectedUserId
                ? "border-emerald-400 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950/30"
                : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
            }`}
          >
            <div className="min-w-0">
              <p className="truncate font-semibold">{p.display_name}</p>
              {p.quinielas.length > 1 && (
                <p className="text-xs text-zinc-500">
                  {p.quinielas.length} quinielas
                </p>
              )}
            </div>
            <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-zinc-600 dark:text-zinc-300">
              {p.total_points} pts
            </span>
          </button>
        ))}
      </div>

      {/* Detalle del participante seleccionado */}
      {selectedParticipant && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <h2 className="text-lg font-semibold">
              {selectedParticipant.display_name}
            </h2>

            {/* Selector de quiniela si tiene más de una */}
            {selectedParticipant.quinielas.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedParticipant.quinielas.map((q) => (
                  <button
                    key={q.quiniela_id}
                    onClick={() => setSelectedQuinielaId(q.quiniela_id)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      q.quiniela_id === selectedQuinielaId
                        ? "bg-emerald-600 text-white"
                        : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200"
                    }`}
                  >
                    {q.quiniela_name}
                    <span className="ml-1 opacity-70">· {q.total_points} pts</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filtro de etapa */}
          <div className="flex flex-wrap gap-1.5">
            {stagesWithMatches.map((s) => {
              const count = matchesData.filter((m) => m.stage === s).length;
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

          {/* Predicciones */}
          {predictions.isLoading ? (
            <p className="text-sm text-zinc-500">Cargando predicciones…</p>
          ) : stage === "group" ? (
            <GroupView
              matches={filteredMatches}
              predMap={predMap}
            />
          ) : (
            <KnockoutView
              matches={filteredMatches}
              predMap={predMap}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vista fase de grupos
// ---------------------------------------------------------------------------
function GroupView({
  matches,
  predMap,
}: {
  matches: MatchWithTeams[];
  predMap: Map<number, { home_score: number; away_score: number; winner: "home" | "away" | "draw" | null; points: number | null }>;
}) {
  const byGroup = new Map<string, MatchWithTeams[]>();
  for (const m of matches) {
    const code = m.group?.code ?? "?";
    byGroup.set(code, [...(byGroup.get(code) ?? []), m]);
  }
  const groups = [...byGroup.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {groups.map(([code, ms]) => {
        const sorted = [...ms].sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at));
        const withPred = sorted.filter((m) => predMap.has(m.id)).length;
        return (
          <CollapsibleGroup key={code} title={`Grupo ${code}`} subtitle={`${withPred}/${sorted.length} predichos`}>
            <div className="flex flex-col gap-2 p-2">
              {sorted.map((m) => (
                <ReadonlyPredictionCard
                  key={m.id}
                  match={m}
                  prediction={predMap.get(m.id) ?? null}
                />
              ))}
            </div>
          </CollapsibleGroup>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vista eliminatorias
// ---------------------------------------------------------------------------
function KnockoutView({
  matches,
  predMap,
}: {
  matches: MatchWithTeams[];
  predMap: Map<number, { home_score: number; away_score: number; winner: "home" | "away" | "draw" | null; points: number | null }>;
}) {
  const byDay = new Map<string, MatchWithTeams[]>();
  for (const m of matches) {
    const dayKey = m.kickoff_at.slice(0, 10);
    byDay.set(dayKey, [...(byDay.get(dayKey) ?? []), m]);
  }
  const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="flex flex-col gap-4">
      {days.map(([day, ms]) => {
        const label = capitalize(dateFmt.format(new Date(`${day}T12:00:00Z`)));
        const sorted = [...ms].sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at));
        const withPred = sorted.filter((m) => predMap.has(m.id)).length;
        return (
          <CollapsibleGroup
            key={day}
            title={label}
            subtitle={`${withPred}/${sorted.length} predichos`}
            defaultOpen
          >
            <div className="grid gap-2 p-2 md:grid-cols-2">
              {sorted.map((m) => (
                <ReadonlyPredictionCard
                  key={m.id}
                  match={m}
                  prediction={predMap.get(m.id) ?? null}
                />
              ))}
            </div>
          </CollapsibleGroup>
        );
      })}
    </div>
  );
}

function CollapsibleGroup({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm open:bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900 dark:open:bg-zinc-950/40"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-950/40">
        <div className="flex items-baseline gap-2">
          <span className="text-base font-semibold">{title}</span>
          {subtitle && (
            <span className="text-xs font-normal text-zinc-500">{subtitle}</span>
          )}
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-zinc-500 transition-transform group-open:rotate-180"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 011.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </summary>
      {children}
    </details>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
