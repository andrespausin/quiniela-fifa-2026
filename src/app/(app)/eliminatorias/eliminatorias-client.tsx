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
                className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-semibold uppercase tracking-wide text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                    {stageLabel[m.stage]}
                    {m.bracket_slot ? ` · ${m.bracket_slot}` : ""}
                  </span>
                  <span className="text-zinc-500">
                    {formatKickoff(m.kickoff_at)}
                  </span>
                </div>
                <div className="flex flex-1 items-center justify-center gap-3 text-base sm:text-lg">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="text-2xl sm:text-3xl">
                      {m.home_team?.flag_emoji ?? "🏳️"}
                    </span>
                    <span className="truncate font-semibold">
                      {m.home_team?.name ?? m.home_placeholder ?? "Por definir"}
                    </span>
                  </span>
                  {m.home_score !== null && m.away_score !== null ? (
                    <span className="font-mono text-xl font-bold tabular-nums">
                      {m.home_score} - {m.away_score}
                    </span>
                  ) : (
                    <span className="text-zinc-400">vs</span>
                  )}
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-semibold">
                      {m.away_team?.name ?? m.away_placeholder ?? "Por definir"}
                    </span>
                    <span className="text-2xl sm:text-3xl">
                      {m.away_team?.flag_emoji ?? "🏳️"}
                    </span>
                  </span>
                </div>
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
  standings: (TeamStanding & { name?: string; flag?: string })[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="border-b border-zinc-200 px-3 py-2 text-base font-semibold dark:border-zinc-800">
        Grupo {code}
      </h3>
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-950">
          <tr>
            <th className="px-3 py-1.5 text-left">Equipo</th>
            <th className="px-1.5 py-1.5 text-right">PJ</th>
            <th className="hidden px-1.5 py-1.5 text-right sm:table-cell">G</th>
            <th className="hidden px-1.5 py-1.5 text-right sm:table-cell">E</th>
            <th className="hidden px-1.5 py-1.5 text-right sm:table-cell">P</th>
            <th className="px-1.5 py-1.5 text-right">DG</th>
            <th className="px-3 py-1.5 text-right">Pts</th>
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
              <td className="px-3 py-2 font-medium">
                <span className="mr-2 text-lg">{s.flag ?? ""}</span>
                {s.name ?? `#${s.teamId}`}
              </td>
              <td className="px-1.5 py-2 text-right tabular-nums">
                {s.played}
              </td>
              <td className="hidden px-1.5 py-2 text-right tabular-nums sm:table-cell">
                {s.wins}
              </td>
              <td className="hidden px-1.5 py-2 text-right tabular-nums sm:table-cell">
                {s.draws}
              </td>
              <td className="hidden px-1.5 py-2 text-right tabular-nums sm:table-cell">
                {s.losses}
              </td>
              <td className="px-1.5 py-2 text-right tabular-nums">
                {s.goalDifference}
              </td>
              <td className="px-3 py-2 text-right font-bold tabular-nums">
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
  const teamFlag = new Map<number, string>();
  for (const m of matches) {
    if (m.home_team) {
      teamName.set(m.home_team.id, m.home_team.name);
      if (m.home_team.flag_emoji) teamFlag.set(m.home_team.id, m.home_team.flag_emoji);
    }
    if (m.away_team) {
      teamName.set(m.away_team.id, m.away_team.name);
      if (m.away_team.flag_emoji) teamFlag.set(m.away_team.id, m.away_team.flag_emoji);
    }
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
      const named = st.map((s) => ({
        ...s,
        name: teamName.get(s.teamId),
        flag: teamFlag.get(s.teamId),
      }));
      return { code, standings: named };
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
