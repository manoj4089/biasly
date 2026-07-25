import type { ParsedArticle } from "./parseArticle";

const MIN_PARAGRAPHS = 3;
const MIN_CHARACTERS = 900;

const GENERIC_TITLE_PATTERN =
  /(\|\s*latest news|\|\s*breaking (news|.*news today)|latest news (in|from|&)|breaking news today|news reports\b|últimas noticias|news & updates)/i;

export interface ValidatedArticle extends ParsedArticle {
  imageUrl: string;
  publishedAt: string;
}

export type ArticleValidationResult =
  | { valid: true; article: ValidatedArticle }
  | { valid: false; reason: string };

export function validateArticle(parsed: ParsedArticle): ArticleValidationResult {
  if (!parsed.imageUrl) return { valid: false, reason: "missing image" };
  if (!parsed.publishedAt) return { valid: false, reason: "missing published date" };
  if (GENERIC_TITLE_PATTERN.test(parsed.title)) return { valid: false, reason: "generic/hub-style title" };

  const paragraphs = parsed.rawText
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const meaningfulParagraphs = paragraphs.filter((paragraph) => paragraph.length > 40);

  const hasEnoughBody = meaningfulParagraphs.length >= MIN_PARAGRAPHS || parsed.rawText.length >= MIN_CHARACTERS;
  if (!hasEnoughBody) return { valid: false, reason: "insufficient body content" };

  return { valid: true, article: { ...parsed, imageUrl: parsed.imageUrl, publishedAt: parsed.publishedAt } };
}
