export type Database = {
  public: {
    Tables: {
      sources: {
        Row: { id: string; name: string; listing_url: string; parser_strategy: string; active: boolean; logo_url: string | null; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["sources"]["Row"], "created_at">;
        Update: Partial<Database["public"]["Tables"]["sources"]["Insert"]>;
        Relationships: [];
      };
      articles: {
        Row: {
          id: string; source_id: string; original_url: string; canonical_url: string | null; title: string; image_url: string; published_at: string; raw_text: string; scraped_at: string; analyzed_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["articles"]["Row"], "scraped_at">;
        Update: Partial<Database["public"]["Tables"]["articles"]["Insert"]>;
        Relationships: [];
      };
      article_analyses: {
        Row: { id: string; article_id: string; neutral_summary: string; sentiment_score: number; sentiment_label: "positive" | "neutral" | "negative"; bias_score: number; bias_label: "left" | "center" | "right" | "mixed" | "unclear"; left_percentage: number; center_percentage: number; right_percentage: number; confidence: number; framing_notes: string; loaded_terms: string[]; disclaimer: string; model_name: string; embedding: number[] | null; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["article_analyses"]["Row"], "created_at" | "embedding"> & { embedding?: number[] | null };
        Update: Partial<Database["public"]["Tables"]["article_analyses"]["Insert"]>;
        Relationships: [];
      };
      logs: { Row: { id: string; level: string; message: string; metadata: Record<string, unknown>; created_at: string }; Insert: Omit<Database["public"]["Tables"]["logs"]["Row"], "id" | "created_at">; Update: Partial<Database["public"]["Tables"]["logs"]["Insert"]>; Relationships: [] };
      oxylabs_schedules: { Row: { id: string; name: string; source_ids: string[]; cron_expression: string; active: boolean; external_schedule_id: string | null; created_at: string }; Insert: Omit<Database["public"]["Tables"]["oxylabs_schedules"]["Row"], "id" | "created_at">; Update: Partial<Database["public"]["Tables"]["oxylabs_schedules"]["Insert"]>; Relationships: [] };
      oxylabs_schedule_runs: { Row: { id: string; schedule_id: string | null; external_run_id: string | null; status: string; started_at: string | null; finished_at: string | null; error_message: string | null; created_at: string }; Insert: Omit<Database["public"]["Tables"]["oxylabs_schedule_runs"]["Row"], "id" | "created_at">; Update: Partial<Database["public"]["Tables"]["oxylabs_schedule_runs"]["Insert"]>; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: {
      match_related_articles: {
        Args: { query_embedding: number[]; exclude_article_id: string; match_count?: number };
        Returns: { article_id: string }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};