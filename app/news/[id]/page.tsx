import { notFound } from "next/navigation";
import NewsDetailsPage from "../../news-details/page";
import { getArticleById } from "@/lib/news";
import { getRelatedArticles } from "@/lib/supabase/queries/articles";

export default async function NewsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const article = await getArticleById(id);
  if (!article) {
    notFound();
  }

  const relatedArticles = article.analysis.embedding
    ? await getRelatedArticles(article.id, article.analysis.embedding)
    : [];

  return <NewsDetailsPage article={article} relatedArticles={relatedArticles} />;
}
