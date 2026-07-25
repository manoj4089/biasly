# Swap AI Analysis Provider: OpenAI → Gemini

## Goal

Switch the article-analysis model call in `lib/ai/analyzeArticle.ts` from the OpenAI provider (`gpt-5-mini`) to the Google Gemini provider, using the user's pasted Gemini key, while keeping the existing Zod schema, prompt, and structured-output flow unchanged.

## Skills read

- `.agents/skills/ai-sdk/SKILL.md` — do not trust memory for AI SDK APIs; read the bundled, version-matched docs before writing code.
- Read `node_modules/@ai-sdk/google/docs/15-google.mdx` (installed locally to inspect — package not yet added to `package.json`).

## Existing code inspected

- [lib/ai/analyzeArticle.ts](lib/ai/analyzeArticle.ts) — currently imports `openai` from `@ai-sdk/openai`, calls `generateText({ model: openai(ANALYSIS_MODEL), instructions, output: Output.object({ schema }), prompt })`. `ANALYSIS_MODEL = "gpt-5-mini"`. Schema, instructions, and validation logic stay as-is.
- `package.json` — has `@ai-sdk/openai@^4.0.20` and `ai@^7.0.37`. `@ai-sdk/google` is not installed.
- `.env.local` — has `OPENAI_API_KEY` set, plus a pasted `Gemini_API_Key = AQ.Ab8RN6Jr...` (note: this value's format, starting with `AQ.`, does not match the normal Google AI Studio key format `AIzaSy...`; it looks like it could be an OAuth-style token rather than a Generative Language API key, and may not authenticate. Flagged to user — proceeding on their instruction, but if `/api/analyze` fails with a 401/403 from Google, the fix is to generate a real key at https://aistudio.google.com/apikey and replace this value).
- `.env.example` — documents `OPENAI_API_KEY`.
- `node_modules/@ai-sdk/google/docs/15-google.mdx` — confirms: default provider instance `google` from `@ai-sdk/google`; API key defaults to env var `GOOGLE_GENERATIVE_AI_API_KEY` (sent as `x-goog-api-key` header); model ids like `gemini-2.5-flash`; supports `Output.object` structured output via `generateText`, same call shape already used in this file.

## Decisions / assumptions

- Model: `gemini-2.5-flash` — cost/latency tier roughly matching the current `gpt-5-mini` choice, and confirmed in the docs table to support Object Generation.
- Env var name: `GOOGLE_GENERATIVE_AI_API_KEY` (the AI SDK's default — avoids passing `apiKey` manually). The user's `.env.local` line will be renamed from `Gemini_API_Key = ...` to `GOOGLE_GENERATIVE_AI_API_KEY=...` (no spaces around `=`, matching the file's other entries).
- `OPENAI_API_KEY` and `@ai-sdk/openai` are left in place (not removed) since nothing else in the repo uses them yet — only the one import/call in `analyzeArticle.ts` changes. If you'd rather fully remove the OpenAI dependency, say so and I'll drop the package and env var too.
- `.env.example` gets `GOOGLE_GENERATIVE_AI_API_KEY` added (replacing/alongside `OPENAI_API_KEY` entry — will replace it since OpenAI is no longer used for analysis).

## Files likely to change

- `package.json` / `package-lock.json` — add `@ai-sdk/google`.
- `lib/ai/analyzeArticle.ts` — swap import and `model:` line, update `ANALYSIS_MODEL` constant to `"gemini-2.5-flash"`.
- `.env.local` — rename the pasted key line to `GOOGLE_GENERATIVE_AI_API_KEY=<value>`.
- `.env.example` — replace `OPENAI_API_KEY` row with `GOOGLE_GENERATIVE_AI_API_KEY`.

## Implementation requirements

1. Install `@ai-sdk/google` as a real dependency (`npm install @ai-sdk/google`).
2. In `lib/ai/analyzeArticle.ts`, replace `import { openai } from "@ai-sdk/openai"` with `import { google } from "@ai-sdk/google"`, change `ANALYSIS_MODEL` to `"gemini-2.5-flash"`, and change `model: openai(ANALYSIS_MODEL)` to `model: google(ANALYSIS_MODEL)`. No other logic changes.
3. Update `.env.local`: rename `Gemini_API_Key = AQ.Ab8RN6Jr...` to `GOOGLE_GENERATIVE_AI_API_KEY=AQ.Ab8RN6Jr...` (same value, correct env var name/format, no stray spaces).
4. Update `.env.example` to document `GOOGLE_GENERATIVE_AI_API_KEY` instead of `OPENAI_API_KEY`.

## Security requirements

- `GOOGLE_GENERATIVE_AI_API_KEY` is server-only; never referenced in client components (same rule as the OpenAI key it replaces).
- No changes to route auth, admin secret, or Supabase access.

## Acceptance criteria

- `POST /api/analyze` (existing route, unchanged) calls Gemini instead of OpenAI and still saves valid `article_analyses` rows matching the existing Zod schema and DB check constraints.
- `npm run typecheck` passes with the new import.
- No remaining reference to `@ai-sdk/openai` inside `lib/ai/analyzeArticle.ts`.

## Checks to run

- `npm run typecheck`
- `npm run lint`

## Manual test steps

1. Confirm `.env.local` has `GOOGLE_GENERATIVE_AI_API_KEY` set (after this change) and `BIASLY_ADMIN_SECRET`/admin-secret var set.
2. Start the dev server: `npm run dev` and watch its terminal.
3. Ensure at least one scraped, unanalyzed article exists (run `/api/scrape` first if needed).
4. Trigger analysis:
   ```bash
   curl -X POST http://localhost:3000/api/analyze \
     -H "x-biasly-admin-secret: <your admin secret>" \
     -H "Content-Type: application/json" \
     -d '{}'
   ```
5. Watch the dev server terminal for analysis logs; confirm no Gemini auth errors (401/403 would indicate the pasted key isn't a valid Generative Language API key — see the note above).
6. Verify in Supabase that new `article_analyses` rows were inserted with `model_name` reflecting `gemini-2.5-flash` and all check constraints satisfied (percentages sum to 100, etc).
