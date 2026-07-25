# Temporary: Random Placeholder Analysis (No AI Billing)

## Goal

Replace the real Gemini call in `analyzeArticle` with a locally-generated random-but-valid analysis object, so the pipeline (`/api/analyze`, `article_analyses` inserts, article cards, details page) can be exercised end-to-end without a paid/working AI API key. No network call to Gemini/OpenAI.

## Skills read

- `.agents/skills/ai-sdk/SKILL.md` — not applicable here since no AI SDK call is made in the replacement path; kept for context only.

## Existing code inspected

- [lib/ai/analyzeArticle.ts](lib/ai/analyzeArticle.ts) — `analyzeArticle(title, rawText)` currently calls `generateText` with the Gemini provider and returns `ArticleAnalysisOutput` validated by `analysisSchema`. The schema and its constraints (percentages sum to 100, ranges, enums) are the contract the rest of the pipeline depends on.
- [lib/pipeline/analyze.ts:91](lib/pipeline/analyze.ts#L91) — calls `analyzeArticle(article.title, article.raw_text)` and on success inserts into `article_analyses` with `model_name: ANALYSIS_MODEL` (line 128); on thrown error it retries once then marks the article failed. None of this needs to change if `analyzeArticle` keeps its same signature and return shape.

## Decisions / assumptions

- This is a **temporary swap**, not a permanent feature — real AI analysis will be restored once billing/a working key is sorted. I'll keep the Gemini implementation intact but unused (not delete it), so restoring it later is a one-line revert.
- `analyzeArticle` becomes a synchronous-logic (still `async`) function that fabricates a valid `ArticleAnalysisOutput` using `Math.random()`, satisfying every constraint in `analysisSchema` (percentages are integers summing to exactly 100; `bias_label` matches the strongest percentage or falls back to `unclear`/`mixed` when close, mirroring the original instructions' intent, though this no longer reflects real article content since no real analysis is happening).
- `ANALYSIS_MODEL` constant is changed to `"random-placeholder"` so `article_analyses.model_name` clearly marks these rows as fake data, not a real Gemini/OpenAI analysis — this makes it trivial to spot and re-analyze once real AI is restored.
- `disclaimer` field is hardcoded to something like `"Placeholder analysis — AI billing not yet configured; this is not a real estimate."` so nobody mistakes it for genuine output if seen on the details page.
- `summary` and `framing_notes` are short generic placeholder strings (not derived from `rawText`) since generating a fake-but-plausible summary from real text without an LLM isn't meaningful — being explicit here to avoid the false impression the app "read" the article.
- `loaded_terms` returns an empty array (no real basis to invent terms).
- No import of `@ai-sdk/google` or `ai` in the new code path — avoids any network call, so this works with zero API keys configured.

## Files likely to change

- `lib/ai/analyzeArticle.ts` — replace the `generateText` call in `analyzeArticle` with random generation logic; update `ANALYSIS_MODEL`.

## Implementation requirements

1. Keep `analysisSchema`, `ArticleAnalysisOutput`, and the function signature `analyzeArticle(title: string, rawText: string): Promise<ArticleAnalysisOutput>` unchanged so `lib/pipeline/analyze.ts` needs no edits.
2. Generate: random integer percentages `left/center/right` in [0,100] that sum to exactly 100 (e.g. pick two random cut points on a 0–100 line). Derive `bias_label` from whichever percentage is highest (`left`/`center`/`right`); if the top two are within 10 points of each other, use `"mixed"`. Random `confidence` in [0,1]. Random `sentiment_score` in [-1,1] and matching `sentiment_label` (`negative` if < -0.15, `positive` if > 0.15, else `neutral`).
3. Static/generic `summary`, `framing_notes`, `disclaimer` strings clearly marked as placeholder data (see decisions above). `loaded_terms: []`.
4. Validate the generated object against `analysisSchema` before returning (parse, don't just trust the generator) — keeps the same safety net `lib/pipeline/analyze.ts` expects.
5. No network calls, no `GOOGLE_GENERATIVE_AI_API_KEY`/`OPENAI_API_KEY` reads in this path.
6. Leave the real Gemini implementation in place but commented out or renamed to an unused function (e.g. `analyzeArticleWithGemini`) so it's easy to restore — do not delete it.

## Security requirements

- No new env vars or secrets touched. No behavior change to auth/admin-secret checks on `/api/analyze`.

## Acceptance criteria

- `POST /api/analyze` succeeds end-to-end with no AI API key configured (or an invalid one), inserting `article_analyses` rows that satisfy all existing DB check constraints.
- Article cards and the details page render the placeholder analysis without errors.
- `model_name` on new rows reads `"random-placeholder"` so real vs. fake rows are distinguishable in Supabase.
- `npm run` typecheck (`npx tsc --noEmit`) and lint pass.

## Checks to run

- `npx tsc --noEmit`
- `npm run lint`

## Manual test steps

1. `npm run dev`.
2. Ensure at least one scraped, unanalyzed article exists.
3. ```bash
   curl -X POST http://localhost:3000/api/analyze \
     -H "x-biasly-admin-secret: <your admin secret>" \
     -H "Content-Type: application/json" \
     -d '{}'
   ```
4. Confirm the summary response shows `analyzed > 0` with no `failed` entries, and no network errors in the terminal.
5. In Supabase, check the new `article_analyses` row(s): `model_name = 'random-placeholder'`, `left_percentage + center_percentage + right_percentage = 100`, disclaimer visibly marked as placeholder.
6. Load the home page / article details page and confirm the card and details view render the placeholder sentiment/framing data without layout or type errors.
