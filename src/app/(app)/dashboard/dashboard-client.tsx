"use client";

import { useMemo, useState } from "react";
import {
  useBatchUpsertPredictions,
  useMatchesQuery,
  usePredictionsQuery,
  useQuinielasQuery,
  useCreateQuinielaMutation,
  type MatchWithTeams,
  type PredictionDraft,
} from "@/lib/queries";
import {
  PredictionRow,
  type PredictionDraftValue,
} from "@/components/prediction-row";
import { Button } from "@/components/ui/button";
import { isLocked, stageLabel } from "@/lib/format";
import { useActiveQuiniela } from "@/lib/quiniela-context";
import { PendingReminder } from "@/components/pending-reminder";

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
  return { homeScore: null, awayScore: null, winner: null };
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
  const { activeId, setActive } = useActiveQuiniela();
  const quinielas = useQuinielasQuery();
  const createQuiniela = useCreateQuinielaMutation();

  const quinielaList = quinielas.data ?? [];

  // Si aún no hay activeId (primera carga o localStorage vacío), auto-seleccionar
  // la primera quiniela disponible.
  const effectiveId: string | null = (() => {
    if (activeId && quinielaList.find((q) => q.id === activeId)) return activeId;
    if (quinielaList.length > 0) return quinielaList[0].id;
    return null;
  })();

  const matches = useMatchesQuery();
  const predictions = usePredictionsQuery(effectiveId);
  const batch = useBatchUpsertPredictions();
  const [stage, setStage] = useState<(typeof STAGES)[number]>("group");
  const [overrides, setOverrides] = useState<
    Record<number, PredictionDraftValue>
  >({});
  const [okFlash, setOkFlash] = useState(false);
  const [newName, setNewName] = useState("");
  const [showCreate, setShowCreate] = useState(false);

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

  const dirtyDrafts = useMemo<PredictionDraft[]>(() => {
    if (!matchesData) return [];
    const out: PredictionDraft[] = [];
    for (const match of matchesData) {
      const override = overrides[match.id];
      if (!override) continue;
      if (isLocked(match.kickoff_at)) continue;
      if (!match.home_team_id || !match.away_team_id) continue;
      // Scores null significan "no ingresado" → no guardar
      if (override.homeScore === null || override.awayScore === null) continue;
      const base = baseline.get(match.id);
      if (base && draftsEqual(base, override)) continue;
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

  const dirtyMatchIds = useMemo(
    () => new Set(dirtyDrafts.map((d) => d.matchId)),
    [dirtyDrafts],
  );

  if (matches.isLoading || quinielas.isLoading) {
    return <p className="text-sm text-zinc-500">Cargando…</p>;
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
    if (dirtyDrafts.length === 0 || !effectiveId) return;
    try {
      await batch.mutateAsync({ quinielaId: effectiveId, drafts: dirtyDrafts });
      setOkFlash(true);
      setTimeout(() => setOkFlash(false), 1800);
    } catch {
      // el mensaje se expone abajo en SaveBar
    }
  };

  const onDiscard = () => setOverrides({});

  const onCreateQuiniela = async () => {
    const name = newName.trim() || "Mi quiniela";
    const q = await createQuiniela.mutateAsync(name);
    setActive(q.id);
    setNewName("");
    setShowCreate(false);
    setOverrides({});
  };

  return (
    <div className="flex flex-col gap-5 pb-28">
      {/* Recordatorio de partidos pendientes */}
      {matchesData && (
        <PendingReminder
          matches={matchesData}
          predictedMatchIds={new Set(baseline.keys())}
          onGoToStage={(s) => setStage(s as (typeof STAGES)[number])}
        />
      )}

      {/* Selector de quiniela */}
      <QuinielaSelector
        quinielas={quinielaList}
        activeId={effectiveId}
        onSelect={(id) => {
          setActive(id);
          setOverrides({});
        }}
        showCreate={showCreate}
        onToggleCreate={() => setShowCreate((v) => !v)}
        newName={newName}
        onNewNameChange={setNewName}
        onCreateSubmit={onCreateQuiniela}
        creating={createQuiniela.isPending}
      />

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
          dirtyMatchIds={dirtyMatchIds}
        />
      ) : (
        <KnockoutView
          matches={filtered}
          draftFor={draftFor}
          baseline={baseline}
          pointsByMatch={pointsByMatch}
          onChangeFor={setDraft}
          dirtyMatchIds={dirtyMatchIds}
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

// ---------------------------------------------------------------------------
// Selector de quiniela
// ---------------------------------------------------------------------------
function QuinielaSelector({
  quinielas,
  activeId,
  onSelect,
  showCreate,
  onToggleCreate,
  newName,
  onNewNameChange,
  onCreateSubmit,
  creating,
}: {
  quinielas: { id: string; name: string }[];
  activeId: string | null;
  onSelect: (id: string) => void;
  showCreate: boolean;
  onToggleCreate: () => void;
  newName: string;
  onNewNameChange: (v: string) => void;
  onCreateSubmit: () => void;
  creating: boolean;
}) {
  if (quinielas.length === 0 && !showCreate) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-zinc-500">Quiniela:</span>
      {quinielas.map((q) => (
        <button
          key={q.id}
          onClick={() => onSelect(q.id)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            q.id === activeId
              ? "bg-emerald-600 text-white"
              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          }`}
        >
          {q.name}
        </button>
      ))}
      {showCreate ? (
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            type="text"
            placeholder="Nombre de la quiniela"
            value={newName}
            onChange={(e) => onNewNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCreateSubmit();
              if (e.key === "Escape") onToggleCreate();
            }}
            className="h-7 rounded-lg border border-zinc-300 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            onClick={onCreateSubmit}
            disabled={creating}
            className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {creating ? "…" : "Crear"}
          </button>
          <button
            onClick={onToggleCreate}
            className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          onClick={onToggleCreate}
          className="rounded-full border border-dashed border-zinc-300 px-3 py-1 text-xs text-zinc-500 hover:border-emerald-400 hover:text-emerald-600 dark:border-zinc-700"
        >
          + Nueva quiniela
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GroupStageView / KnockoutView / CollapsibleSection
// ---------------------------------------------------------------------------
function GroupStageView({
  matches,
  baseline,
  pointsByMatch,
  onChangeFor,
  draftFor,
  dirtyMatchIds,
}: {
  matches: MatchWithTeams[];
  draftFor: (id: number) => PredictionDraftValue;
  baseline: Map<number, PredictionDraftValue>;
  pointsByMatch: Map<number, number | null>;
  onChangeFor: (id: number) => (v: PredictionDraftValue) => void;
  dirtyMatchIds: Set<number>;
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
    <div className="grid gap-3 md:grid-cols-2">
      {groups.map(([code, ms]) => {
        const sorted = [...ms].sort((a, b) =>
          a.kickoff_at.localeCompare(b.kickoff_at),
        );
        const groupDirty = sorted.filter((m) => dirtyMatchIds.has(m.id)).length;
        const groupPredicted = sorted.filter(
          (m) => baseline.has(m.id),
        ).length;
        return (
          <CollapsibleSection
            key={code}
            title={`Grupo ${code}`}
            subtitle={`${groupPredicted}/${sorted.length} predichos`}
            dirtyCount={groupDirty}
          >
            <div className="flex flex-col gap-2 p-2">
              {sorted.map((m) => {
                const draft = draftFor(m.id);
                const base = baseline.get(m.id);
                const dirty = !!base
                  ? !draftsEqual(base, draft)
                  : draft.homeScore !== null ||
                    draft.awayScore !== null ||
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
          </CollapsibleSection>
        );
      })}
    </div>
  );
}

/**
 * Sección colapsable nativa con <details>.
 *
 * Correcciones mobile:
 * 1. El estado abierto/cerrado se gestiona con useState + onToggle en lugar de
 *    depender del prop `open={defaultOpen}` estático. Sin esto, cada re-render
 *    de React (p.ej. al pulsar +/-) forzaba el cierre de la sección.
 * 2. El <summary> NO lleva `display:flex` directamente — en iOS Safari < 15.4
 *    ese estilo rompe el toggle nativo de <details>. El flex se mueve a un
 *    <div> interno para mantener el mismo layout visual.
 */
function CollapsibleSection({
  title,
  subtitle,
  dirtyCount,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  dirtyCount?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <details
      open={isOpen}
      onToggle={(e) =>
        setIsOpen((e.currentTarget as HTMLDetailsElement).open)
      }
      className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm open:bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900 dark:open:bg-zinc-950/40"
    >
      <summary className="cursor-pointer list-none px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-950/40">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <span className="text-base font-semibold">{title}</span>
            {subtitle ? (
              <span className="text-xs font-normal text-zinc-500">
                {subtitle}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {dirtyCount && dirtyCount > 0 ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                {dirtyCount} sin guardar
              </span>
            ) : null}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
              className="h-4 w-4 text-zinc-500 transition-transform group-open:rotate-180"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 011.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>
      </summary>
      {children}
    </details>
  );
}

function KnockoutView({
  matches,
  baseline,
  pointsByMatch,
  onChangeFor,
  draftFor,
  dirtyMatchIds,
}: {
  matches: MatchWithTeams[];
  draftFor: (id: number) => PredictionDraftValue;
  baseline: Map<number, PredictionDraftValue>;
  pointsByMatch: Map<number, number | null>;
  onChangeFor: (id: number) => (v: PredictionDraftValue) => void;
  dirtyMatchIds: Set<number>;
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
    <div className="flex flex-col gap-3">
      {days.map(([day, ms]) => {
        const label = capitalize(dateFmt.format(new Date(`${day}T12:00:00Z`)));
        const sorted = [...ms].sort((a, b) =>
          a.kickoff_at.localeCompare(b.kickoff_at),
        );
        const dayDirty = sorted.filter((m) => dirtyMatchIds.has(m.id)).length;
        const predicted = sorted.filter((m) => baseline.has(m.id)).length;
        return (
          <CollapsibleSection
            key={day}
            title={label}
            subtitle={`${predicted}/${sorted.length} predichos`}
            dirtyCount={dayDirty}
            defaultOpen
          >
            <div className="grid gap-2 p-2 md:grid-cols-2">
              {sorted.map((m) => {
                const draft = draftFor(m.id);
                const base = baseline.get(m.id);
                const dirty = !!base
                  ? !draftsEqual(base, draft)
                  : draft.homeScore !== null ||
                    draft.awayScore !== null ||
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
          </CollapsibleSection>
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
