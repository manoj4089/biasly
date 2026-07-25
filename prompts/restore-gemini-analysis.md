# Restore Real AI Analysis (Gemini) — Replace Random Placeholder

## Goal

Turn off the temporary `randomPlaceholderAnalysis()` fallback in `lib/ai/analyzeArticle.ts` and route `analyzeArticle` back through the real Gemini call (`analyzeArticleWithGemini`), now that a working Google Generative Language API key is available. Update the target model since the one previously chosen is deprecated for new keys.

## Skills read

- `.agents/skills/ai-sdk/SKILL.md` — do not trust memory for AI SDK APIs/model IDs; verified the model directly against the live Gemini API instead of guessing.

## Existing code inspected

- [lib/ai/analyzeArticle.ts](lib/ai/analyzeArticle.ts) — `analyzeArticleWithGemini` (lines 42-51) already implements the real call via `generateText` + `Output.object({ schema: analysisSchema })`, using `GEMINI_MODEL = "gemini-2.5-flash"`. `analyzeArticle` (line 93) currently just calls `randomPlaceholderAnalysis()` and ignores its arguments. `ANALYSIS_MODEL` constant is `"random-placeholder"`.
- `prompts/gemini-provider-swap.md` and `prompts/random-analysis-placeholder.md` — prior session's history: first attempt at a Gemini swap used a malformed pasted key and a model that's since been deprecated; the placeholder was added afterward specifically so the pipeline could be exercised without any working AI key.
- `.env.local` — currently has no `GOOGLE_GENERATIVE_AI_API_KEY` line (only `OPENAI_API_KEY`, which returned `insufficient_quota` on real test calls).
- `.env.example` — documents `OPENAI_API_KEY` still; needs `GOOGLE_GENERATIVE_AI_API_KEY` added.
- `package.json` — `@ai-sdk/google` already installed (`^4.0.23`).

## Decisions / assumptions

- **Model:** tested the user's new key directly against `generativelanguage.googleapis.com`. `gemini-2.5-flash` and `gemini-2.5-flash-lite` return 404 ("no longer available to new users"); `gemini-2.0-flash` returned 429 quota-exceeded on this key; `gemini-flash-latest` returned a real 200 completion. Using `gemini-flash-latest` (an alias Google keeps pointed at their current recommended flash model, so it won't go stale like a pinned version number).
- Key format: the pasted key starts with `AQ.` rather than the classic `AIzaSy...` format, but it authenticates and generates content successfully — confirmed via direct API calls, not assumed.
- Leaving `OPENAI_API_KEY` and `@ai-sdk/openai` in place (unused) rather than removing, since nothing else references them yet and removing is out of scope for this fix.
- `ANALYSIS_MODEL` constant changes from `"random-placeholder"` to `"gemini-flash-latest"` so new `article_analyses.model` values correctly reflect the real model used (existing placeholder rows stay labeled `random-placeholder` and are not touched/reprocessed by this change).
- `randomPlaceholderAnalysis` function is left in the file (unused, not deleted) as a documented fallback, matching the pattern already used for `analyzeArticleWithGemini`.

## Files likely to change

- `.env.local` — add `GOOGLE_GENERATIVE_AI_API_KEY=<the key>`.
- `.env.example` — add `GOOGLE_GENERATIVE_AI_API_KEY` row (keep `OPENAI_API_KEY` row too, both documented since both packages remain installed).
- `lib/ai/analyzeArticle.ts` — change `GEMINI_MODEL` to `"gemini-flash-latest"`, change `ANALYSIS_MODEL` to `"gemini-flash-latest"`, change `analyzeArticle` to call `analyzeArticleWithGemini(title, rawText)` instead of `randomPlaceholderAnalysis()`.

## Implementation requirements

1. Add `GOOGLE_GENERATIVE_AI_API_KEY` to `.env.local` (server-only var; the AI SDK's `google()` provider reads it by default, no code needs to reference it directly).
2. Add `GOOGLE_GENERATIVE_AI_API_KEY` to `.env.example` with a placeholder value.
3. In `lib/ai/analyzeArticle.ts`: set `GEMINI_MODEL = "gemini-flash-latest"`, set `ANALYSIS_MODEL = "gemini-flash-latest"`, and change the body of `analyzeArticle` to `return analyzeArticleWithGemini(title, rawText);` (parameters renamed from `_title`/`_rawText` back to `title`/`rawText` since they're now used).
4. No changes to `analysisSchema`, `lib/pipeline/analyze.ts`, or any route — the function signature and return shape are unchanged.

## Security requirements

- `GOOGLE_GENERATIVE_AI_API_KEY` stays server-only, never referenced in client components.
- No change to `/api/analyze` auth (`x-biasly-admin-secret` check untouched).

## Acceptance criteria

- `POST /api/analyze` produces real Gemini-generated analysis (not random data) and saves valid `article_analyses` rows.
- New rows have `model = "gemini-flash-latest"`.
- `npm run typecheck` and `npm run lint` pass.
- No remaining call to `randomPlaceholderAnalysis` from `analyzeArticle`.

## Checks to run

- `npm run typecheck`
- `npm run lint`

## Manual test steps

1. Confirm `.env.local` has `GOOGLE_GENERATIVE_AI_API_KEY` set (after this change) and the admin secret var set.
2. `npm run dev` and watch its terminal.
3. Ensure at least one scraped, unanalyzed article exists (run `/api/scrape` first if needed).
4. Trigger analysis:
   ```bash
   curl -X POST http://localhost:3000/api/analyze \
     -H "x-biasly-admin-secret: <your admin secret>" \
     -H "Content-Type: application/json" \
     -d '{}'
   ```
5. Watch the dev server terminal for analysis logs; confirm no Gemini auth/model errors.
6. In Supabase, check new `article_analyses` rows: `model = 'gemini-flash-latest'`, summary/framing_notes read like real article-specific content (not the placeholder strings), percentages sum to 100.
7. Load the home page / article details page and confirm real analysis renders correctly.
