"use client";

import { useForm } from "@tanstack/react-form";
import { Button } from "@/components/ui/button";
import { useUpsertPrediction, type MatchWithTeams } from "@/lib/queries";
import { formatKickoff, isLocked, stageLabel, timeLeftLabel } from "@/lib/format";

interface Props {
  match: MatchWithTeams;
  prediction?: {
    home_score: number;
    away_score: number;
    winner: "home" | "away" | "draw" | null;
    points: number | null;
  };
}

export function PredictionCard({ match, prediction }: Props) {
  const locked = isLocked(match.kickoff_at);
  const mutation = useUpsertPrediction();
  const homeFlag = match.home_team?.flag_emoji ?? "";
  const awayFlag = match.away_team?.flag_emoji ?? "";
  const homeLabel =
    [homeFlag, match.home_team?.name ?? match.home_placeholder ?? "Por definir"]
      .filter(Boolean)
      .join(" ");
  const awayLabel =
    [awayFlag, match.away_team?.name ?? match.away_placeholder ?? "Por definir"]
      .filter(Boolean)
      .join(" ");
  const teamsKnown = Boolean(match.home_team && match.away_team);
  const showPenaltyToggle = match.stage !== "group";

  const form = useForm({
    defaultValues: {
      homeScore: prediction?.home_score ?? 0,
      awayScore: prediction?.away_score ?? 0,
      winner: (prediction?.winner ?? null) as "home" | "away" | "draw" | null,
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync({
        matchId: match.id,
        homeScore: value.homeScore,
        awayScore: value.awayScore,
        winner: showPenaltyToggle ? value.winner : null,
      });
    },
  });

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {stageLabel[match.stage] ?? match.stage}
            {match.group?.code ? ` · Grupo ${match.group.code}` : ""}
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {formatKickoff(match.kickoff_at)}
          </p>
        </div>
        <div className="text-right">
          {locked ? (
            <span className="inline-block rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              Cerrado
            </span>
          ) : (
            <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              {timeLeftLabel(match.kickoff_at)}
            </span>
          )}
          {prediction?.points !== null && prediction?.points !== undefined ? (
            <p className="mt-1 text-xs text-zinc-500">
              {prediction.points} pt{prediction.points === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="flex flex-col gap-3"
      >
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <span className="text-right text-sm font-medium">{homeLabel}</span>

          <div className="flex items-center gap-2">
            <form.Field name="homeScore">
              {(field) => (
                <input
                  type="number"
                  min={0}
                  max={30}
                  inputMode="numeric"
                  disabled={locked || !teamsKnown}
                  value={field.state.value}
                  onChange={(e) =>
                    field.handleChange(
                      Number.isFinite(e.target.valueAsNumber)
                        ? e.target.valueAsNumber
                        : 0,
                    )
                  }
                  className="h-10 w-14 rounded-md border border-zinc-300 bg-white text-center text-lg font-semibold tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:disabled:bg-zinc-900"
                />
              )}
            </form.Field>
            <span className="text-zinc-400">-</span>
            <form.Field name="awayScore">
              {(field) => (
                <input
                  type="number"
                  min={0}
                  max={30}
                  inputMode="numeric"
                  disabled={locked || !teamsKnown}
                  value={field.state.value}
                  onChange={(e) =>
                    field.handleChange(
                      Number.isFinite(e.target.valueAsNumber)
                        ? e.target.valueAsNumber
                        : 0,
                    )
                  }
                  className="h-10 w-14 rounded-md border border-zinc-300 bg-white text-center text-lg font-semibold tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:disabled:bg-zinc-900"
                />
              )}
            </form.Field>
          </div>

          <span className="text-left text-sm font-medium">{awayLabel}</span>
        </div>

        {showPenaltyToggle ? (
          <form.Subscribe
            selector={(s) =>
              [s.values.homeScore, s.values.awayScore, s.values.winner] as const
            }
          >
            {([h, a, w]) =>
              h === a ? (
                <form.Field name="winner">
                  {(field) => (
                    <div className="flex items-center justify-center gap-2 text-sm">
                      <span className="text-zinc-500">Gana por penales:</span>
                      <select
                        disabled={locked || !teamsKnown}
                        value={w ?? ""}
                        onChange={(e) =>
                          field.handleChange(
                            (e.target.value || null) as
                              | "home"
                              | "away"
                              | null,
                          )
                        }
                        className="h-9 rounded-md border border-zinc-300 bg-white px-2 dark:border-zinc-700 dark:bg-zinc-950"
                      >
                        <option value="">— elegir —</option>
                        <option value="home">{homeLabel}</option>
                        <option value="away">{awayLabel}</option>
                      </select>
                    </div>
                  )}
                </form.Field>
              ) : null
            }
          </form.Subscribe>
        ) : null}

        {!teamsKnown ? (
          <p className="text-center text-xs text-zinc-500">
            Los equipos se conocerán cuando se resuelva la ronda anterior.
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          {mutation.isError ? (
            <span className="text-xs text-red-500">
              {(mutation.error as Error).message}
            </span>
          ) : mutation.isSuccess ? (
            <span className="text-xs text-emerald-600">Guardado</span>
          ) : null}
          <form.Subscribe
            selector={(s) => [s.canSubmit, s.isSubmitting] as const}
          >
            {([canSubmit, isSubmitting]) => (
              <Button
                type="submit"
                disabled={!canSubmit || locked || !teamsKnown}
                loading={isSubmitting}
                variant="primary"
              >
                Guardar
              </Button>
            )}
          </form.Subscribe>
        </div>
      </form>
    </article>
  );
}
