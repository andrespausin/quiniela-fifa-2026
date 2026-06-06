"use client";

import type { MatchWithTeams } from "@/lib/queries";
import { formatKickoff, isLocked, timeLeftLabel } from "@/lib/format";

export interface PredictionDraftValue {
  homeScore: number | null;
  awayScore: number | null;
  winner: "home" | "away" | "draw" | null;
}

interface Props {
  match: MatchWithTeams;
  draft: PredictionDraftValue;
  savedPoints?: number | null;
  dirty: boolean;
  onChange: (next: PredictionDraftValue) => void;
}

/**
 * Tarjeta de predicción mobile-first.
 * - Stack vertical en mobile (cada equipo en su fila) — más fácil de tap
 * - Banderas y nombres grandes
 * - Mismo layout en desktop (legible y consistente)
 */
export function PredictionRow({
  match,
  draft,
  savedPoints,
  dirty,
  onChange,
}: Props) {
  const locked = isLocked(match.kickoff_at);
  const teamsKnown = Boolean(match.home_team && match.away_team);
  const showPenalty =
    match.stage !== "group" &&
    draft.homeScore !== null &&
    draft.homeScore === draft.awayScore;

  const homeFlag = match.home_team?.flag_emoji ?? "";
  const awayFlag = match.away_team?.flag_emoji ?? "";
  const homeName =
    match.home_team?.name ?? match.home_placeholder ?? "Por definir";
  const awayName =
    match.away_team?.name ?? match.away_placeholder ?? "Por definir";

  return (
    <article
      className={`flex flex-col gap-3 rounded-2xl border bg-white px-4 py-3 transition-colors dark:bg-zinc-900 ${
        dirty
          ? "border-amber-400 bg-amber-50/40 dark:border-amber-700 dark:bg-amber-950/20"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <header className="flex items-center justify-between gap-2 text-xs">
        <span className="text-zinc-500">{formatKickoff(match.kickoff_at)}</span>
        <div className="flex items-center gap-2">
          {savedPoints !== null && savedPoints !== undefined ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              {savedPoints} pt{savedPoints === 1 ? "" : "s"}
            </span>
          ) : null}
          {locked ? (
            <span className="rounded-full bg-zinc-200 px-2 py-0.5 font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              Cerrado
            </span>
          ) : (
            <span className="font-medium text-zinc-500">
              {timeLeftLabel(match.kickoff_at)}
            </span>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-2">
        <TeamRow
          flag={homeFlag}
          name={homeName}
          value={draft.homeScore}
          disabled={locked || !teamsKnown}
          onChange={(v) => onChange({ ...draft, homeScore: v })}
        />
        <TeamRow
          flag={awayFlag}
          name={awayName}
          value={draft.awayScore}
          disabled={locked || !teamsKnown}
          onChange={(v) => onChange({ ...draft, awayScore: v })}
        />
      </div>

      {showPenalty ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-950">
          <span className="text-zinc-600 dark:text-zinc-300">
            Gana por penales:
          </span>
          <select
            disabled={locked || !teamsKnown}
            value={draft.winner ?? ""}
            onChange={(e) =>
              onChange({
                ...draft,
                winner: (e.target.value || null) as "home" | "away" | null,
              })
            }
            className="h-9 min-w-32 rounded-md border border-zinc-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">— elegir —</option>
            <option value="home">{homeName}</option>
            <option value="away">{awayName}</option>
          </select>
        </div>
      ) : null}

      {!teamsKnown ? (
        <p className="text-center text-xs text-zinc-500">
          Los equipos se conocerán cuando se resuelva la ronda anterior.
        </p>
      ) : null}
    </article>
  );
}

function TeamRow({
  flag,
  name,
  value,
  disabled,
  onChange,
}: {
  flag: string;
  name: string;
  value: number | null;
  disabled?: boolean;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-3xl leading-none sm:text-4xl">{flag || "🏳️"}</span>
        <span className="truncate text-base font-semibold sm:text-lg">
          {name}
        </span>
      </div>
      <Stepper value={value} disabled={disabled} onChange={onChange} />
    </div>
  );
}

function Stepper({
  value,
  disabled,
  onChange,
}: {
  value: number | null;
  disabled?: boolean;
  onChange: (v: number | null) => void;
}) {
  // null → "–" (no ingresado). + arranca desde 0. − en 0 vuelve a null.
  const dec = () => {
    if (value === null) return;
    onChange(value === 0 ? null : value - 1);
  };
  const inc = () => onChange(value === null ? 0 : Math.min(30, value + 1));

  return (
    <div className="flex items-center gap-1 sm:gap-1.5">
      <button
        type="button"
        aria-label="Restar gol"
        disabled={disabled || value === null}
        onClick={dec}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-300 bg-white text-xl font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
      >
        −
      </button>

      {/* Muestra "–" si aún no se ha ingresado, input numérico si ya hay valor */}
      {value === null ? (
        <div className="flex h-10 w-12 items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white text-lg text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950">
          –
        </div>
      ) : (
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={30}
          disabled={disabled}
          aria-label="Goles"
          value={value}
          onChange={(e) => {
            const n = e.target.valueAsNumber;
            onChange(Number.isFinite(n) ? Math.max(0, Math.min(30, n)) : 0);
          }}
          className="h-10 w-12 rounded-lg border border-zinc-300 bg-white text-center text-lg font-bold tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:disabled:bg-zinc-900"
        />
      )}

      <button
        type="button"
        aria-label="Sumar gol"
        disabled={disabled || (value !== null && value >= 30)}
        onClick={inc}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-300 bg-white text-xl font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
      >
        +
      </button>
    </div>
  );
}
