# AI Article Analysis Pipeline

## Goal

Implement the AI analysis stage of the pipeline: detect valid articles with no `article_analyses` row, analyze each with the AI SDK + OpenAI provider, validate the output with Zod, and persist results to `article_analyses`. Expose this via `POST /api/analyze`, protected by the shared admin secret.

Scope is section 19 only (analysis). pgvector/embeddings (section 20) are explicitly out of scope for this task.

## Skills read

- `.agents/skills/supabase/SKILL.md` — query patterns, joined-table filter gotcha, service-role usage, security checklist.
- `.agents/skills/ai-sdk/SKILL.md` — do not trust memory for AI SDK APIs; read `node_modules/ai/docs/` and `node_modules/@ai-sdk/openai/docs/` (once installed) before writing the `generateObject`/structured-output call.

## Existing code inspected

- [lib/pipeline/scrape.ts](lib/pipeline/scrape.ts) — existing pipeline module pattern (result type, `logEvent` helper writing to `logs`, service-role client via `createServerClient()`).
- [app/api/scrape/route.ts](app/api/scrape/route.ts) — existing route pattern: `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `maxDuration = 300`, header-secret auth, JSON body parsing, try/catch → `NextResponse.json`.
- [supabase/schema.sql](supabase/schema.sql) — `article_analyses` table already exists with columns: `id`, `article_id` (unique FK), `neutral_summary`, `sentiment_score`, `sentiment_label`, `bias_score`, `bias_label`, `left_percentage`, `center_percentage`, `right_percentage`, `confidence`, `framing_notes`, `loaded_terms text[]`, `disclaimer`, `model_name`, `created_at`. Check constraints already enforce ranges and `left+center+right = 100`. No `embedding` column yet (added later, section 20) — do not add it now.
- [lib/supabase/database.types.ts](lib/supabase/database.types.ts) — typed `Database["public"]["Tables"]["article_analyses"]`.
- [lib/supabase/server.ts](lib/supabase/server.ts) — `createServerClient()` (service role) and `isSupabaseConfigured()`.
- [lib/news.ts](lib/news.ts) — reads use `analyzed_at IS NOT NULL`; nothing here needs to change for this task.
- `package.json` — `ai`, `@ai-sdk/openai`, and `zod` are **not yet installed**. Need to add them.
- `.env.local` — `OPENAI_API_KEY` is **not currently set**. User must add it before the route can run.

## Decisions / assumptions (confirmed with user)

- **Admin secret**: `/api/analyze` uses `BIASLY_ADMIN_SECRET` / header `x-biasly-admin-secret`, per AGENTS.md section 15/21 — this is the documented spec. This intentionally diverges from the existing `/api/scrape` route's `SKEW-admin-secret` / `x-skew-admin-secret`, which is a pre-existing inconsistency with AGENTS.md and is out of scope to fix here.
- Pending-detection uses a LEFT JOIN-style check (fetch article ids, fetch existing `article_analyses.article_id`, diff in JS) rather than `analyzed_at IS NULL`, per section 19 requirement 1.
- Batch size: `ANALYSIS_BATCH_SIZE` env var, default 5, per `.env.example` table. The route loops over all pending articles in batches until none remain (or until an optional caller-supplied limit/article-id list is satisfied).
- Model: OpenAI provider via AI SDK's structured-output function (`generateObject` or current equivalent — verify exact name/signature in `node_modules/ai/docs/` since it must not be assumed from memory). Model id to be selected by checking current OpenAI models are supported by `@ai-sdk/openai`; use a small, cost-appropriate text model (not vision/embedding). Confirm actual available model id in bundled docs/source rather than guessing from memory.
- `bias_score` is derived in code as `(right_percentage - left_percentage) / 100`, not requested from the model — per section 7/19.
- On invalid AI output (Zod validation failure), retry once; if still invalid, mark the article as failed (log it, do not save a row, do not set `analyzed_at`) and continue to the next article.
- `analyzed_at` is set only after a valid `article_analyses` row is successfully inserted.

## Files likely to change

- `package.json` / `package-lock.json` — add `ai`, `@ai-sdk/openai`, `zod`.
- `.env.example` — already documents `OPENAI_API_KEY`, `BIASLY_ADMIN_SECRET`, `ANALYSIS_BATCH_SIZE`; verify present and correct (add any missing).
- New: `lib/ai/analyzeArticle.ts` (or similar) — builds the prompt, calls the model, defines the Zod schema, validates output, computes `bias_score`.
- New: `lib/pipeline/analyze.ts` — orchestration: pending-detection query, batching loop, calls `lib/ai/analyzeArticle.ts`, inserts into `article_analyses`, updates `articles.analyzed_at`, logs progress/summary to `logs` (mirrors `lib/pipeline/scrape.ts` structure).
- New: `app/api/analyze/route.ts` — `POST` handler, `x-biasly-admin-secret` auth, accepts optional `{ limit?: number; articleIds?: string[] }` body, calls `lib/pipeline/analyze.ts`, returns the summary object.

## Implementation requirements

1. **Pending-analysis query**: fetch valid (non-null `raw_text`) articles (optionally filtered by caller's `articleIds`), fetch existing `article_analyses.article_id` for those ids in chunks of ≤15 (per the URL-existence-check pattern in AGENTS.md section 9, applied here to id lookups), and diff in JS to get the pending set. Do not use `.eq('foreignTable.column', …)` on a join.
2. **Batching**: process `ANALYSIS_BATCH_SIZE` (default 5, or caller `limit`) articles per batch; loop until no pending articles remain, unless the caller passed an explicit `limit`, in which case stop after that many.
3. **AI call**: for each article, call the model with the article's `title` + `raw_text` and require structured output matching a Zod schema for: `summary`, `sentiment_score` (-1..1), `sentiment_label`, `left_percentage`/`center_percentage`/`right_percentage` (0..100, sum 100), `bias_label` (`left`/`center`/`right`/`mixed`/`unclear`), `confidence` (0..1), `framing_notes`, `loaded_terms` (string array), `disclaimer`. Instruct the model explicitly to use article text evidence only, not source reputation, and to prefer `unclear`/low confidence when evidence is weak.
4. **Validation**: parse model output with Zod; if percentages don't sum to 100 or schema fails, retry once with the same input; if still invalid, log a failure entry and skip (no insert, no `analyzed_at` update).
5. **Persist**: insert into `article_analyses` with `bias_score` computed as `(right_percentage - left_percentage) / 100`, `disclaimer` defaulted if the model omits it, `model_name` set to the actual model id used. Then update the article's `analyzed_at` to now.
6. **Logging**: reuse the `logEvent`-style helper (info/error rows into `logs`) for per-article and per-batch events, plus a final summary object: `{ status, articlesChecked, analyzed, skipped, failed, batches, durationMs }` (skipped = articles that had no analyzable content, if applicable; failed = validation failures after retry).
7. **Route**: `POST /api/analyze`, `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `maxDuration = 300`, require `x-biasly-admin-secret` header matching `BIASLY_ADMIN_SECRET`, reject with 401 if missing/invalid, parse optional `{ limit, articleIds }` from JSON body, call the pipeline, return the summary JSON, 500 on unexpected error.

## Security requirements

- `OPENAI_API_KEY` and `BIASLY_ADMIN_SECRET` are server-only; never referenced in client components.
- `x-biasly-admin-secret` check happens before any DB or AI call.
- Use the service-role Supabase client (server-only) for all reads/writes — no client-exposed calls.
- No `SECURITY DEFINER` / RLS changes needed since this reuses existing tables and the service-role client (RLS is bypassed by service role, which is expected here).

## Acceptance criteria

- `POST /api/analyze` without a valid `x-biasly-admin-secret` returns 401 and performs no work.
- With a valid secret and pending unanalyzed articles present, the route analyzes them in batches, inserts valid `article_analyses` rows satisfying all existing check constraints, sets `analyzed_at`, and returns a summary object.
- Re-running the route with no pending articles left returns a summary with `analyzed: 0` and does no unnecessary AI calls.
- An article whose AI output fails validation twice is logged as failed, is not inserted, and `analyzed_at` stays null (so it remains pending and will be retried on the next run).
- `left_percentage + center_percentage + right_percentage = 100` and `bias_score` matches the derived formula for every inserted row.

## Checks to run

- `npm run typecheck`
- `npm run lint`
- `npm run build` (route/server module changes)

## Manual test steps

1. Ensure `.env.local` has `OPENAI_API_KEY` and `BIASLY_ADMIN_SECRET` set (add if missing; `BIASLY_ADMIN_SECRET` can be any local secret string).
2. Ensure there are scraped, unanalyzed articles: run the existing scrape flow if needed (`POST /api/scrape` with `x-skew-admin-secret`, per the existing route).
3. Start the dev server: `npm run dev` and watch its terminal for analysis progress logs.
4. Run analysis:
   ```bash
   curl -X POST http://localhost:3000/api/analyze \
     -H "x-biasly-admin-secret: <your BIASLY_ADMIN_SECRET value>" \
     -H "Content-Type: application/json" \
     -d '{}'
   ```
5. Confirm the JSON response summary shows `analyzed > 0` (if pending articles existed) and no unexpected `failed` entries.
6. Verify in Supabase (Table Editor or SQL Editor) that `article_analyses` rows exist for the analyzed articles and `articles.analyzed_at` is set.
7. Re-run the same curl command — expect `analyzed: 0` since no pending articles remain.
8. Confirm 401 without the header: `curl -X POST http://localhost:3000/api/analyze` (no header) → `{"error":"Unauthorized"}`.
