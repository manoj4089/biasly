# Related Articles (pgvector) — Schema, Query, and UI Section

## Goal

Implement section 20's non-AI pieces: enable pgvector, add the `embedding` column, add `getRelatedArticles`, and render a "Related Articles" section on the news details page. Do **not** touch `/api/analyze` or add any OpenAI embedding call — embedding generation is the deferred AI part and will be wired in later. Until embeddings exist, the section stays hidden (this is already the spec's own requirement, not a workaround).

## Skills read

- `.agents/skills/supabase/SKILL.md` — general Supabase/Postgres extension guidance (no pgvector-specific snippets in this skill; using standard pgvector/Supabase RPC conventions).

## Existing code inspected

- [supabase/schema.sql](supabase/schema.sql) — `article_analyses` (lines 34-52) has no `embedding` column yet; no `vector` extension statement present.
- [lib/supabase/database.types.ts](lib/supabase/database.types.ts) — `article_analyses.Row` (line 19) has no `embedding` field.
- [lib/news.ts](lib/news.ts) — `getArticles`/`getArticleById` fetch `articles` + `article_analyses` + `sources` manually (no FK joins via PostgREST, matching the project's "no joined-table filter" pattern). `NewsArticle` type combines them.
- [lib/supabase/server.ts](lib/supabase/server.ts) — `createServerClient()` is the service-role client used server-side; reused for the new query.
- [app/news-details/page.tsx](app/news-details/page.tsx) — server component rendering the full details view (article column + analysis aside). Related Articles will be added as a new section after `analysis-column` (or as a full-width section below `main`).
- [app/news/[id]/page.tsx](app/news/[id]/page.tsx) — loads the article via `getArticleById` and passes it to `NewsDetailsPage`; will also fetch related articles and pass them down.
- [app/page.tsx](app/page.tsx) — has an existing `StoryCard` component pattern (image, kicker, title, bias meter) that the Related Articles cards should visually match (smaller variant).

## Decisions / assumptions

- **PostgREST can't do `ORDER BY embedding <=> $1` through the JS query builder.** The standard, safe pattern is a Postgres RPC function (`match_related_articles`) that takes the query embedding + current article id + limit, and does the `<=>` ordering server-side in SQL. `getRelatedArticles` calls this via `supabase.rpc(...)`. This avoids hand-building raw SQL strings in app code and keeps the vector operator in the database layer where indexes apply.
- **Embedding column type in TS**: pgvector columns come back from PostgREST as a string like `"[0.01,0.02,...]"` when selected directly, but since all reads go through the RPC function (which returns plain columns, no embedding value needed in the result), the app never has to parse a raw vector string. `database.types.ts` still needs `embedding: number[] | null` on `article_analyses.Row` for completeness/inserts (future AI step will insert `number[]`, which supabase-js serializes correctly for a `vector` column).
- **Enabling the extension**: per section 20, pgvector is enabled once in Supabase Dashboard → Database → Extensions (manual, one-time, not scriptable from here). I'll give the user the exact SQL Editor statements to run (extension + column + index + RPC function) since `schema.sql` is the source of truth but Supabase SQL must be run manually per AGENTS.md section 7/20 instructions.
- **Hiding the section**: `getRelatedArticles` is only called when `analysis.embedding` is non-null. Since no embeddings exist yet, this call is effectively skipped for now — the UI section won't appear until the deferred AI step backfills embeddings. This matches "Do not show the section when the current article has no embedding" exactly, so no special-casing needed later.
- **Card content for related articles**: title, image, source name, published date, bias_label — deliberately smaller/lighter than the home page `StoryCard` (no bias meter bar) since this is a sidebar/below-fold discovery module, not the primary grid.
- **Placement**: full-width `<section>` below `<main className="detail-layout">`, inside `site-shell`, so it spans both the article and aside columns rather than being squeezed into the narrower aside.

## Files likely to change

- `supabase/schema.sql` — add `create extension if not exists vector;`, `embedding vector(1536)` column on `article_analyses`, IVFFlat cosine index, and the `match_related_articles` SQL function definition (kept in the schema file as the source of truth, even though it must be applied manually per section 20).
- `lib/supabase/database.types.ts` — add `embedding: number[] | null` to `article_analyses.Row`/`Insert`/`Update`.
- `lib/supabase/queries/articles.ts` — **new file**. `getRelatedArticles(articleId: string, embedding: number[]): Promise<NewsArticle[]>` using the service-role client, calling the RPC, then hydrating source info the same way `lib/news.ts` does.
- `app/news/[id]/page.tsx` — after loading `article`, if `article.analysis.embedding` exists, call `getRelatedArticles` and pass `relatedArticles` prop to `NewsDetailsPage`.
- `app/news-details/page.tsx` — accept optional `relatedArticles?: NewsArticle[]` prop; render a `RelatedArticleCard` list in a new `related-articles` section, only when the array is non-empty.
- `app/globals.css` (or wherever `.story-card`/`.detail-layout` styles live) — add styles for `.related-articles`, `.related-grid`, `.related-card` matching the existing design language (checking the actual CSS file location during implementation).

## Implementation requirements

1. Add pgvector SQL to `supabase/schema.sql`:
   - `create extension if not exists vector;`
   - `alter table public.article_analyses add column if not exists embedding vector(1536);`
   - `create index if not exists article_analyses_embedding_idx on public.article_analyses using ivfflat (embedding vector_cosine_ops) with (lists = 100);`
   - A SQL function, e.g.:
     ```sql
     create or replace function match_related_articles(query_embedding vector(1536), exclude_article_id text, match_count int default 5)
     returns table (article_id text) language sql stable as $$
       select article_id from public.article_analyses
       where embedding is not null and article_id != exclude_article_id
       order by embedding <=> query_embedding
       limit match_count;
     $$;
     ```
     (Returns just `article_id`s; the app layer re-fetches full article/source/analysis rows the same way `lib/news.ts` already does, keeping one hydration pattern instead of duplicating joins in SQL.)
2. Update `database.types.ts` with the `embedding` field (nullable `number[]`).
3. Create `lib/supabase/queries/articles.ts`:
   - `getRelatedArticles(articleId, embedding)` calls `.rpc("match_related_articles", { query_embedding: embedding, exclude_article_id: articleId, match_count: 5 })`, then fetches full `articles` + `article_analyses` + `sources` rows for the returned ids (same shape as `NewsArticle`), filtering to only analyzed articles.
   - Reuse the **URL existence check**-style chunking guidance isn't needed here (max 5 ids), but still guard against an empty id list before querying.
4. Wire `app/news/[id]/page.tsx` to call `getRelatedArticles` only when `article.analysis.embedding` is truthy; pass result (possibly empty array) to `NewsDetailsPage`.
5. Add the Related Articles UI section to `app/news-details/page.tsx`:
   - Only rendered when `relatedArticles && relatedArticles.length > 0`.
   - Each card links to `/news/{id}`, shows image, source + date kicker, title, and bias label.
6. Style the new section to visually match the existing card/typography system (pull actual class names/colors from the current CSS during implementation instead of guessing).

## Security requirements

- `getRelatedArticles` runs server-side only (service-role client), never exposed to a client component or route callable from the browser.
- No new secrets; no changes to admin-secret or Clerk auth.

## Acceptance criteria

- `npm run typecheck` and `npm run lint` pass.
- With no articles having embeddings (current state), the news details page renders exactly as it does today — no Related Articles section, no errors.
- Code path for `getRelatedArticles` and the UI section is fully in place and correct, ready to activate automatically once the deferred AI step starts writing embeddings (no further UI changes needed then).

## Checks to run

- `npm run typecheck`
- `npm run lint`

## Manual test steps

1. Run the schema SQL block from this prompt in Supabase Dashboard → SQL Editor (extension, column, index, function) — one-time, manual, per section 20.
2. `npm run dev`, open an existing analyzed article's details page — confirm it renders exactly as before (no Related Articles section, no console errors), since no `embedding` values exist yet.
3. Optional manual smoke test of the UI itself (not required, since real embeddings come later): in SQL Editor, temporarily set `embedding` on 2-3 `article_analyses` rows to arbitrary `vector(1536)` test values (e.g. all-zeros or random), reload one of those articles' details pages, confirm the Related Articles section appears with correct cards, links, and styling. Revert those test values afterward (`update article_analyses set embedding = null where id = '...'`) so no fake data lingers.
