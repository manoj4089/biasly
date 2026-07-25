# AP link pattern + article content gate

## Goal

Stop AP (and any other source using the generic fallback) from saving hub/category/topic pages as articles. Currently `apnews.com/hub/africa`-style pages pass the generic link filter, get scraped, and are inserted with AP's static brand `og:image` as the "article image" — that's why every card on the homepage showed the identical gray AP logo graphic. Fix at the source: reject these before insert, per AGENTS.md sections 9, 11, 13.

## Skills read

None of the four approved skills (clerk, supabase, oxylabs-web-scraper, ai-sdk) apply — this is pure scraping/parsing/validation logic already covered by `AGENTS.md` sections 9, 11, 13.

## Existing code inspected

- [lib/scrapers/strategies.ts](../lib/scrapers/strategies.ts) — `isArticleLink`: has per-source regex for reuters/bbc/guardian/npr but none for AP, so AP falls through to the generic same-origin + "≥2 path segments" check, which accepts `/hub/africa`, `/europe-news`, `/asia-pacific`, etc.
- [lib/scrapers/parseArticle.ts](../lib/scrapers/parseArticle.ts) — `parseArticle`: silently defaults `publishedAt` to `new Date().toISOString()` when no date meta is found, and defaults `imageUrl` to a stock Unsplash fallback when no `og:image`/`twitter:image` is found. This masks the "missing date" / "missing image" signals that section 13 says must cause rejection — the caller currently can't tell "found" from "defaulted."
- [lib/pipeline/scrape.ts](../lib/pipeline/scrape.ts) — `scrapeSource`: no content/quality validation at all before `supabase.from("articles").insert(...)`. Anything `parseArticle` returns gets saved.
- [supabase/seed.sql](../supabase/seed.sql) — AP source row uses `parser_strategy = 'generic'`.
- Confirmed via the screenshot: 6 AP rows already in the DB are hub pages (`Africa News Reports | Latest News in Africa`, `Europe News | Breaking European News Today`, `Latin American News...`, `Asia Pacific | Latest News & Updates`, `China | Latest News from China Today`, `Últimas Noticias del Mundo`), all sharing the same AP brand image.

## Decisions / assumptions

- Real AP article URLs follow the pattern `https://apnews.com/article/<slug>` (slug ends in a long alphanumeric hash). Hub/topic/section pages look like `https://apnews.com/hub/<topic>`, `/world-news`, `/europe`, etc. — add an AP entry to `SOURCE_LINK_PATTERNS` matching only `/article/...`.
- Scope is intentionally limited to: (a) the AP pattern, (b) a reusable article-content gate applied to **all** sources (not just AP), since the generic fallback path is shared. Full section 9 run-logging-summary-object rework is a separate, larger prompt — not done here to avoid overbuilding.
- `parseArticle` will be changed to return `null` (not a default) for `imageUrl` and `publishedAt` when no real meta value is found, so the validator can reject on "missing," matching section 13 literally ("Reject if published date is missing" / "image URL is missing"). The Unsplash fallback constant is removed — a missing image is now a hard reject, not a decorative default.
- Generic title rejection (section 13: "title is a category, section, show, program, podcast, product, game, live, or corporate page name") is implemented as a small keyword/pattern check (e.g. title containing "| Latest News", "Breaking News Today", ending in a bare topic word list) rather than an exhaustive per-source list — kept intentionally simple.
- Body quality gate per section 13: accept if raw text has 3+ paragraphs (blank-line separated) OR 900+ cleaned characters.
- Existing bad rows already in Supabase are **not** deleted by app code (articles are append-only per section 10). Cleanup of the 6 known hub-page rows is called out as a manual step for the user to run in Supabase SQL Editor after this ships — not part of the pipeline change.

## Files likely to change

- `lib/scrapers/strategies.ts` — add `ap` regex to `SOURCE_LINK_PATTERNS`; add a shared non-article path-segment reject check (`/hub/`, `/video/`, `/live/`, etc.) applied inside `isArticleLink` for all strategies, not just the generic fallback.
- `lib/scrapers/parseArticle.ts` — stop defaulting `imageUrl`/`publishedAt`; return `null` when the source meta tag is absent; remove unused `FALLBACK_IMAGE`.
- `lib/scrapers/validateArticle.ts` (new) — `validateArticle(parsed, url): { valid: true } | { valid: false; reason: string }` implementing the section 13 content gate (missing date, missing image, generic title, body length/paragraph check).
- `lib/pipeline/scrape.ts` — call `validateArticle` before insert; skip and log-reject (via existing `logEvent`) instead of inserting when invalid; track a `rejected` counter alongside `discovered`/`inserted`/`skipped` in `SourceScrapeResult`.
- `supabase/seed.sql` — set AP's `parser_strategy` to `'ap'`.

## Implementation requirements

1. `SOURCE_LINK_PATTERNS.ap` matches only `https://apnews.com/article/...` URLs.
2. A shared reject check (used by every strategy, including named ones) rejects URLs whose path starts with `/hub/`, `/video/`, `/live/`, or that are the bare listing/homepage URL itself.
3. `parseArticle` returns `imageUrl: string | null` and `publishedAt: string | null`; no invented defaults.
4. `validateArticle` rejects when: `imageUrl` is null, `publishedAt` is null, title matches a generic/hub-style pattern, or body fails the paragraph/length gate. Otherwise valid.
5. `scrapeSource` skips insert and logs an `info`-level rejection (with `url` and `reason`) for invalid articles, and returns a `rejected: number` count in `SourceScrapeResult`.
6. No behavior change for sources that already have a specific regex (reuters/bbc/guardian/npr) beyond also passing through the new content gate after detail-page scrape.

## Security requirements

No new external calls, secrets, or exposed env vars. Purely local parsing/validation logic — no change to admin-secret or route auth.

## Acceptance criteria

- Scraping AP no longer inserts `/hub/*` or other non-article AP URLs.
- An AP article missing `og:image` or a publish date is rejected, not saved with a placeholder image or today's date.
- A hub-page-style title (e.g. "Africa News Reports | Latest News in Africa") is rejected even if it somehow passed the URL filter.
- `SourceScrapeResult` includes an accurate `rejected` count, and rejections are visible in the `logs` table / terminal output.
- Existing valid-article flow for reuters/bbc/guardian/npr is unaffected.

## Checks to run

- `npm run lint`
- `npm run build`

## Manual test steps

1. `npm run dev`.
2. Trigger a scrape for AP only:
   ```bash
   curl -X POST http://localhost:3000/api/scrape \
     -H "x-biasly-admin-secret: <BIASLY_ADMIN_SECRET>" \
     -H "Content-Type: application/json" \
     -d '{"sourceIds": ["ap"]}'
   ```
3. Watch the dev server terminal — confirm log lines show hub-page URLs rejected before/after detail scrape, and only `/article/...` URLs get inserted.
4. In Supabase SQL Editor, confirm no new rows in `articles` have `original_url` containing `/hub/`.
5. Manually clean up the 6 pre-existing bad AP rows (hub pages) via SQL Editor, e.g.:
   ```sql
   delete from public.article_analyses where article_id in (
     select id from public.articles where original_url like '%apnews.com/hub/%' or original_url like '%apnews.com%noticias%'
   );
   delete from public.articles where original_url like '%apnews.com/hub/%' or original_url like '%apnews.com%noticias%';
   ```
   (Confirm the exact URLs first with `select id, original_url, title from public.articles where source_id = 'ap';` since the sample above is a guess at the pattern.)
6. Reload the homepage — AP cards should now show distinct per-article images instead of the repeated brand graphic.
