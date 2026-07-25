import { createServerClient } from "@/lib/supabase/server";
import type { NewsArticle } from "@/lib/news";

export async function getRelatedArticles(articleId: string, embedding: number[]): Promise<NewsArticle[]> {
  const supabase = createServerClient();

  const { data: matches, error } = await supabase.rpc("match_related_articles", {
    query_embedding: embedding,
    exclude_article_id: articleId,
    match_count: 5,
  });
  if (error || !matches?.length) return [];

  const ids = matches.map((match) => match.article_id);
  const { data: articles, error: articlesError } = await supabase
    .from("articles")
    .select("*")
    .in("id", ids)
    .not("analyzed_at", "is", null);
  if (articlesError || !articles?.length) return [];

  const [{ data: analyses }, { data: sources }] = await Promise.all([
    supabase.from("article_analyses").select("*").in("article_id", ids),
    supabase.from("sources").select("id, name").in("id", articles.map((article) => article.source_id)),
  ]);
  const analysisByArticle = new Map((analyses ?? []).map((analysis) => [analysis.article_id, analysis]));
  const sourceById = new Map((sources ?? []).map((source) => [source.id, source]));

  const byId = new Map(
    articles.flatMap((article) => {
      const analysis = analysisByArticle.get(article.id);
      const source = sourceById.get(article.source_id);
      return analysis && source ? [[article.id, { ...article, analysis, source }] as const] : [];
    }),
  );

  return ids.flatMap((id) => {
    const article = byId.get(id);
    return article ? [article] : [];
  });
}
