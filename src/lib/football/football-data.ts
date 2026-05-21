/**
 * Proveedor football-data.org (Free Tier).
 * Docs: https://www.football-data.org/documentation/quickstart
 *
 * El Mundial está expuesto como competición "WC".
 * Endpoints relevantes:
 *   GET /v4/competitions/WC/teams    -> 48 selecciones
 *   GET /v4/competitions/WC/matches  -> partidos del torneo
 */

import { env } from "@/lib/env";
import type {
  FootballDataProvider,
  NormalizedMatch,
  NormalizedTeam,
  Stage,
  MatchStatus,
} from "./types";

const BASE_URL = "https://api.football-data.org/v4";
const COMPETITION = "WC";

interface FdTeam {
  id: number;
  name: string;
  tla?: string;
  shortName?: string;
  crest?: string;
}

interface FdMatch {
  id: number;
  utcDate: string;
  status: string;
  stage: string;          // p.ej. "GROUP_STAGE", "LAST_16", "QUARTER_FINALS"
  group?: string | null;  // p.ej. "GROUP_A"
  homeTeam: { id: number | null; name: string | null };
  awayTeam: { id: number | null; name: string | null };
  score: {
    fullTime?: { home: number | null; away: number | null };
    penalties?: { home: number | null; away: number | null };
  };
}

function authHeaders() {
  if (!env.footballDataApiKey) {
    throw new Error("Falta FOOTBALL_DATA_API_KEY");
  }
  return { "X-Auth-Token": env.footballDataApiKey } as const;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: authHeaders(),
    // El cron corre en server, no queremos cache
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `football-data ${path} respondió ${res.status}: ${text.slice(0, 200)}`,
    );
  }
  return (await res.json()) as T;
}

// Mapea stages del proveedor a nuestro enum
function mapStage(stage: string): Stage | null {
  switch (stage) {
    case "GROUP_STAGE":
      return "group";
    case "PLAYOFFS_ROUND_1":
    case "LAST_32":
    case "ROUND_OF_32":
      return "round_of_32";
    case "LAST_16":
    case "ROUND_OF_16":
      return "round_of_16";
    case "QUARTER_FINALS":
      return "quarter_final";
    case "SEMI_FINALS":
      return "semi_final";
    case "3RD_PLACE":
    case "THIRD_PLACE":
      return "third_place";
    case "FINAL":
      return "final";
    default:
      return null;
  }
}

function mapStatus(status: string): MatchStatus {
  switch (status) {
    case "SCHEDULED":
    case "TIMED":
      return "scheduled";
    case "IN_PLAY":
    case "PAUSED":
      return "live";
    case "FINISHED":
      return "finished";
    case "POSTPONED":
    case "SUSPENDED":
      return "postponed";
    case "CANCELLED":
    case "AWARDED":
      return "cancelled";
    default:
      return "scheduled";
  }
}

function normalizeGroupCode(group?: string | null): string | undefined {
  if (!group) return undefined;
  // "GROUP_A" -> "A"
  const m = group.match(/^GROUP_([A-L])$/i);
  return m ? m[1].toUpperCase() : undefined;
}

export const footballDataProvider: FootballDataProvider = {
  name: "football-data.org",

  async fetchTeams() {
    const data = await get<{ teams: FdTeam[] }>(
      `/competitions/${COMPETITION}/teams`,
    );
    return (data.teams ?? []).map<NormalizedTeam>((t) => ({
      externalId: String(t.id),
      code: (t.tla ?? t.shortName ?? t.name).slice(0, 3).toUpperCase(),
      name: t.name,
    }));
  },

  async fetchMatches() {
    const data = await get<{ matches: FdMatch[] }>(
      `/competitions/${COMPETITION}/matches`,
    );

    const out: NormalizedMatch[] = [];
    for (const m of data.matches ?? []) {
      const stage = mapStage(m.stage);
      if (!stage) continue;

      out.push({
        externalId: String(m.id),
        stage,
        groupCode: normalizeGroupCode(m.group),
        kickoffAt: m.utcDate,
        status: mapStatus(m.status),
        homeTeamExternalId: m.homeTeam.id ? String(m.homeTeam.id) : undefined,
        awayTeamExternalId: m.awayTeam.id ? String(m.awayTeam.id) : undefined,
        homePlaceholder:
          !m.homeTeam.id && m.homeTeam.name ? m.homeTeam.name : undefined,
        awayPlaceholder:
          !m.awayTeam.id && m.awayTeam.name ? m.awayTeam.name : undefined,
        homeScore: m.score?.fullTime?.home ?? undefined,
        awayScore: m.score?.fullTime?.away ?? undefined,
        homeScorePen: m.score?.penalties?.home ?? undefined,
        awayScorePen: m.score?.penalties?.away ?? undefined,
      });
    }
    return out;
  },
};
