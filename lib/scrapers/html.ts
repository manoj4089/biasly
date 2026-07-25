import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const codePoint = code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

function metaRegex(attr: "property" | "name", key: string, order: "attr-first" | "content-first"): RegExp {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return order === "attr-first"
    ? new RegExp(`<meta[^>]+${attr}=["']${escapedKey}["'][^>]*content=["']([^"']*)["']`, "i")
    : new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*${attr}=["']${escapedKey}["']`, "i");
}

export function extractMeta(html: string, attr: "property" | "name", key: string): string | null {
  const match = html.match(metaRegex(attr, key, "attr-first")) ?? html.match(metaRegex(attr, key, "content-first"));
  return match ? decodeEntities(match[1]).trim() || null : null;
}

export function extractCanonical(html: string): string | null {
  const match =
    html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) ??
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical["']/i);
  return match ? decodeEntities(match[1]).trim() || null : null;
}

export function extractTitleTag(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? decodeEntities(match[1]).trim() || null : null;
}

export function extractLinks(html: string, baseUrl: string): string[] {
  const hrefs = [...html.matchAll(/<a\s[^>]*href=["']([^"']+)["']/gi)].map((match) => match[1]);
  const links: string[] = [];
  for (const href of hrefs) {
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("javascript:")) continue;
    try {
      links.push(new URL(href, baseUrl).toString());
    } catch {
      // ignore malformed URLs
    }
  }
  return links;
}

const NON_CONTENT_TAGS = ["script", "style", "noscript", "svg", "nav", "header", "footer", "aside", "form", "iframe"];

const BOILERPLATE_SELECTOR_PATTERN =
  /(share|social|newsletter|subscri|related|recommend|most-?read|most-?viewed|trending|also-?read|read-?more|more-?from|load-?more|comment|advert|promo|sponsor|byline-?social|breadcrumb|tag-?list|author-?bio|site-?nav|menu|masthead|cookie|cta-|paywall)/i;

const ARTICLE_CONTAINER_SELECTORS = [
  "article",
  '[itemprop="articleBody"]',
  '[data-testid="article-body"]',
  ".article-body",
  ".article-content",
  ".story-body",
  ".post-content",
  "main",
];

function stripBoilerplate($: cheerio.CheerioAPI): void {
  $(NON_CONTENT_TAGS.join(",")).remove();
  $("[class], [id]").each((_, el) => {
    const node = $(el);
    const identity = `${node.attr("class") ?? ""} ${node.attr("id") ?? ""}`;
    if (BOILERPLATE_SELECTOR_PATTERN.test(identity)) node.remove();
  });
}

function extractParagraphs($: cheerio.CheerioAPI, root: cheerio.Cheerio<AnyNode>): string[] {
  const paragraphs: string[] = [];
  root.find("p").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text.length > 30) paragraphs.push(text);
  });
  return paragraphs;
}

function findArticleContainer($: cheerio.CheerioAPI): cheerio.Cheerio<AnyNode> {
  for (const selector of ARTICLE_CONTAINER_SELECTORS) {
    const scored: Array<{ el: AnyNode; count: number }> = [];
    $(selector).each((_, el) => {
      scored.push({ el, count: extractParagraphs($, $(el)).length });
    });
    const best = scored.filter((entry) => entry.count >= 3).sort((a, b) => b.count - a.count)[0];
    if (best) return $(best.el);
  }
  return $("body");
}

export function extractArticleText(html: string): string {
  const $ = cheerio.load(html);
  stripBoilerplate($);

  const container = findArticleContainer($);
  let paragraphs = extractParagraphs($, container);

  if (paragraphs.length < 3) {
    // Fall back to the largest cluster of sibling <p> tags anywhere on the page.
    const bodyParagraphs = extractParagraphs($, $("body"));
    if (bodyParagraphs.length > paragraphs.length) paragraphs = bodyParagraphs;
  }

  return decodeEntities(paragraphs.join("\n\n")).trim();
}
