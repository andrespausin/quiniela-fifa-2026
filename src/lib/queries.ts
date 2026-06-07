"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type MatchRow = Database["public"]["Tables"]["matches"]["Row"];
type PredictionRow = Database["public"]["Tables"]["predictions"]["Row"];
type TeamRow = Database["public"]["Tables"]["teams"]["Row"];
type GroupRow = Database["public"]["Tables"]["groups"]["Row"];
type LeaderboardRow = Database["public"]["Views"]["leaderboard"]["Row"];
type QuinielaRow = Database["public"]["Tables"]["quinielas"]["Row"];
type MatchPredictionRow =
  Database["public"]["Views"]["match_predictions_view"]["Row"];

export interface MatchWithTeams extends MatchRow {
  home_team: Pick<TeamRow, "id" | "code" | "name" | "flag_emoji"> | null;
  away_team: Pick<TeamRow, "id" | "code" | "name" | "flag_emoji"> | null;
  group: Pick<GroupRow, "id" | "code"> | null;
}

const supabase = () => createSupabaseBrowserClient();

export function useMatchesQuery() {
  return useQuery({
    queryKey: ["matches"],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("matches")
        .select(
          `*,
           home_team:home_team_id(id,code,name,flag_emoji),
           away_team:away_team_id(id,code,name,flag_emoji),
           group:group_id(id,code)`,
        )
        .order("kickoff_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as MatchWithTeams[];
    },
  });
}

// ---------------------------------------------------------------------------
// Quinielas
// ---------------------------------------------------------------------------

export function useQuinielasQuery() {
  return useQuery({
    queryKey: ["quinielas"],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("quinielas")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as QuinielaRow[];
    },
  });
}

export function useCreateQuinielaMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const sb = supabase();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const { data, error } = await sb
        .from("quinielas")
        .insert({ owner_id: user.id, name })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as QuinielaRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quinielas"] }),
  });
}

// ---------------------------------------------------------------------------
// Predictions (por quiniela)
// ---------------------------------------------------------------------------

export function usePredictionsQuery(quinielaId: string | null) {
  return useQuery({
    queryKey: ["predictions", quinielaId],
    enabled: quinielaId !== null,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("predictions")
        .select("*")
        .eq("quiniela_id", quinielaId!);
      if (error) throw new Error(error.message);
      return (data ?? []) as PredictionRow[];
    },
  });
}

export interface PredictionDraft {
  matchId: number;
  homeScore: number;
  awayScore: number;
  winner?: "home" | "away" | "draw" | null;
}

/**
 * Guarda múltiples predicciones en un solo round-trip a Supabase.
 * El trigger SQL (predictions_check_lock) sigue bloqueando partidos
 * a -1h del kickoff: si alguno está bloqueado, el upsert falla entero;
 * por eso filtramos en el cliente antes de mandar.
 */
export function useBatchUpsertPredictions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      quinielaId,
      drafts,
    }: {
      quinielaId: string;
      drafts: PredictionDraft[];
    }) => {
      if (drafts.length === 0) return [] as PredictionRow[];
      const sb = supabase();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) throw new Error("No autenticado");

      const rows = drafts.map((d) => ({
        user_id: user.id,
        quiniela_id: quinielaId,
        match_id: d.matchId,
        home_score: d.homeScore,
        away_score: d.awayScore,
        winner: d.winner ?? null,
      }));

      const { data, error } = await sb
        .from("predictions")
        .upsert(rows, { onConflict: "quiniela_id,match_id" })
        .select();
      if (error) throw new Error(error.message);
      return (data ?? []) as PredictionRow[];
    },
    onSuccess: (_, { quinielaId }) => {
      qc.invalidateQueries({ queryKey: ["predictions", quinielaId] });
    },
  });
}

// ---------------------------------------------------------------------------
// Perfil
// ---------------------------------------------------------------------------

export function useUpdateProfileMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (displayName: string) => {
      const sb = supabase();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const { error } = await sb
        .from("profiles")
        .update({ display_name: displayName })
        .eq("id", user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leaderboard"] }),
  });
}

export function useRenameQuinielaMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase()
        .from("quinielas")
        .update({ name })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quinielas"] }),
  });
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

export function useLeaderboardQuery() {
  return useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("leaderboard")
        .select("*");
      if (error) throw new Error(error.message);
      return (data ?? []) as LeaderboardRow[];
    },
    refetchInterval: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Jugadores: todas las predicciones de una quiniela (vista de otro usuario)
// ---------------------------------------------------------------------------

export function useQuinielaPredictionsQuery(quinielaId: string | null) {
  return useQuery({
    queryKey: ["quiniela-predictions", quinielaId],
    enabled: quinielaId !== null,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("match_predictions_view")
        .select("*")
        .eq("quiniela_id", quinielaId!);
      if (error) throw new Error(error.message);
      return (data ?? []) as MatchPredictionRow[];
    },
  });
}

// ---------------------------------------------------------------------------
// Resultados: predicciones de todos los participantes para un partido
// ---------------------------------------------------------------------------

export function useMatchPredictionsQuery(matchId: number | null) {
  return useQuery({
    queryKey: ["match-predictions", matchId],
    enabled: matchId !== null,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("match_predictions_view")
        .select("*")
        .eq("match_id", matchId!);
      if (error) throw new Error(error.message);
      return (data ?? []) as MatchPredictionRow[];
    },
  });
}
