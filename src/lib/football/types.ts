/**
 * Tipos canónicos usados internamente por la app, independientes del
 * proveedor (football-data.org / API-Football).
 */

import type { Database } from "@/lib/supabase/database.types";

export type Stage = Database["public"]["Enums"]["match_stage"];
export type MatchStatus = Database["public"]["Enums"]["match_status"];

export interface NormalizedTeam {
  externalId: string;
  code: string;       // ISO-ish, p.ej. "ARG"
  name: string;
  flagEmoji?: string;
}

export interface NormalizedMatch {
  externalId: string;
  stage: Stage;
  groupCode?: string;     // "A".."L" sólo en fase de grupos
  bracketSlot?: string;   // p.ej. "R32-01"
  kickoffAt: string;      // ISO timestamp
  status: MatchStatus;

  // Equipos asignados (cuando ya se conoce el cruce)
  homeTeamExternalId?: string;
  awayTeamExternalId?: string;

  // Placeholders (cuando aún no se conoce, p.ej. "Winner of R32-01")
  homePlaceholder?: string;
  awayPlaceholder?: string;

  homeScore?: number;
  awayScore?: number;
  homeScorePen?: number;
  awayScorePen?: number;
}

export interface FootballDataProvider {
  readonly name: string;
  fetchTeams(): Promise<NormalizedTeam[]>;
  fetchMatches(): Promise<NormalizedMatch[]>;
}
