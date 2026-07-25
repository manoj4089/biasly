# Details page dark mode + clean article body

## Goal
Fix two issues on the news details page (`/news/[id]`):
1. In dark mode, article text and side-panel cards are unreadable (hardcoded light-mode colors/backgrounds with no dark overrides).
2. The article body shown on the page contains scraped junk (site navigation, footer links, "Follow Us" / social share text, legal boilerplate) instead of clean article text, and renders as one unbroken wall of text instead of paragraphs.

## Skills read
None of the four approved skills (clerk, supabase, oxylabs-web-scraper, ai-sdk) apply to this change. Per AGENTS.md section 3, for Cheerio/Tailwind work we use existing project patterns and package docs.

## Existing code inspected
- `app/news-details/page.tsx` — details page markup/classes.
- `app/news/[id]/page.tsx` — loads `article` via `getArticleById`, passes to details page.
- `app/globals.css` lines 1–62 (theme tokens), 165, 201–238 (detail page rules) — confirmed no `[data-theme="dark"]` overrides exist for any detail-page class.
- `lib/scrapers/html.ts` — `stripHtml()` strips all tags from the full page HTML with no article-container extraction; collapses all whitespace/newlines.
- `lib/scrapers/parseArticle.ts` — calls `stripHtml(html)` directly for `rawText`, with a 20,000-char cap.
- `lib/scrapers/validateArticle.ts` — validates body length via paragraph count (`\n{2,}` split) or 900+ char fallback; since `stripHtml` removes all newlines today, paragraph splitting never actually fires (always 1 "paragraph"), so validation always falls back to raw character count. This also means today's article-content gate does not detect boilerplate — it just measures total length, junk included.
- `package.json` — confirmed `cheerio` is not yet a dependency.

## Decisions / assumptions
- Add `cheerio` as a dependency and rewrite article body extraction to be DOM-aware:
  - Remove `<script>`, `<style>`, `<nav>`, `<header>`, `<footer>`, `<aside>`, and elements matching common boilerplate selectors/classes (share/social, newsletter, related/recommended, "more from", ad slots, subscribe prompts) before extracting text.
  - Extract from the likely article container (`article`, `[itemprop="articleBody"]`, common CMS content selectors) with a fallback to the largest cluster of sibling `<p>` tags when no container matches.
  - Join extracted block/paragraph text with `\n\n` so paragraph breaks are preserved (fixes both the "wall of text" rendering and makes the existing `\n{2,}` paragraph-split logic in `validateArticle.ts` and the details page actually work).
- This fix applies to **future scrapes only**. Existing articles already stored with junk `raw_text` will not be retroactively cleaned in this pass — re-scraping (append-only dedupe means existing rows won't be touched by a normal scrape run, since the URL already exists). If you want existing bad articles cleaned up, that's a separate follow-up (e.g. a one-off backfill script), flag if wanted.
- Dark mode fix is CSS-only: introduce `[data-theme="dark"]` overrides for detail-page classes, reusing the existing color tokens (`--color-text-primary`, `--color-text-secondary`, `--color-surface`, `--color-border`) instead of new hardcoded hex values, matching the pattern already used for the homepage nav/cards.
- No schema, API, or route changes.

## Files likely to change
- `app/globals.css` — add dark-mode rules for `.article-kicker`, `.article-byline`, `.hero-image`/`.image-credit`, `.distribution-card`/`.distribution-meter`, `.article-body`, `.related-section`/`.related-story`, `.side-panel` (all three), `.analysis-row`, `.source-list`, `.newsletter`.
- `lib/scrapers/html.ts` — replace/extend `stripHtml` with Cheerio-based extraction (new exported function, e.g. `extractArticleText`), keep `extractMeta`/`extractCanonical`/`extractTitleTag`/`extractLinks` as-is.
- `lib/scrapers/parseArticle.ts` — use the new extraction function instead of raw `stripHtml`.
- `package.json` / lockfile — add `cheerio`.

## Implementation requirements
- Preserve the existing `ParsedArticle` shape (`rawText: string`) so downstream code (`validateArticle.ts`, pipeline insert, details page) doesn't need to change.
- Keep the `MAX_RAW_TEXT_LENGTH` cap (20,000 chars) applied after cleanup.
- Do not change any Supabase schema, API route, or admin-secret behavior.
- Dark mode CSS must not regress light mode (only add `[data-theme="dark"]` scoped rules, don't touch base rules).

## Security requirements
None — no new external calls, no new env vars, no secret exposure.

## Acceptance criteria
- Toggling dark mode on a news details page: all text (kicker, byline, article body, side-panel headings/labels/values, source list, newsletter) is legible with adequate contrast against dark backgrounds; no white cards floating on the dark page.
- A freshly scraped article's `raw_text` (and the rendered article body) contains only the article's own paragraphs — no nav labels, footer links, "Follow Us"/social share text, or legal boilerplate — and renders as multiple `<p>` paragraphs, not one blob.
- `npm run typecheck` and `npm run lint` pass.

## Checks to run
- `npm run typecheck`
- `npm run lint`

## Manual test steps
1. `npm run dev`, open an existing article at `/news/<id>`, toggle dark mode via the theme toggle, and visually confirm all text/panels are readable.
2. Trigger a manual scrape for one source to get a fresh article:
   ```
   curl -X POST http://localhost:3000/api/scrape \
     -H "x-biasly-admin-secret: $BIASLY_ADMIN_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"limitPerSource": 1}'
   ```
3. Run analysis on it, then open its details page and confirm the body text reads as clean article paragraphs with no navigation/footer/social junk.
