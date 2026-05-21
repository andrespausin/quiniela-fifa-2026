"use client";

import { useMemo } from "react";
import { useMatchesQuery, type MatchWithTeams } from "@/lib/queries";
import {
  computeGroupStandings,
  pickBestThirds,
  type MatchInput,
  type TeamStanding,
} from "@/lib/tournament/standings";
import { formatKickoff, stageLabel } from "@/lib/format";

export function EliminatoriasClient() {
  const { data, isLoading, error } = useMatchesQuery();

  const grouped = useMemo(() => groupByGroup(data ?? []), [data]);
  const knockout = useMemo(() => buildKnockout(data ?? []), [data]);
  const thirds = useMemo(() => buildBestThirds(grouped), [grouped]);

  if (isLoading) {
    return <p className="text-sm text-zinc-500">Cargando…</p>;
  }
  if (error) {
    return (
      <p className="text-sm text-red-500">
        Error: {(error as Error).message}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="mb-3 text-lg font-semibold">Tablas de grupos</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {grouped.map((g) => (
            <GroupTable key={g.code} code={g.code} standings={g.standings} />
          ))}
        </div>
        {thirds.length > 0 ? (
          <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-2 text-sm font-semibold">8 mejores terceros</h3>
            <ol className="grid gap-1 text-sm sm:grid-cols-2">
              {thirds.map((t, i) => (
                <li
                  key={`${t.groupCode}-${t.team.teamId}`}
                  className="flex items-center gap-2"
                >
                  <span className="w-6 text-zinc-500">{i + 1}.</span>
                  <span className="font-medium">
                    Grupo {t.groupCode}
                  </span>
                  <span className="text-zinc-500">
                    · {t.team.points} pts · DG {t.team.goalDifference}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </section>

      {knockout.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Eliminación directa</h2>
          <div className="grid gap-3">
            {knockout.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <span className="font-medium uppercase text-zinc-500">
                  {stageLabel[m.stage]}
                  {m.bracket_slot ? ` · ${m.bracket_slot}` : ""}
                </span>
                <span className="flex-1 text-center font-medium">
                  {m.home_team?.flag_emoji ?? ""}{" "}
                  {m.home_team?.name ?? m.home_placeholder ?? "Por definir"}{" "}
                  <span className="text-zinc-400">vs</span>{" "}
                  {m.away_team?.flag_emoji ?? ""}{" "}
                  {m.away_team?.name ?? m.away_placeholder ?? "Por definir"}
                </span>
                <span className="text-xs text-zinc-500">
                  {formatKickoff(m.kickoff_at)}
                </span>
                {m.home_score !== null && m.away_score !== null ? (
                  <span className="font-mono text-base font-semibold tabular-nums">
                    {m.home_score} - {m.away_score}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function GroupTable({
  code,
  standings,
}: {
  code: string;
  standings: TeamStanding[];
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-2 text-sm font-semibold">Grupo {code}</h3>
      <table className="w-full text-xs">
        <thead className="text-zinc-500">
          <tr>
            <th className="text-left">Equipo</th>
            <th className="text-right">PJ</th>
            <th className="text-right">G</th>
            <th className="text-right">E</th>
            <th className="text-right">P</th>
            <th className="text-right">DG</th>
            <th className="text-right">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => (
            <tr
              key={s.teamId}
              className={
                i < 2
                  ? "bg-emerald-50 dark:bg-emerald-950/40"
                  : i === 2
                    ? "bg-amber-50 dark:bg-amber-950/30"
                    : ""
              }
            >
              <td className="py-1 pr-2 font-medium">
                {(s as TeamStanding & { name?: string }).name ??
                  `#${s.teamId}`}
              </td>
              <td className="py-1 text-right tabular-nums">{s.played}</td>
              <td className="py-1 text-right tabular-nums">{s.wins}</td>
              <td className="py-1 text-right tabular-nums">{s.draws}</td>
              <td className="py-1 text-right tabular-nums">{s.losses}</td>
              <td className="py-1 text-right tabular-nums">
                {s.goalDifference}
              </td>
              <td className="py-1 text-right font-semibold tabular-nums">
                {s.points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function groupByGroup(matches: MatchWithTeams[]) {
  const teamName = new Map<number, string>();
  for (const m of matches) {
    if (m.home_team) teamName.set(m.home_team.id, m.home_team.name);
    if (m.away_team) teamName.set(m.away_team.id, m.away_team.name);
  }

  const groups = new Map<
    string,
    { teamIds: Set<number>; played: MatchInput[] }
  >();
  for (const m of matches) {
    if (m.stage !== "group" || !m.group?.code) continue;
    const code = m.group.code;
    const slot = groups.get(code) ?? {
      teamIds: new Set<number>(),
      played: [] as MatchInput[],
    };
    if (m.home_team_id) slot.teamIds.add(m.home_team_id);
    if (m.away_team_id) slot.teamIds.add(m.away_team_id);
    if (
      m.status === "finished" &&
      m.home_team_id &&
      m.away_team_id &&
      m.home_score !== null &&
      m.away_score !== null
    ) {
      slot.played.push({
        homeTeamId: m.home_team_id,
        awayTeamId: m.away_team_id,
        homeScore: m.home_score,
        awayScore: m.away_score,
      });
    }
    groups.set(code, slot);
  }

  const out = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, slot]) => {
      const st = computeGroupStandings([...slot.teamIds], slot.played);
      const named = st.map((s) => ({ ...s, name: teamName.get(s.teamId) }));
      return { code, standings: named as TeamStanding[] };
    });

  return out;
}

function buildKnockout(matches: MatchWithTeams[]) {
  return matches
    .filter((m) => m.stage !== "group")
    .sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at));
}

function buildBestThirds(
  grouped: { code: string; standings: TeamStanding[] }[],
) {
  return pickBestThirds(
    grouped.map((g) => ({ groupCode: g.code, standings: g.standings })),
  );
}
