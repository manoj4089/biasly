# pgvector Embeddings — Wire the Deferred AI Step

## Goal

Complete section 20 by wiring the actual embedding generation into `/api/analyze`. Schema, types, `getRelatedArticles`, and the Related Articles UI were already implemented in `prompts/related-articles-ui.md` and deliberately left the AI call out. This prompt implements only that remaining piece: call OpenAI `text-embedding-3-small` alongside article analysis and save the result to `article_analyses.embedding`, including backfill for any existing analysis rows where `embedding IS NULL`.

## Skills read

- `.agents/skills/supabase/SKILL.md` — general Supabase guidance (no pgvector-specific snippets; reused schema/RPC already in place).
- `.agents/skills/ai-sdk` (via AGENTS.md workflow) — confirmed `embed()` and `openai.embedding('text-embedding-3-small')` from the bundled docs at `node_modules/ai/docs/07-reference/01-ai-sdk-core/06-embed-many.mdx` and `node_modules/@ai-sdk/openai/docs/03-openai.mdx` (line ~2667: `text-embedding-3-small` → 1536 dimensions, matching the `vector(1536)` column exactly). `@ai-sdk/openai` is already a project dependency (`package.json`), so no install needed.

## Existing code inspected

- [supabase/schema.sql](supabase/schema.sql) — `vector` extension, `article_analyses.embedding vector(1536)`, IVFFlat index, and `match_related_articles` RPC are already present (lines 1, 52, 90-99).
- [lib/supabase/database.types.ts](lib/supabase/database.types.ts:19-21) — `article_analyses.Row.embedding: number[] | null` already typed; `Insert` already allows omitting `embedding`.
- [lib/supabase/queries/articles.ts](lib/supabase/queries/articles.ts) — `getRelatedArticles` already implemented and called from [app/news/[id]/page.tsx](app/news/[id]/page.tsx:18-20) whenever `article.analysis.embedding` is truthy.
- [lib/ai/analyzeArticle.ts](lib/ai/analyzeArticle.ts) — existing pattern for a small AI helper module: exports a named model constant, a Zod-validated output type, and an async function. No embedding-related code exists in `lib/ai/` yet.
- [lib/pipeline/analyze.ts](lib/pipeline/analyze.ts) — `analyzePendingArticles`:
  - `getPendingArticleIds` (line 35) treats *any* existing `article_analyses` row as "done", so it never detects rows with `embedding IS NULL`.
  - The insert at line 113 never sets `embedding`.
  - `analyzed_at` is set immediately after the insert succeeds (line 140), regardless of embedding.
- `.env.example` already has `OPENAI_API_KEY`; no new env vars needed.

## Decisions / assumptions

- **Embedding input text**: embed `${article.title}\n\n${summary}` — the title plus the AI's own neutral summary. This is available in both the fresh-analysis path (from the just-generated `output.summary`) and the backfill path (from the existing `article_analyses.neutral_summary`), keeps token cost low, and avoids re-embedding the full noisy `raw_text`.
- **Pending detection becomes two buckets**, replacing the current single `getPendingArticleIds`:
  - `missingAnalysis` — articles with no `article_analyses` row at all → run full analysis + embedding, insert.
  - `missingEmbedding` — articles with an `article_analyses` row where `embedding IS NULL` (the backfill case section 20 describes) → skip re-analysis, only generate + update embedding.
  - Both buckets respect the existing `articleIds` filter and are combined (missingAnalysis first, then missingEmbedding) before applying `limit`, so `limit` behaves as one coherent cap on total work per run, matching current semantics.
- **`analyzed_at` timing**: only set (or re-set) after the embedding is actually saved, per section 20's "Update `analyzed_at` only after both analysis and embedding are saved." Concretely:
  - Fresh analysis: insert `article_analyses` (with `embedding` if the embed call succeeded, else `null`); set `articles.analyzed_at` only if the embedding was saved. If embedding failed, the analysis row still exists with `embedding IS NULL`, so it's automatically retried as a backfill on the next run — no separate retry bookkeeping needed.
  - Backfill: update the existing row's `embedding`, then set `articles.analyzed_at` (covers the case where it was never set because the original embed attempt failed).
- **Retry**: reuse the existing `MAX_RETRIES = 2` attempt pattern already used for `analyzeArticle`, applied the same way to the embed call, logging each failed attempt via the existing `logEvent` helper.
- **Summary shape**: extend `AnalyzeSummary` with one new field, `embeddingsBackfilled: number`, counting backfill-only rows completed. Fresh-analysis embedding failures are visible via existing `logEvent` error logs (no new top-level counter, to avoid over-expanding the summary object) — the row simply remains pending and shows up again next run.

## Files likely to change

- `lib/ai/embedArticle.ts` — **new file**. Exports `EMBEDDING_MODEL = "text-embedding-3-small"` and `embedArticleText(text: string): Promise<number[]>` using `embed()` from `ai` and `openai.embedding(EMBEDDING_MODEL)` from `@ai-sdk/openai`.
- `lib/pipeline/analyze.ts`:
  - Replace `getPendingArticleIds` with a function returning `{ missingAnalysis: string[]; missingEmbedding: string[] }`.
  - In the batch loop, branch per id: full analysis (existing logic) + embedding for `missingAnalysis`; embedding-only update for `missingEmbedding`.
  - Add `embeddingsBackfilled` to `AnalyzeSummary` and the final/per-batch log payloads.

No changes needed to `supabase/schema.sql`, `database.types.ts`, `queries/articles.ts`, `app/news/[id]/page.tsx`, or `app/news-details/page.tsx` — all already correct for this feature.

## Implementation requirements

1. `lib/ai/embedArticle.ts`:
   ```ts
   import { embed } from "ai";
   import { openai } from "@ai-sdk/openai";

   export const EMBEDDING_MODEL = "text-embedding-3-small";

   export async function embedArticleText(text: string): Promise<number[]> {
     const { embedding } = await embed({ model: openai.embedding(EMBEDDING_MODEL), value: text });
     return embedding;
   }
   ```
2. In `analyze.ts`, build the embedding input as `` `${article.title}\n\n${summary}` `` (summary = fresh `output.summary` or existing `analysis.neutral_summary`).
3. Wrap the embed call in the same retry-with-logging pattern as `analyzeArticle` (`MAX_RETRIES = 2`), logging via `logEvent(supabase, "error", ...)` on each failed attempt.
4. Fresh-analysis path: insert `article_analyses` including `embedding: embeddingOrNull`; only update `articles.analyzed_at` when the embedding succeeded.
5. Backfill path: `update article_analyses set embedding = ... where article_id = ...`, then `update articles set analyzed_at = now() where id = ...`.
6. Log per-batch and final summary including `embeddingsBackfilled`, matching the existing `logEvent` style.
7. Model name saved to `article_analyses.model_name` stays the Groq analysis model (`ANALYSIS_MODEL`) — embeddings aren't tracked per-row by model name, consistent with the current schema (no separate embedding-model column).

## Security requirements

- No new secrets. `OPENAI_API_KEY` is already server-only (per `.env.example` and section 21's env table) and this change only adds a server-side call from the existing `/api/analyze` pipeline — never exposed to browser code.
- No change to the `x-skew-admin-secret` gate on `POST /api/analyze`.

## Acceptance criteria

- `npm run typecheck` and `npm run lint` pass.
- Running `/api/analyze` on articles with no `article_analyses` row produces a row with a populated `embedding` and sets `analyzed_at`.
- Running `/api/analyze` again with no new articles, but with an existing `article_analyses` row manually nulled out (`update article_analyses set embedding = null where id = '...'`), backfills that row's embedding without calling the Groq analysis model again, and sets `analyzed_at`.
- The news details page's Related Articles section (already built) now actually renders for articles that have embeddings.

## Checks to run

- `npx tsc --noEmit` (no `typecheck` script exists in `package.json`; running the compiler directly)
- `npm run lint`

## Manual test steps

1. Confirm the Supabase project actually has the schema from `supabase/schema.sql` applied (extension, `embedding` column, index, `match_related_articles` function) — this was flagged as a manual one-time step in `prompts/related-articles-ui.md`; verify it's done before testing, since embeddings can't save otherwise.
2. `npm run dev`, watch the terminal.
3. Trigger analysis on some pending articles:
   ```bash
   curl -X POST http://localhost:3000/api/analyze \
     -H "x-skew-admin-secret: <BIASLY/SKEW admin secret>" \
     -H "Content-Type: application/json" \
     -d '{"limit": 5}'
   ```
   Confirm the JSON response and terminal logs show `analyzed` > 0 and no embedding errors.
4. In Supabase SQL Editor, verify embeddings were saved: `select id, embedding is not null as has_embedding from article_analyses order by created_at desc limit 5;`
5. Test the backfill path: `update article_analyses set embedding = null where id = '<some analyzed row id>';` then re-run the same curl command (or with `"articleIds": ["<that article's id>"]`) and confirm the terminal logs a backfill (not a fresh Groq analysis call) and the row's `embedding` is non-null again.
6. Open `/news/<id>` for an article that has at least one embedded sibling article — confirm the "Related articles" section now renders with linked cards.
