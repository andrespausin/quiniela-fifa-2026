/**
 * Tipos mínimos generados a mano para que el cliente Supabase sea tipado.
 * En el futuro, regenerar con `supabase gen types typescript`.
 */
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: { id: string; display_name: string };
        Update: { display_name?: string };
      };
      teams: {
        Row: {
          id: number;
          code: string;
          name: string;
          flag_emoji: string | null;
          external_id: string | null;
        };
        Insert: {
          code: string;
          name: string;
          flag_emoji?: string | null;
          external_id?: string | null;
        };
        Update: Partial<{
          code: string;
          name: string;
          flag_emoji: string | null;
          external_id: string | null;
        }>;
      };
      groups: {
        Row: { id: number; code: string };
        Insert: { code: string };
        Update: { code?: string };
      };
      group_teams: {
        Row: { group_id: number; team_id: number };
        Insert: { group_id: number; team_id: number };
        Update: { group_id?: number; team_id?: number };
      };
      matches: {
        Row: {
          id: number;
          external_id: string | null;
          stage: Database["public"]["Enums"]["match_stage"];
          group_id: number | null;
          bracket_slot: string | null;
          home_team_id: number | null;
          away_team_id: number | null;
          home_placeholder: string | null;
          away_placeholder: string | null;
          kickoff_at: string;
          status: Database["public"]["Enums"]["match_status"];
          home_score: number | null;
          away_score: number | null;
          home_score_pen: number | null;
          away_score_pen: number | null;
          updated_at: string;
        };
        Insert: {
          external_id?: string | null;
          stage: Database["public"]["Enums"]["match_stage"];
          group_id?: number | null;
          bracket_slot?: string | null;
          home_team_id?: number | null;
          away_team_id?: number | null;
          home_placeholder?: string | null;
          away_placeholder?: string | null;
          kickoff_at: string;
          status?: Database["public"]["Enums"]["match_status"];
          home_score?: number | null;
          away_score?: number | null;
          home_score_pen?: number | null;
          away_score_pen?: number | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["matches"]["Insert"]
        >;
      };
      predictions: {
        Row: {
          id: number;
          user_id: string;
          match_id: number;
          home_score: number;
          away_score: number;
          winner: "home" | "away" | "draw" | null;
          created_at: string;
          updated_at: string;
          points: number | null;
        };
        Insert: {
          user_id: string;
          match_id: number;
          home_score: number;
          away_score: number;
          winner?: "home" | "away" | "draw" | null;
        };
        Update: Partial<{
          home_score: number;
          away_score: number;
          winner: "home" | "away" | "draw" | null;
        }>;
      };
      bracket_predictions: {
        Row: {
          id: number;
          user_id: string;
          stage: Database["public"]["Enums"]["match_stage"];
          team_id: number;
        };
        Insert: {
          user_id: string;
          stage: Database["public"]["Enums"]["match_stage"];
          team_id: number;
        };
        Update: never;
      };
      bracket_results: {
        Row: {
          stage: Database["public"]["Enums"]["match_stage"];
          team_id: number;
        };
        Insert: {
          stage: Database["public"]["Enums"]["match_stage"];
          team_id: number;
        };
        Update: never;
      };
      score_log: {
        Row: {
          id: number;
          user_id: string;
          source: string;
          source_id: string;
          points: number;
          created_at: string;
        };
        Insert: {
          user_id: string;
          source: string;
          source_id: string;
          points: number;
        };
        Update: never;
      };
    };
    Views: {
      leaderboard: {
        Row: {
          user_id: string;
          display_name: string;
          total_points: number;
          match_points: number;
          bracket_points: number;
        };
      };
    };
    Enums: {
      match_stage:
        | "group"
        | "round_of_32"
        | "round_of_16"
        | "quarter_final"
        | "semi_final"
        | "third_place"
        | "final";
      match_status:
        | "scheduled"
        | "live"
        | "finished"
        | "postponed"
        | "cancelled";
    };
  };
};
