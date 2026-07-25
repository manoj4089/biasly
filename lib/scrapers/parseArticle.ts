import { extractArticleText, extractCanonical, extractMeta, extractTitleTag } from "./html";

export interface ParsedArticle {
  title: string;
  imageUrl: string | null;
  canonicalUrl: string;
  publishedAt: string | null;
  rawText: string;
}

const MAX_RAW_TEXT_LENGTH = 20000;

const TITLE_META: Array<["property" | "name", string]> = [
  ["property", "og:title"],
  ["name", "twitter:title"],
];

const IMAGE_META: Array<["property" | "name", string]> = [
  ["property", "og:image"],
  ["name", "twitter:image"],
];

const DATE_META: Array<["property" | "name", string]> = [
  ["property", "article:published_time"],
  ["name", "parsely-pub-date"],
  ["name", "publish-date"],
  ["name", "date"],
  ["property", "og:updated_time"],
];

function firstMeta(html: string, candidates: Array<["property" | "name", string]>): string | null {
  for (const [attr, key] of candidates) {
    const value = extractMeta(html, attr, key);
    if (value) return value;
  }
  return null;
}

export function parseArticle(html: string, url: string): ParsedArticle {
  const title = firstMeta(html, TITLE_META) ?? extractTitleTag(html) ?? url;
  const imageUrl = firstMeta(html, IMAGE_META);
  const canonicalUrl = extractCanonical(html) ?? url;
  const publishedRaw = firstMeta(html, DATE_META);
  const publishedAt =
    publishedRaw && !Number.isNaN(Date.parse(publishedRaw)) ? new Date(publishedRaw).toISOString() : null;
  const rawText = extractArticleText(html).slice(0, MAX_RAW_TEXT_LENGTH);

  return { title, imageUrl, canonicalUrl, publishedAt, rawText };
}
