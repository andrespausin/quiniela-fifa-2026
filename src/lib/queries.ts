"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type MatchRow = Database["public"]["Tables"]["matches"]["Row"];
type PredictionRow = Database["public"]["Tables"]["predictions"]["Row"];
type TeamRow = Database["public"]["Tables"]["teams"]["Row"];
type GroupRow = Database["public"]["Tables"]["groups"]["Row"];
type LeaderboardRow = Database["public"]["Views"]["leaderboard"]["Row"];

export interface MatchWithTeams extends MatchRow {
  home_team: Pick<TeamRow, "id" | "code" | "name"> | null;
  away_team: Pick<TeamRow, "id" | "code" | "name"> | null;
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
           home_team:home_team_id(id,code,name),
           away_team:away_team_id(id,code,name),
           group:group_id(id,code)`,
        )
        .order("kickoff_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as MatchWithTeams[];
    },
  });
}

export function usePredictionsQuery() {
  return useQuery({
    queryKey: ["predictions"],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("predictions")
        .select("*");
      if (error) throw new Error(error.message);
      return (data ?? []) as PredictionRow[];
    },
  });
}

export function useUpsertPrediction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      matchId: number;
      homeScore: number;
      awayScore: number;
      winner?: "home" | "away" | "draw" | null;
    }) => {
      const sb = supabase();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const { data, error } = await sb
        .from("predictions")
        .upsert(
          {
            user_id: user.id,
            match_id: input.matchId,
            home_score: input.homeScore,
            away_score: input.awayScore,
            winner: input.winner ?? null,
          },
          { onConflict: "user_id,match_id" },
        )
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as PredictionRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["predictions"] });
    },
  });
}

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
