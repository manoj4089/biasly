import { createServerClient, isSupabaseConfigured } from "./supabase/server";
import type { Database } from "./supabase/database.types";

type Article = Database["public"]["Tables"]["articles"]["Row"];
type Analysis = Database["public"]["Tables"]["article_analyses"]["Row"];
type Source = Database["public"]["Tables"]["sources"]["Row"];

export type NewsArticle = Article & { source: Pick<Source, "id" | "name">; analysis: Analysis };

export async function getArticles(): Promise<NewsArticle[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createServerClient();
  const { data: articles, error } = await supabase.from("articles").select("*").not("analyzed_at", "is", null).order("published_at", { ascending: false });
  if (error || !articles?.length) return [];
  const ids = articles.map((article) => article.id);
  const [{ data: analyses }, { data: sources }] = await Promise.all([
    supabase.from("article_analyses").select("*").in("article_id", ids),
    supabase.from("sources").select("id, name").in("id", articles.map((article) => article.source_id)),
  ]);
  const analysisByArticle = new Map((analyses ?? []).map((analysis) => [analysis.article_id, analysis]));
  const sourceById = new Map((sources ?? []).map((source) => [source.id, source]));
  return articles.flatMap((article) => {
    const analysis = analysisByArticle.get(article.id);
    const source = sourceById.get(article.source_id);
    return analysis && source ? [{ ...article, analysis, source }] : [];
  });
}

export async function getArticleById(id: string): Promise<NewsArticle | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createServerClient();
  const { data: article, error } = await supabase.from("articles").select("*").eq("id", id).not("analyzed_at", "is", null).maybeSingle();
  if (error || !article) return null;
  const [{ data: analysis }, { data: source }] = await Promise.all([
    supabase.from("article_analyses").select("*").eq("article_id", id).maybeSingle(),
    supabase.from("sources").select("id, name").eq("id", article.source_id).maybeSingle(),
  ]);
  return analysis && source ? { ...article, analysis, source } : null;
}
