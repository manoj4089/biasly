import { randomUUID } from "crypto";
import { analyzeArticle, ANALYSIS_MODEL, type ArticleAnalysisOutput } from "@/lib/ai/analyzeArticle";
import { embedArticleText } from "@/lib/ai/embedArticle";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

type SupabaseServerClient = ReturnType<typeof createServerClient>;

const ID_CHUNK_SIZE = 15;
const DEFAULT_BATCH_SIZE = Number(process.env.ANALYSIS_BATCH_SIZE) || 5;
const MAX_RETRIES = 2;

export interface AnalyzeOptions {
  limit?: number;
  articleIds?: string[];
}

export interface AnalyzeSummary {
  status: "completed";
  articlesChecked: number;
  analyzed: number;
  skipped: number;
  failed: number;
  embeddingsBackfilled: number;
  batches: number;
  durationMs: number;
}

async function logEvent(
  supabase: SupabaseServerClient,
  level: "info" | "error",
  message: string,
  metadata: Record<string, unknown> = {},
) {
  await supabase.from("logs").insert({ level, message, metadata });
}

interface PendingWork {
  missingAnalysis: string[];
  missingEmbedding: string[];
}

async function getPendingWork(supabase: SupabaseServerClient, articleIds?: string[]): Promise<PendingWork> {
  let query = supabase.from("articles").select("id");
  if (articleIds?.length) query = query.in("id", articleIds);

  const { data: articles, error } = await query;
  if (error) throw new Error(error.message);

  const ids = (articles ?? []).map((article) => article.id);
  if (!ids.length) return { missingAnalysis: [], missingEmbedding: [] };

  const embeddingByArticle = new Map<string, number[] | null>();
  for (let i = 0; i < ids.length; i += ID_CHUNK_SIZE) {
    const chunk = ids.slice(i, i + ID_CHUNK_SIZE);
    const { data, error: chunkError } = await supabase
      .from("article_analyses")
      .select("article_id, embedding")
      .in("article_id", chunk);
    if (chunkError) throw new Error(chunkError.message);
    for (const row of data ?? []) embeddingByArticle.set(row.article_id, row.embedding);
  }

  const missingAnalysis: string[] = [];
  const missingEmbedding: string[] = [];
  for (const id of ids) {
    if (!embeddingByArticle.has(id)) missingAnalysis.push(id);
    else if (embeddingByArticle.get(id) == null) missingEmbedding.push(id);
  }

  return { missingAnalysis, missingEmbedding };
}

async function embedWithRetry(supabase: SupabaseServerClient, articleId: string, text: string): Promise<number[] | null> {
  let lastError = "";
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await embedArticleText(text);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await logEvent(supabase, "error", `Embedding attempt ${attempt} failed for article ${articleId}`, {
        articleId,
        attempt,
        error: lastError,
      });
    }
  }

  await logEvent(supabase, "error", `Embedding failed for article ${articleId} after ${MAX_RETRIES} attempts`, {
    articleId,
    error: lastError,
  });
  return null;
}

export async function analyzePendingArticles(options: AnalyzeOptions = {}): Promise<AnalyzeSummary> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured");

  const supabase = createServerClient();
  const startedAt = Date.now();
  const batchSize = DEFAULT_BATCH_SIZE > 0 ? DEFAULT_BATCH_SIZE : 5;

  const pending = await getPendingWork(supabase, options.articleIds);
  const combinedIds = [...pending.missingAnalysis, ...pending.missingEmbedding];
  const idsToProcess = options.limit ? combinedIds.slice(0, options.limit) : combinedIds;
  const missingAnalysisSet = new Set(pending.missingAnalysis);

  await logEvent(supabase, "info", "Analysis started", {
    pendingAnalysis: pending.missingAnalysis.length,
    pendingEmbedding: pending.missingEmbedding.length,
    toProcess: idsToProcess.length,
    batchSize,
  });

  let analyzed = 0;
  let skipped = 0;
  let failed = 0;
  let embeddingsBackfilled = 0;
  let batches = 0;

  for (let i = 0; i < idsToProcess.length; i += batchSize) {
    const batchIds = idsToProcess.slice(i, i + batchSize);
    batches += 1;

    const analysisBatchIds = batchIds.filter((id) => missingAnalysisSet.has(id));
    const embeddingBatchIds = batchIds.filter((id) => !missingAnalysisSet.has(id));

    const { data: articles, error } = await supabase.from("articles").select("*").in("id", batchIds);
    if (error) throw new Error(error.message);
    const articleById = new Map((articles ?? []).map((article) => [article.id, article]));

    for (const articleId of analysisBatchIds) {
      const article = articleById.get(articleId);
      if (!article) continue;

      if (!article.raw_text || article.raw_text.trim().length === 0) {
        skipped += 1;
        await logEvent(supabase, "info", "Skipped article with no body text", { articleId: article.id });
        continue;
      }

      let output: ArticleAnalysisOutput | null = null;
      let lastError = "";
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
        try {
          output = await analyzeArticle(article.title, article.raw_text);
          break;
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
          await logEvent(supabase, "error", `Analysis attempt ${attempt} failed for article ${article.id}`, {
            articleId: article.id,
            attempt,
            error: lastError,
          });
        }
      }

      if (!output) {
        failed += 1;
        await logEvent(supabase, "error", `Analysis failed for article ${article.id} after ${MAX_RETRIES} attempts`, {
          articleId: article.id,
          error: lastError,
        });
        continue;
      }

      const embedding = await embedWithRetry(supabase, article.id, `${article.title}\n\n${output.summary}`);

      const biasScore = (output.right_percentage - output.left_percentage) / 100;
      const { error: insertError } = await supabase.from("article_analyses").insert({
        id: randomUUID(),
        article_id: article.id,
        neutral_summary: output.summary,
        sentiment_score: output.sentiment_score,
        sentiment_label: output.sentiment_label,
        bias_score: biasScore,
        bias_label: output.bias_label,
        left_percentage: output.left_percentage,
        center_percentage: output.center_percentage,
        right_percentage: output.right_percentage,
        confidence: output.confidence,
        framing_notes: output.framing_notes,
        loaded_terms: output.loaded_terms,
        disclaimer: output.disclaimer,
        model_name: ANALYSIS_MODEL,
        embedding,
      });

      if (insertError) {
        failed += 1;
        await logEvent(supabase, "error", `Failed to save analysis for article ${article.id}`, {
          articleId: article.id,
          error: insertError.message,
        });
        continue;
      }

      analyzed += 1;

      if (!embedding) {
        await logEvent(supabase, "info", `Analysis saved without embedding for article ${article.id}; will retry embedding next run`, {
          articleId: article.id,
        });
        continue;
      }

      const { error: updateError } = await supabase
        .from("articles")
        .update({ analyzed_at: new Date().toISOString() })
        .eq("id", article.id);
      if (updateError) {
        await logEvent(supabase, "error", `Analysis saved but failed to set analyzed_at for article ${article.id}`, {
          articleId: article.id,
          error: updateError.message,
        });
      }
    }

    for (const articleId of embeddingBatchIds) {
      const article = articleById.get(articleId);
      if (!article) continue;

      const { data: analysis, error: analysisError } = await supabase
        .from("article_analyses")
        .select("neutral_summary")
        .eq("article_id", articleId)
        .maybeSingle();
      if (analysisError || !analysis) {
        failed += 1;
        await logEvent(supabase, "error", `Could not load existing analysis to backfill embedding for article ${articleId}`, {
          articleId,
          error: analysisError?.message,
        });
        continue;
      }

      const embedding = await embedWithRetry(supabase, articleId, `${article.title}\n\n${analysis.neutral_summary}`);
      if (!embedding) {
        failed += 1;
        continue;
      }

      const { error: updateEmbeddingError } = await supabase
        .from("article_analyses")
        .update({ embedding })
        .eq("article_id", articleId);
      if (updateEmbeddingError) {
        failed += 1;
        await logEvent(supabase, "error", `Failed to save backfilled embedding for article ${articleId}`, {
          articleId,
          error: updateEmbeddingError.message,
        });
        continue;
      }

      const { error: updateArticleError } = await supabase
        .from("articles")
        .update({ analyzed_at: new Date().toISOString() })
        .eq("id", articleId);
      if (updateArticleError) {
        await logEvent(supabase, "error", `Embedding backfilled but failed to set analyzed_at for article ${articleId}`, {
          articleId,
          error: updateArticleError.message,
        });
      }

      embeddingsBackfilled += 1;
    }

    await logEvent(supabase, "info", `Analysis batch ${batches} complete`, {
      batchSize: batchIds.length,
      analyzed,
      skipped,
      failed,
      embeddingsBackfilled,
    });
  }

  const summary: AnalyzeSummary = {
    status: "completed",
    articlesChecked: idsToProcess.length,
    analyzed,
    skipped,
    failed,
    embeddingsBackfilled,
    batches,
    durationMs: Date.now() - startedAt,
  };

  await logEvent(supabase, "info", "Analysis completed", { ...summary });
  return summary;
}
