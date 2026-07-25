# Swap pgvector Embeddings Provider: OpenAI → Gemini

## Goal

Replace the OpenAI `text-embedding-3-small` call in the embedding step with Google Gemini's `gemini-embedding-001`, since the project no longer uses OpenAI at all (analysis already runs on Groq; the OpenAI key is only used for embeddings and its quota/billing is currently exhausted). Keep the `article_analyses.embedding vector(1536)` column and `match_related_articles` RPC untouched by requesting 1536-dimensional output from Gemini, avoiding any schema/migration changes.

## Skills read

- `.agents/skills/ai-sdk/SKILL.md` — general AI SDK guidance (embeddings, provider swap patterns).

## Existing code inspected

- [lib/ai/embedArticle.ts](lib/ai/embedArticle.ts) — currently: `import { openai } from "@ai-sdk/openai"`; `embed({ model: openai.embedding("text-embedding-3-small"), value: text })`. This is the only file that calls OpenAI anywhere in the codebase.
- [lib/pipeline/analyze.ts](lib/pipeline/analyze.ts) — calls `embedArticleText(text)` via `embedWithRetry` in two places (new-analysis path and embedding-backfill path); no changes needed here, it's provider-agnostic.
- `node_modules/@ai-sdk/google/dist/index.d.ts` — confirms `google.embedding(modelId)` returns an `EmbeddingModelV4`; `GoogleEmbeddingModelId` includes `'gemini-embedding-001'`; provider options schema (`googleEmbeddingModelOptions`) supports `outputDimensionality?: number` and `taskType?: "RETRIEVAL_DOCUMENT" | ...` — confirms Gemini embeddings can be truncated to exactly 1536 dimensions and tagged for document-retrieval use, matching how these embeddings are used (cosine similarity search via `match_related_articles`).
- `package.json` — `@ai-sdk/google` is already a dependency (from the earlier analysis-provider swap in `prompts/gemini-provider-swap.md`), so no new package install needed.
- `.env.local` / `.env.example` — `GOOGLE_GENERATIVE_AI_API_KEY` is already set and already used for analysis (per `lib/ai/analyzeArticle.ts` history). `OPENAI_API_KEY` is set but its quota is exhausted (confirmed via Supabase `logs` table: `AI_APICallError: You exceeded your current quota...`).
- [AGENTS.md](AGENTS.md) section 20 currently says "call OpenAI text-embedding-3-small for each article"; section 21's env table lists `OPENAI_API_KEY` for "`text-embedding-3-small` embeddings". Both need updating to describe Gemini instead, since AGENTS.md is the project's own source of truth and should reflect what the code actually does.

## Decisions / assumptions

- **Model**: `gemini-embedding-001` with `providerOptions: { google: { outputDimensionality: 1536, taskType: "RETRIEVAL_DOCUMENT" } }`. This keeps the existing `vector(1536)` column and IVFFlat index valid with no SQL migration.
- **`OPENAI_API_KEY` and `@ai-sdk/openai`**: left in place but now fully unused anywhere in the codebase (matches how the earlier Gemini analysis swap left it in place "in case"). Flagging this: if you want it fully removed (package + env var + `.env.example` row), say so and I'll drop it in the same change — otherwise it stays as a harmless unused dependency.
- **Retry/backfill logic in `lib/pipeline/analyze.ts`** (`embedWithRetry`, `MAX_RETRIES`, error logging into `logs`) is provider-agnostic and untouched — only the model call inside `embedArticleText` changes.
- **AGENTS.md updates**: section 20's "call OpenAI text-embedding-3-small" sentence and section 21's env table row for embeddings both get updated to reference Gemini `gemini-embedding-001` / `GOOGLE_GENERATIVE_AI_API_KEY`, keeping AGENTS.md accurate as the project's own instructions require ("Keep this table and `.env.example` in sync when variables change").

## Files likely to change

- `lib/ai/embedArticle.ts` — swap `openai.embedding("text-embedding-3-small")` for `google.embedding("gemini-embedding-001")` with the 1536-dim provider option.
- `AGENTS.md` — section 20 embedding sentence, section 21 env var table row (repurpose the `OPENAI_API_KEY` row description to Gemini, or remove it and note `GOOGLE_GENERATIVE_AI_API_KEY` now covers both analysis and embeddings).
- `.env.example` — remove or comment the now-fully-unused `OPENAI_API_KEY` row only if you confirm full removal in the question above; otherwise leave as-is.

## Implementation requirements

1. In `lib/ai/embedArticle.ts`: import `google` from `@ai-sdk/google` instead of `openai` from `@ai-sdk/openai`; change `EMBEDDING_MODEL` to `"gemini-embedding-001"`; call `embed({ model: google.embedding(EMBEDDING_MODEL), value: text, providerOptions: { google: { outputDimensionality: 1536, taskType: "RETRIEVAL_DOCUMENT" } } })`.
2. Confirm the returned `embedding` array length is 1536 at runtime during manual testing (Gemini's default output is 3072-dim; `outputDimensionality` must actually truncate it — verify via a real API call, not just types).
3. Update AGENTS.md section 20 and section 21 to describe Gemini instead of OpenAI for embeddings.
4. No Supabase schema changes, no changes to `match_related_articles`, no changes to `lib/pipeline/analyze.ts` call sites.

## Security requirements

- `GOOGLE_GENERATIVE_AI_API_KEY` is server-only (already the case); no new client exposure.
- No route/auth changes.

## Acceptance criteria

- `POST /api/analyze` successfully backfills embeddings for the 36 previously-analyzed-but-unembedded articles (and any future pending ones) using Gemini instead of OpenAI, with no `AI_APICallError` quota failures.
- Embedding vectors saved to `article_analyses.embedding` are exactly 1536 dimensions (matches the existing column type; Supabase will reject a mismatched-dimension insert, which doubles as a correctness check).
- `npm run typecheck` and `npm run lint` pass.
- No remaining reference to `@ai-sdk/openai` inside `lib/ai/embedArticle.ts`.

## Checks to run

- `npx tsc --noEmit`
- `npm run lint`

## Manual test steps

1. `npm run dev`.
2. Re-run analysis to trigger the embedding-backfill path for the 36 already-analyzed articles (no `analyzed_at`/analysis re-run needed, just embeddings):
   ```bash
   curl -X POST http://localhost:3000/api/analyze \
     -H "x-skew-admin-secret: <value from .env.local SKEW-admin-secret>" \
     -H "Content-Type: application/json" \
     -d '{}'
   ```
3. Confirm the JSON response shows `"embeddingsBackfilled": 36` (or close to it, allowing for the 4 previously-failed-analysis articles which stay pending) and no embedding errors.
4. Spot-check in Supabase SQL Editor: `select article_id, vector_dims(embedding) from article_analyses where embedding is not null limit 5;` — confirm `vector_dims` returns `1536` for each row.
5. Open a details page for an article with at least one similarly-topical analyzed article (e.g. two articles about the same event) at `/news/{id}` — confirm the "Related Stories" section now renders with real cosine-similarity matches.
