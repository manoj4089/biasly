# Switch AI analysis provider from Gemini to Groq

## Goal

`lib/ai/analyzeArticle.ts` currently calls Gemini (`@ai-sdk/google`, model `gemini-flash-latest`) for article analysis. Replace it with Groq via the AI SDK's Groq provider, using the user's Groq API key.

## Skills read

- `.agents/skills/ai-sdk/SKILL.md` — mandates never using model IDs from memory, verifying against bundled/live docs, and installing provider packages before writing code against them.

## Existing code inspected

- `lib/ai/analyzeArticle.ts` — exports `ANALYSIS_MODEL`, `analyzeArticle(title, rawText)`. Uses `generateText` + `Output.object({ schema })` with a Zod schema (`analysisSchema`) for structured output. Has a `randomPlaceholderAnalysis()` fallback (unrelated to this task, left untouched).
- `lib/pipeline/analyze.ts` — calls `analyzeArticle()` and saves `model_name` presumably from `ANALYSIS_MODEL` (need to confirm field name at write time).
- `package.json` — `@ai-sdk/google@^4.0.23`, `@ai-sdk/openai@^4.0.20` (installed but unused in code today), `ai@^7.0.37`. No `@ai-sdk/groq` installed yet.
- `.env.local` — has `GOOGLE_GENERATIVE_AI_API_KEY` and an unused `OPENAI_API_KEY`. No `GROQ_API_KEY` yet.
- `.env.example` — lists `GOOGLE_GENERATIVE_AI_API_KEY` and `OPENAI_API_KEY`.
- Verified via `npm view @ai-sdk/groq versions`: latest is `4.0.13`, same major line as the other installed `@ai-sdk/*` v4 packages paired with `ai@7`, so compatible.
- Queried `GET https://api.groq.com/openai/v1/models` live with the provided key. Confirmed the key works and found `openai/gpt-oss-120b` — 131072 context window, supports `structured_outputs`, `tools`, `json_mode`, text-only I/O. This is the best fit for the existing `Output.object(schema)` structured-output pattern (matches or exceeds what Gemini flash was doing).

## Decisions / assumptions

- Model: `openai/gpt-oss-120b` on Groq. Rationale: only large, general-purpose, text-only models on Groq's catalog with native `structured_outputs` support are the `openai/gpt-oss-*` family; `120b` is the strongest of the three for analysis quality (vs `20b` / `safeguard-20b`, which is a moderation-tuned variant).
- Keep the same `analysisSchema` and `INSTRUCTIONS` — only the model/provider call changes.
- Rename `analyzeArticleWithGemini` → `analyzeArticleWithGroq` (internal function, no external API change). `analyzeArticle()` export signature stays identical, so `lib/pipeline/analyze.ts` needs no changes.
- `ANALYSIS_MODEL` constant updates to `"openai/gpt-oss-120b"` — this is what gets saved as `model_name` in `article_analyses`, so existing rows keep their old model name and new rows reflect Groq.
- Add `@ai-sdk/groq` to `package.json` dependencies (install via npm). Leave `@ai-sdk/google` and `@ai-sdk/openai` installed but unused, since removing them is an unrelated cleanup not requested — actually, per AGENTS.md "avoid unrelated refactors," I will leave both in `package.json` untouched.
- `.env.local`: add `GROQ_API_KEY=<the key you provided>`. Leave `GOOGLE_GENERATIVE_AI_API_KEY` and `OPENAI_API_KEY` in place (harmless, unused).
- `.env.example`: add `GROQ_API_KEY=your-groq-api-key` row; leave the Gemini/OpenAI placeholder rows as-is (unrelated cleanup, not requested).
- Update the env var table in `AGENTS.md` (section 21) to add `GROQ_API_KEY` — this is a doc correctness fix since AGENTS.md's table is meant to be the canonical list and currently doesn't even mention `GOOGLE_GENERATIVE_AI_API_KEY`, which is already out of sync with the actual code. I will add `GROQ_API_KEY` only, not attempt a full provider-history cleanup of that table.

## Files likely to change

- `lib/ai/analyzeArticle.ts` — swap provider import and model call
- `package.json` / `package-lock.json` — add `@ai-sdk/groq`
- `.env.local` — add `GROQ_API_KEY`
- `.env.example` — add `GROQ_API_KEY` placeholder row
- `AGENTS.md` — add `GROQ_API_KEY` to the env var table

## Implementation requirements

1. `npm install @ai-sdk/groq`.
2. Read `node_modules/@ai-sdk/groq/docs/` (or README) once installed to confirm the exact import (`groq` from `@ai-sdk/groq`) and env var name it reads by default (expected `GROQ_API_KEY`, but verify rather than assume).
3. In `lib/ai/analyzeArticle.ts`:
   - Replace `import { google } from "@ai-sdk/google"` with `import { groq } from "@ai-sdk/groq"`.
   - Set `export const ANALYSIS_MODEL = "openai/gpt-oss-120b"`.
   - Rename `GEMINI_MODEL` → drop it, just reuse `ANALYSIS_MODEL` directly in the `model: groq(ANALYSIS_MODEL)` call (small simplification, no behavior change).
   - Rename `analyzeArticleWithGemini` → `analyzeArticleWithGroq`, update the call site in `analyzeArticle()`.
   - Keep `Output.object({ schema: analysisSchema })` structured output — verify Groq provider supports `Output.object` the same way (per AI SDK docs, provider-agnostic feature); if not supported, fall back to `generateObject` per the bundled AI SDK docs instead of guessing.
4. Add `GROQ_API_KEY=<user-provided-key>` to `.env.local`.
5. Add `GROQ_API_KEY=your-groq-api-key` to `.env.example`.
6. Add a `GROQ_API_KEY` row to the env var table in `AGENTS.md` section 21 (purpose: "AI analysis via Groq (`openai/gpt-oss-120b`)", server only).

## Security requirements

- `GROQ_API_KEY` is server-only, never exposed to browser code (already true — `analyzeArticle.ts` only runs server-side via `lib/pipeline/analyze.ts` → `/api/analyze`).
- Do not log the raw API key anywhere.
- `.env.local` stays gitignored (already confirmed via `.gitignore` line 33-34: `.env*`).

## Acceptance criteria

- `analyzeArticle(title, rawText)` returns a Zod-validated `ArticleAnalysisOutput` produced by a real call to Groq's `openai/gpt-oss-120b`, not Gemini.
- `ANALYSIS_MODEL` reflects the Groq model id and is saved as `model_name` on new `article_analyses` rows.
- No behavior change to `lib/pipeline/analyze.ts`, API routes, or the analysis schema/validation rules.
- `npm run typecheck` and `npm run lint` pass.

## Checks to run

- `npm run typecheck`
- `npm run lint`

(No `npm run build` — this is a server-only module swap, not a routing/config change, per AGENTS.md guidance to only build when the change could affect the build.)

## Manual test steps

1. Ensure `npm run dev` is running and `.env.local` has been reloaded (restart dev server after editing `.env.local`).
2. Trigger analysis on a small batch:

```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "x-biasly-admin-secret: <your BIASLY_ADMIN_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"limit": 1}'
```

3. Watch the terminal running `npm run dev` for analysis progress logs.
4. Confirm the response summary shows `analyzed: 1` (or more) with no `failed` entries.
5. Query Supabase `article_analyses` for the newly analyzed row and confirm `model_name = 'openai/gpt-oss-120b'` and all fields (summary, percentages summing to 100, etc.) are populated.
