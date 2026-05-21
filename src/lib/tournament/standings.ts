/**
 * Cálculo matemático de las tablas de grupos del Mundial 2026.
 *
 * Criterios de desempate (FIFA, orden):
 *   1. Puntos
 *   2. Diferencia de goles
 *   3. Goles a favor
 *   4. Resultado(s) particular(es) entre los implicados:
 *      4a. Puntos en partidos directos
 *      4b. Diferencia de goles en partidos directos
 *      4c. Goles a favor en partidos directos
 *   5. (FIFA Fair Play / sorteo) — fuera del alcance del cálculo automático
 *
 * Si tras todos los criterios persiste empate se rompe por orden
 * alfabético del código de equipo como fallback determinístico.
 */

export interface TeamStanding {
  teamId: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface MatchInput {
  homeTeamId: number;
  awayTeamId: number;
  homeScore: number;
  awayScore: number;
}

/**
 * Devuelve la tabla del grupo ordenada (1º .. 4º).
 * Si dos equipos siguen empatados tras los criterios FIFA, se rompe
 * por menor teamId como fallback determinístico.
 */
export function computeGroupStandings(
  teamIds: number[],
  matches: MatchInput[],
): TeamStanding[] {
  const base = new Map<number, TeamStanding>();
  for (const id of teamIds) {
    base.set(id, {
      teamId: id,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    });
  }

  for (const m of matches) {
    const home = base.get(m.homeTeamId);
    const away = base.get(m.awayTeamId);
    if (!home || !away) continue;
    home.played += 1;
    away.played += 1;
    home.goalsFor += m.homeScore;
    home.goalsAgainst += m.awayScore;
    away.goalsFor += m.awayScore;
    away.goalsAgainst += m.homeScore;
    if (m.homeScore > m.awayScore) {
      home.wins += 1;
      home.points += 3;
      away.losses += 1;
    } else if (m.homeScore < m.awayScore) {
      away.wins += 1;
      away.points += 3;
      home.losses += 1;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
    }
  }
  for (const s of base.values()) {
    s.goalDifference = s.goalsFor - s.goalsAgainst;
  }

  const all = [...base.values()];
  return sortGroup(all, matches);
}

function sortGroup(
  standings: TeamStanding[],
  matches: MatchInput[],
): TeamStanding[] {
  return [...standings].sort((a, b) => compareTwo(a, b, standings, matches));
}

function compareTwo(
  a: TeamStanding,
  b: TeamStanding,
  fullGroup: TeamStanding[],
  matches: MatchInput[],
): number {
  // 1-3: criterios globales
  if (b.points !== a.points) return b.points - a.points;
  if (b.goalDifference !== a.goalDifference) {
    return b.goalDifference - a.goalDifference;
  }
  if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;

  // 4: criterios particulares — buscar el cluster de empatados
  //    en los tres criterios globales.
  const tiedCluster = fullGroup.filter(
    (s) =>
      s.points === a.points &&
      s.goalDifference === a.goalDifference &&
      s.goalsFor === a.goalsFor,
  );

  if (tiedCluster.length >= 2) {
    const tieIds = new Set(tiedCluster.map((s) => s.teamId));
    const mini = computeMiniStandings(matches, tieIds);
    const ma = mini.get(a.teamId);
    const mb = mini.get(b.teamId);
    if (ma && mb) {
      if (mb.points !== ma.points) return mb.points - ma.points;
      if (mb.goalDifference !== ma.goalDifference) {
        return mb.goalDifference - ma.goalDifference;
      }
      if (mb.goalsFor !== ma.goalsFor) return mb.goalsFor - ma.goalsFor;
    }
  }

  // 5: fallback determinístico
  return a.teamId - b.teamId;
}

function computeMiniStandings(
  matches: MatchInput[],
  tiedIds: Set<number>,
): Map<number, TeamStanding> {
  const mini = new Map<number, TeamStanding>();
  for (const id of tiedIds) {
    mini.set(id, {
      teamId: id,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    });
  }
  for (const m of matches) {
    if (!tiedIds.has(m.homeTeamId) || !tiedIds.has(m.awayTeamId)) continue;
    const h = mini.get(m.homeTeamId)!;
    const a = mini.get(m.awayTeamId)!;
    h.played += 1;
    a.played += 1;
    h.goalsFor += m.homeScore;
    h.goalsAgainst += m.awayScore;
    a.goalsFor += m.awayScore;
    a.goalsAgainst += m.homeScore;
    if (m.homeScore > m.awayScore) {
      h.wins += 1;
      h.points += 3;
      a.losses += 1;
    } else if (m.homeScore < m.awayScore) {
      a.wins += 1;
      a.points += 3;
      h.losses += 1;
    } else {
      h.draws += 1;
      a.draws += 1;
      h.points += 1;
      a.points += 1;
    }
  }
  for (const s of mini.values()) {
    s.goalDifference = s.goalsFor - s.goalsAgainst;
  }
  return mini;
}

/**
 * Dadas las tablas finales de los 12 grupos, devuelve los 8 mejores
 * terceros aplicando los criterios FIFA (puntos, dif. gol, goles a favor)
 * y fallback determinístico por teamId.
 */
export function pickBestThirds(
  groupStandings: { groupCode: string; standings: TeamStanding[] }[],
): { groupCode: string; team: TeamStanding }[] {
  const thirds = groupStandings
    .map((g) => ({ groupCode: g.groupCode, team: g.standings[2] }))
    .filter((t) => Boolean(t.team));

  thirds.sort((a, b) => {
    if (b.team.points !== a.team.points) return b.team.points - a.team.points;
    if (b.team.goalDifference !== a.team.goalDifference) {
      return b.team.goalDifference - a.team.goalDifference;
    }
    if (b.team.goalsFor !== a.team.goalsFor) {
      return b.team.goalsFor - a.team.goalsFor;
    }
    return a.team.teamId - b.team.teamId;
  });

  return thirds.slice(0, 8);
}
