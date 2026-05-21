"use client";

import { useMemo, useState } from "react";
import {
  useBatchUpsertPredictions,
  useMatchesQuery,
  usePredictionsQuery,
  type MatchWithTeams,
  type PredictionDraft,
} from "@/lib/queries";
import {
  PredictionRow,
  type PredictionDraftValue,
} from "@/components/prediction-row";
import { Button } from "@/components/ui/button";
import { isLocked, stageLabel } from "@/lib/format";

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

function emptyDraft(): PredictionDraftValue {
  return { homeScore: 0, awayScore: 0, winner: null };
}

function draftFromServer(p?: {
  home_score: number;
  away_score: number;
  winner: "home" | "away" | "draw" | null;
}): PredictionDraftValue {
  if (!p) return emptyDraft();
  return {
    homeScore: p.home_score,
    awayScore: p.away_score,
    winner: p.winner,
  };
}

function draftsEqual(a: PredictionDraftValue, b: PredictionDraftValue) {
  return (
    a.homeScore === b.homeScore &&
    a.awayScore === b.awayScore &&
    (a.winner ?? null) === (b.winner ?? null)
  );
}

export function DashboardClient() {
  const matches = useMatchesQuery();
  const predictions = usePredictionsQuery();
  const batch = useBatchUpsertPredictions();
  const [stage, setStage] = useState<(typeof STAGES)[number]>("group");
  // Sólo entradas que el usuario tocó. El valor "efectivo" siempre se
  // calcula como override ?? baseline ?? emptyDraft, así no necesitamos
  // sincronizar via useEffect.
  const [overrides, setOverrides] = useState<
    Record<number, PredictionDraftValue>
  >({});
  const [okFlash, setOkFlash] = useState(false);

  const predictionsData = predictions.data;
  const matchesData = matches.data;

  const baseline = useMemo(() => {
    const m = new Map<number, PredictionDraftValue>();
    for (const p of predictionsData ?? []) {
      m.set(p.match_id, draftFromServer(p));
    }
    return m;
  }, [predictionsData]);

  const pointsByMatch = useMemo(() => {
    const m = new Map<number, number | null>();
    for (const p of predictionsData ?? []) m.set(p.match_id, p.points);
    return m;
  }, [predictionsData]);

  const draftFor = (matchId: number): PredictionDraftValue =>
    overrides[matchId] ?? baseline.get(matchId) ?? emptyDraft();

  const setDraft =
    (matchId: number) => (value: PredictionDraftValue) =>
      setOverrides((prev) => ({ ...prev, [matchId]: value }));

  // Cambios listos para guardar (excluye bloqueados y partidos sin equipos).
  const dirtyDrafts = useMemo<PredictionDraft[]>(() => {
    if (!matchesData) return [];
    const out: PredictionDraft[] = [];
    for (const match of matchesData) {
      const override = overrides[match.id];
      if (!override) continue;
      if (isLocked(match.kickoff_at)) continue;
      if (!match.home_team_id || !match.away_team_id) continue;
      const base = baseline.get(match.id);
      if (base && draftsEqual(base, override)) continue;
      if (
        !base &&
        override.homeScore === 0 &&
        override.awayScore === 0 &&
        !override.winner
      ) {
        continue;
      }
      out.push({
        matchId: match.id,
        homeScore: override.homeScore,
        awayScore: override.awayScore,
        winner: match.stage === "group" ? null : override.winner,
      });
    }
    return out;
  }, [overrides, matchesData, baseline]);

  const filtered = useMemo(
    () => (matchesData ?? []).filter((m) => m.stage === stage),
    [matchesData, stage],
  );

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
  if ((matchesData ?? []).length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
        Aún no se han cargado los partidos. Pídele al organizador que ejecute{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
          npm run sync:fixtures
        </code>
        .
      </div>
    );
  }

  const onSave = async () => {
    if (dirtyDrafts.length === 0) return;
    try {
      await batch.mutateAsync(dirtyDrafts);
      setOkFlash(true);
      setTimeout(() => setOkFlash(false), 1800);
    } catch {
      // el mensaje se expone abajo en SaveBar
    }
  };

  const onDiscard = () => setOverrides({});

  return (
    <div className="flex flex-col gap-5 pb-28">
      <div className="flex flex-wrap gap-1.5">
        {STAGES.map((s) => {
          const count = (matchesData ?? []).filter((m) => m.stage === s).length;
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

      {stage === "group" ? (
        <GroupStageView
          matches={filtered}
          draftFor={draftFor}
          baseline={baseline}
          pointsByMatch={pointsByMatch}
          onChangeFor={setDraft}
        />
      ) : (
        <KnockoutView
          matches={filtered}
          draftFor={draftFor}
          baseline={baseline}
          pointsByMatch={pointsByMatch}
          onChangeFor={setDraft}
        />
      )}

      <SaveBar
        dirtyCount={dirtyDrafts.length}
        saving={batch.isPending}
        error={batch.error ? (batch.error as Error).message : null}
        success={okFlash}
        onSave={onSave}
        onDiscard={onDiscard}
      />
    </div>
  );
}

function GroupStageView({
  matches,
  baseline,
  pointsByMatch,
  onChangeFor,
  draftFor,
}: {
  matches: MatchWithTeams[];
  draftFor: (id: number) => PredictionDraftValue;
  baseline: Map<number, PredictionDraftValue>;
  pointsByMatch: Map<number, number | null>;
  onChangeFor: (id: number) => (v: PredictionDraftValue) => void;
}) {
  const byGroup = new Map<string, MatchWithTeams[]>();
  for (const m of matches) {
    const code = m.group?.code ?? "?";
    const list = byGroup.get(code) ?? [];
    list.push(m);
    byGroup.set(code, list);
  }
  const groups = [...byGroup.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {groups.map(([code, ms]) => {
        const sorted = [...ms].sort((a, b) =>
          a.kickoff_at.localeCompare(b.kickoff_at),
        );
        return (
          <section
            key={code}
            className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-950/40"
          >
            <header className="border-b border-zinc-200 bg-white px-4 py-2 text-sm font-semibold dark:border-zinc-800 dark:bg-zinc-900">
              Grupo {code}
              <span className="ml-2 text-xs font-normal text-zinc-500">
                {sorted.length} partidos
              </span>
            </header>
            <div className="flex flex-col gap-2 p-2">
              {sorted.map((m) => {
                const draft = draftFor(m.id);
                const base = baseline.get(m.id);
                const dirty = !!base
                  ? !draftsEqual(base, draft)
                  : draft.homeScore !== 0 ||
                    draft.awayScore !== 0 ||
                    !!draft.winner;
                return (
                  <PredictionRow
                    key={m.id}
                    match={m}
                    draft={draft}
                    savedPoints={pointsByMatch.get(m.id) ?? null}
                    dirty={dirty}
                    onChange={onChangeFor(m.id)}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function KnockoutView({
  matches,
  baseline,
  pointsByMatch,
  onChangeFor,
  draftFor,
}: {
  matches: MatchWithTeams[];
  draftFor: (id: number) => PredictionDraftValue;
  baseline: Map<number, PredictionDraftValue>;
  pointsByMatch: Map<number, number | null>;
  onChangeFor: (id: number) => (v: PredictionDraftValue) => void;
}) {
  const byDay = new Map<string, MatchWithTeams[]>();
  for (const m of matches) {
    const dayKey = m.kickoff_at.slice(0, 10);
    const list = byDay.get(dayKey) ?? [];
    list.push(m);
    byDay.set(dayKey, list);
  }
  const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="flex flex-col gap-5">
      {days.map(([day, ms]) => {
        const label = capitalize(dateFmt.format(new Date(`${day}T12:00:00Z`)));
        const sorted = [...ms].sort((a, b) =>
          a.kickoff_at.localeCompare(b.kickoff_at),
        );
        return (
          <section key={day} className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              {label}
            </h3>
            <div className="grid gap-2 md:grid-cols-2">
              {sorted.map((m) => {
                const draft = draftFor(m.id);
                const base = baseline.get(m.id);
                const dirty = !!base
                  ? !draftsEqual(base, draft)
                  : draft.homeScore !== 0 ||
                    draft.awayScore !== 0 ||
                    !!draft.winner;
                return (
                  <PredictionRow
                    key={m.id}
                    match={m}
                    draft={draft}
                    savedPoints={pointsByMatch.get(m.id) ?? null}
                    dirty={dirty}
                    onChange={onChangeFor(m.id)}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function SaveBar({
  dirtyCount,
  saving,
  error,
  success,
  onSave,
  onDiscard,
}: {
  dirtyCount: number;
  saving: boolean;
  error: string | null;
  success: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const enabled = dirtyCount > 0 && !saving;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <div className="text-sm">
          {error ? (
            <span className="text-red-600 dark:text-red-400">{error}</span>
          ) : success ? (
            <span className="text-emerald-600 dark:text-emerald-400">
              ✓ Guardado
            </span>
          ) : dirtyCount > 0 ? (
            <span>
              <strong>{dirtyCount}</strong>{" "}
              {dirtyCount === 1 ? "cambio pendiente" : "cambios pendientes"}
            </span>
          ) : (
            <span className="text-zinc-500">Sin cambios pendientes</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {dirtyCount > 0 ? (
            <button
              onClick={onDiscard}
              type="button"
              className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Descartar
            </button>
          ) : null}
          <Button
            onClick={onSave}
            disabled={!enabled}
            loading={saving}
            variant="primary"
          >
            Guardar predicciones
          </Button>
        </div>
      </div>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
