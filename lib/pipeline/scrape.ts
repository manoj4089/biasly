import { randomUUID } from "crypto";
import { scrapePage } from "@/lib/oxylabs/client";
import { extractLinks } from "@/lib/scrapers/html";
import { parseArticle } from "@/lib/scrapers/parseArticle";
import { validateArticle } from "@/lib/scrapers/validateArticle";
import { isArticleLink } from "@/lib/scrapers/strategies";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type Source = Database["public"]["Tables"]["sources"]["Row"];
type SupabaseServerClient = ReturnType<typeof createServerClient>;

const MAX_ARTICLES_PER_SOURCE = 10;
const URL_EXISTENCE_CHUNK_SIZE = 15;

export interface SourceScrapeResult {
  sourceId: string;
  discovered: number;
  inserted: number;
  skipped: number;
  rejected: number;
  errors: Array<{ url: string; message: string }>;
}

export async function logEvent(
  supabase: SupabaseServerClient,
  level: "info" | "error",
  message: string,
  metadata: Record<string, unknown> = {},
) {
  await supabase.from("logs").insert({ level, message, metadata });
}

async function findExistingUrls(supabase: SupabaseServerClient, links: string[]): Promise<Set<string>> {
  const existingUrls = new Set<string>();
  for (let i = 0; i < links.length; i += URL_EXISTENCE_CHUNK_SIZE) {
    const chunk = links.slice(i, i + URL_EXISTENCE_CHUNK_SIZE);
    const { data: existing } = await supabase.from("articles").select("original_url").in("original_url", chunk);
    for (const row of existing ?? []) existingUrls.add(row.original_url);
  }
  return existingUrls;
}

export async function processSourceHomepage(
  source: Source,
  listingHtml: string,
  supabase: SupabaseServerClient,
): Promise<SourceScrapeResult> {
  const result: SourceScrapeResult = { sourceId: source.id, discovered: 0, inserted: 0, skipped: 0, rejected: 0, errors: [] };

  const candidateLinks = extractLinks(listingHtml, source.listing_url).filter((url) =>
    isArticleLink(source.parser_strategy, url, source.listing_url),
  );
  const links = Array.from(new Set(candidateLinks)).slice(0, MAX_ARTICLES_PER_SOURCE);
  result.discovered = links.length;

  if (!links.length) {
    await logEvent(supabase, "info", `No article links discovered for ${source.id}`, { sourceId: source.id });
    return result;
  }

  const existingUrls = await findExistingUrls(supabase, links);

  for (const url of links) {
    if (existingUrls.has(url)) {
      result.skipped += 1;
      continue;
    }

    try {
      const html = await scrapePage(url, { render: "html" });
      const parsed = parseArticle(html, url);

      const validation = validateArticle(parsed);
      if (!validation.valid) {
        result.rejected += 1;
        await logEvent(supabase, "info", `Rejected candidate ${url}`, { sourceId: source.id, url, reason: validation.reason });
        continue;
      }
      const article = validation.article;

      const { error } = await supabase.from("articles").insert({
        id: randomUUID(),
        source_id: source.id,
        original_url: url,
        canonical_url: article.canonicalUrl,
        title: article.title,
        image_url: article.imageUrl,
        published_at: article.publishedAt,
        raw_text: article.rawText,
        analyzed_at: null,
      });
      if (error) throw new Error(error.message);
      result.inserted += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push({ url, message });
      await logEvent(supabase, "error", `Failed to scrape article ${url}`, { sourceId: source.id, url, error: message });
    }
  }

  await logEvent(supabase, "info", `Scrape complete for ${source.id}`, {
    sourceId: source.id,
    discovered: result.discovered,
    inserted: result.inserted,
    skipped: result.skipped,
    rejected: result.rejected,
    errorCount: result.errors.length,
  });

  return result;
}

export async function scrapeSource(source: Source, supabase: SupabaseServerClient): Promise<SourceScrapeResult> {
  let listingHtml: string;
  try {
    listingHtml = await scrapePage(source.listing_url, { render: "html" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logEvent(supabase, "error", `Failed to fetch listing page for ${source.id}`, { sourceId: source.id, error: message });
    return { sourceId: source.id, discovered: 0, inserted: 0, skipped: 0, rejected: 0, errors: [{ url: source.listing_url, message }] };
  }

  return processSourceHomepage(source, listingHtml, supabase);
}

export async function scrapeActiveSources(sourceIds?: string[]): Promise<SourceScrapeResult[]> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured");

  const supabase = createServerClient();
  let query = supabase.from("sources").select("*").eq("active", true);
  if (sourceIds?.length) query = query.in("id", sourceIds);

  const { data: sources, error } = await query;
  if (error) throw new Error(error.message);

  const results: SourceScrapeResult[] = [];
  for (const source of sources ?? []) {
    results.push(await scrapeSource(source, supabase));
  }
  return results;
}
