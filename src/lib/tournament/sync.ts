/**
 * Servicios de sincronización: traen datos del proveedor de fútbol
 * y los upsertan en Supabase. Pensados para correr desde route
 * handlers de cron, no desde el cliente.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getFootballProvider } from "@/lib/football/provider";
import {
  computeGroupStandings,
  pickBestThirds,
  type MatchInput,
} from "./standings";

type Supa = ReturnType<typeof createSupabaseAdminClient>;

/**
 * Sincroniza el catálogo de equipos. Idempotente (upsert por external_id).
 */
export async function syncTeams() {
  const provider = getFootballProvider();
  const supabase = createSupabaseAdminClient();

  const teams = await provider.fetchTeams();

  if (teams.length === 0) return { inserted: 0 };

  const rows = teams.map((t) => ({
    external_id: t.externalId,
    code: t.code,
    name: t.name,
    flag_emoji: t.flagEmoji ?? null,
  }));

  const { error } = await supabase
    .from("teams")
    .upsert(rows, { onConflict: "external_id" });
  if (error) throw new Error(`syncTeams: ${error.message}`);

  return { inserted: rows.length };
}

/**
 * Sincroniza el calendario completo (104 partidos). Idempotente por external_id.
 * Si todavía no se conoce un cruce eliminatorio, lo guarda con placeholders.
 */
export async function syncFixtures() {
  const provider = getFootballProvider();
  const supabase = createSupabaseAdminClient();

  // Asegurar equipos primero
  await syncTeams();

  const [teamsRes, groupsRes, matches] = await Promise.all([
    supabase.from("teams").select("id, external_id"),
    supabase.from("groups").select("id, code"),
    provider.fetchMatches(),
  ]);
  if (teamsRes.error) throw new Error(teamsRes.error.message);
  if (groupsRes.error) throw new Error(groupsRes.error.message);

  const teamByExt = new Map<string, number>();
  for (const t of teamsRes.data ?? []) {
    if (t.external_id) teamByExt.set(t.external_id, t.id);
  }
  const groupByCode = new Map<string, number>();
  for (const g of groupsRes.data ?? []) groupByCode.set(g.code, g.id);

  const rows = matches.map((m) => ({
    external_id: m.externalId,
    stage: m.stage,
    group_id: m.groupCode ? groupByCode.get(m.groupCode) ?? null : null,
    home_team_id: m.homeTeamExternalId
      ? teamByExt.get(m.homeTeamExternalId) ?? null
      : null,
    away_team_id: m.awayTeamExternalId
      ? teamByExt.get(m.awayTeamExternalId) ?? null
      : null,
    home_placeholder: m.homePlaceholder ?? null,
    away_placeholder: m.awayPlaceholder ?? null,
    kickoff_at: m.kickoffAt,
    status: m.status,
    home_score: m.homeScore ?? null,
    away_score: m.awayScore ?? null,
    home_score_pen: m.homeScorePen ?? null,
    away_score_pen: m.awayScorePen ?? null,
  }));

  // Insertar también partidos en grupo, link de group_teams
  const { error } = await supabase
    .from("matches")
    .upsert(rows, { onConflict: "external_id" });
  if (error) throw new Error(`syncFixtures: ${error.message}`);

  // Repoblar group_teams a partir de los partidos de grupo
  await rebuildGroupTeams(supabase);

  return { upserted: rows.length };
}

/**
 * Reconstruye public.group_teams a partir de los matches de grupos.
 */
async function rebuildGroupTeams(supabase: Supa) {
  const { data, error } = await supabase
    .from("matches")
    .select("group_id, home_team_id, away_team_id")
    .eq("stage", "group");
  if (error) throw new Error(error.message);

  const pairs = new Set<string>();
  for (const m of data ?? []) {
    if (!m.group_id) continue;
    if (m.home_team_id) pairs.add(`${m.group_id}:${m.home_team_id}`);
    if (m.away_team_id) pairs.add(`${m.group_id}:${m.away_team_id}`);
  }

  if (pairs.size === 0) return;

  const rows = [...pairs].map((p) => {
    const [g, t] = p.split(":").map(Number);
    return { group_id: g, team_id: t };
  });

  // Limpieza y upsert
  await supabase.from("group_teams").delete().neq("group_id", 0);
  const { error: insErr } = await supabase.from("group_teams").insert(rows);
  if (insErr && insErr.code !== "23505") throw new Error(insErr.message);
}

/**
 * Sincroniza únicamente los resultados (estado y marcador) de los
 * partidos finalizados o en juego. Mucho más liviano que syncFixtures.
 */
export async function syncResults() {
  const provider = getFootballProvider();
  const supabase = createSupabaseAdminClient();
  const matches = await provider.fetchMatches();

  let updated = 0;
  for (const m of matches) {
    if (m.status !== "finished" && m.status !== "live") continue;

    const { error } = await supabase
      .from("matches")
      .update({
        status: m.status,
        home_score: m.homeScore ?? null,
        away_score: m.awayScore ?? null,
        home_score_pen: m.homeScorePen ?? null,
        away_score_pen: m.awayScorePen ?? null,
      })
      .eq("external_id", m.externalId);
    if (!error) updated += 1;
  }

  // Tras actualizar resultados, recalcular bracket_results y avanzar cruces.
  await refreshBracketResults();

  return { updated };
}

/**
 * Calcula los equipos clasificados a cada ronda y los guarda en
 * bracket_results. Pensado para usarse después de syncResults.
 */
export async function refreshBracketResults() {
  const supabase = createSupabaseAdminClient();

  // 1) Standings de cada grupo a partir de los matches finalizados.
  const { data: groups, error: gErr } = await supabase
    .from("groups")
    .select("id, code");
  if (gErr) throw new Error(gErr.message);

  const groupStandings: { groupCode: string; standings: ReturnType<typeof computeGroupStandings> }[] = [];
  const round32Teams = new Set<number>();

  for (const g of groups ?? []) {
    const { data: matchesData, error } = await supabase
      .from("matches")
      .select(
        "home_team_id, away_team_id, home_score, away_score, status",
      )
      .eq("group_id", g.id)
      .eq("status", "finished");
    if (error) throw new Error(error.message);

    const teamIds = new Set<number>();
    const matchInputs: MatchInput[] = [];
    for (const m of matchesData ?? []) {
      if (
        m.home_team_id &&
        m.away_team_id &&
        m.home_score !== null &&
        m.away_score !== null
      ) {
        teamIds.add(m.home_team_id);
        teamIds.add(m.away_team_id);
        matchInputs.push({
          homeTeamId: m.home_team_id,
          awayTeamId: m.away_team_id,
          homeScore: m.home_score,
          awayScore: m.away_score,
        });
      }
    }

    // Necesitamos todos los equipos del grupo (incluso si no han jugado todavía).
    const { data: gt, error: gtErr } = await supabase
      .from("group_teams")
      .select("team_id")
      .eq("group_id", g.id);
    if (gtErr) throw new Error(gtErr.message);
    for (const r of gt ?? []) teamIds.add(r.team_id);

    const standings = computeGroupStandings([...teamIds], matchInputs);
    groupStandings.push({ groupCode: g.code, standings });

    // 1° y 2° al 32avos
    if (standings[0]) round32Teams.add(standings[0].teamId);
    if (standings[1]) round32Teams.add(standings[1].teamId);
  }

  // 8 mejores terceros
  for (const t of pickBestThirds(groupStandings)) {
    round32Teams.add(t.team.teamId);
  }

  // Limpiar y reescribir bracket_results para "round_of_32"
  await supabase
    .from("bracket_results")
    .delete()
    .eq("stage", "round_of_32");

  const rows = [...round32Teams].map((id) => ({
    stage: "round_of_32" as const,
    team_id: id,
  }));
  if (rows.length > 0) {
    const { error } = await supabase.from("bracket_results").insert(rows);
    if (error) throw new Error(`bracket_results r32: ${error.message}`);
  }

  // Rondas posteriores: equipos = ganadores de los partidos finalizados
  // de la ronda anterior, sólo si terminaron.
  for (const [stage, fromStage] of [
    ["round_of_16", "round_of_32"],
    ["quarter_final", "round_of_16"],
    ["semi_final", "quarter_final"],
    ["final", "semi_final"],
  ] as const) {
    const winners = await computeStageWinners(supabase, fromStage);
    await supabase.from("bracket_results").delete().eq("stage", stage);
    if (winners.length > 0) {
      const ins = winners.map((w) => ({ stage, team_id: w }));
      const { error } = await supabase.from("bracket_results").insert(ins);
      if (error) throw new Error(`bracket_results ${stage}: ${error.message}`);
    }
  }
}

async function computeStageWinners(
  supabase: Supa,
  stage:
    | "round_of_32"
    | "round_of_16"
    | "quarter_final"
    | "semi_final",
): Promise<number[]> {
  const { data, error } = await supabase
    .from("matches")
    .select(
      "home_team_id, away_team_id, home_score, away_score, home_score_pen, away_score_pen, status",
    )
    .eq("stage", stage)
    .eq("status", "finished");
  if (error) throw new Error(error.message);

  const winners: number[] = [];
  for (const m of data ?? []) {
    if (!m.home_team_id || !m.away_team_id) continue;
    if (m.home_score === null || m.away_score === null) continue;

    if (m.home_score > m.away_score) winners.push(m.home_team_id);
    else if (m.away_score > m.home_score) winners.push(m.away_team_id);
    else {
      // Empate: usar penales
      if (
        m.home_score_pen !== null &&
        m.away_score_pen !== null &&
        m.home_score_pen !== m.away_score_pen
      ) {
        winners.push(
          m.home_score_pen > m.away_score_pen
            ? m.home_team_id
            : m.away_team_id,
        );
      }
    }
  }
  return winners;
}

/**
 * Sólo para uso interno: aplica el placeholder "1A", "2C", etc. a un partido
 * de eliminación directa cuando ya se conoce el clasificado. Útil cuando la
 * API no resuelve los cruces automáticamente.
 *
 * No implementado todavía: hoy delegamos en el proveedor que ya devuelve los
 * cruces resueltos cuando están disponibles.
 */
export async function resolveBracketCrosses(): Promise<void> {
  // Stub deliberado para mantener clara la responsabilidad. Si en algún
  // momento la API no resuelve los cruces, aquí se mapearía cada
  // bracket_slot (R32-XX) a su pareja (1A/2B/...) usando bracket_results.
  return;
}
