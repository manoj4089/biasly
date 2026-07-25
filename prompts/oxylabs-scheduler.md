# Oxylabs Scheduler + Vercel Cron for automatic hourly pipeline

## Goal

Implement Oxylabs Scheduler integration so source homepages are scraped automatically every hour, with a Vercel Cron job that processes completed Oxylabs runs and then runs AI analysis — no manual intervention required after one-time setup (AGENTS.md section 18).

## Skills read

- `.agents/skills/oxylabs-web-scraper/SKILL.md`
- `.agents/skills/supabase/SKILL.md`
- Live Oxylabs Scheduler docs fetched from `https://developers.oxylabs.io/products/web-scraper-api/features/scheduler` and `.../integration-methods/push-pull.md` (see "Oxylabs Scheduler API contract" below — endpoint paths/fields confirmed today, not from training data).

## Existing code inspected

- `lib/pipeline/scrape.ts` — `scrapeSource()` does: live homepage fetch via `scrapePage()` → `extractLinks` + `isArticleLink` → dedupe against `articles.original_url` (single `.in()` call, no chunking yet) → per-candidate detail scrape → `parseArticle` → `validateArticle` → insert. `scrapeActiveSources()` loads active sources and loops `scrapeSource`.
- `lib/pipeline/analyze.ts` — `analyzePendingArticles()` already implements the LEFT-JOIN-style pending check (via `article_analyses` presence, not `analyzed_at`), batching, retries, embedding backfill, and logging. No changes needed here; the cron route calls it as-is.
- `lib/oxylabs/client.ts` — `oxylabsQuery()` / `scrapePage()` hit `https://realtime.oxylabs.io/v1/queries` only. No Scheduler or Push-Pull client exists yet.
- `app/api/scrape/route.ts`, `app/api/analyze/route.ts` — both `POST`, guarded by `isAuthorized()` checking header `x-skew-admin-secret` against env var `SKEW-admin-secret` (note the literal existing var name, unusual but already in `.env.local`).
- `supabase/schema.sql` — `oxylabs_schedules` (id, name, `source_ids text[]`, cron_expression, active, external_schedule_id) and `oxylabs_schedule_runs` (id, schedule_id, external_run_id, status, started_at, finished_at, error_message) already exist and are RLS-enabled with grants only to `service_role` (not exposed to anon/authenticated).
- `lib/scrapers/{html,parseArticle,strategies,validateArticle}.ts` — reusable, source-agnostic pipeline pieces; scheduler processing must reuse these exactly, not fork them.
- No `vercel.json` exists yet. No `app/api/oxylabs/*` or `app/api/cron/*` routes exist yet.
- `.env.local` has `SKEW-admin-secret` but no `CRON_SECRET` (correct — AGENTS.md says never add `CRON_SECRET` to `.env.local`, Vercel injects it).

## Oxylabs Scheduler API contract (fetched live today)

Base URL: `https://data.oxylabs.io/v1/schedules` (Basic Auth, same `OXY_WSA_USERNAME`/`OXY_WSA_PASSWORD`).

- `POST /v1/schedules` — body `{ cron, items, end_time }` (all required). `items` is an array of scraper job param objects (same shape as a `universal` Realtime query body). Response includes `schedule_id` (large int), `active`, `items_count`, `cron`, `end_time`, `next_run_at`.
- `GET /v1/schedules` — response `{ schedules: [ids...] }` (large ints).
- `GET /v1/schedules/{id}` — schedule metadata + stats.
- `GET /v1/schedules/{id}/runs` — response `{ runs: [{ run_id, jobs: [{ id, create_status_code, result_status, created_at, result_created_at }], success_rate }] }`. `result_status` is `"done" | "failed" | "pending"`. Job `id` is a large int.
- `PUT /v1/schedules/{id}/state` — body `{ active: boolean }`, `202` empty response. This is the only way to deactivate; there is no delete endpoint.
- Job results: `GET https://data.oxylabs.io/v1/queries/{job_id}/results` → `{ results: [{ content, created_at, updated_at, page, url, job_id, status_code }] }`. `job_id` here is returned as a JSON string in the docs' example, but the job `id` inside `/runs` responses is a bare (unquoted) large integer — per AGENTS.md's large-integer rule, both `schedule_id` and job `id` must be read from raw response text (regex/string extraction) before any `JSON.parse`, never round-tripped through a parsed JS number.

## Decisions / assumptions (confirmed with user)

1. **Admin secret**: new manual-trigger routes (`POST /api/oxylabs/schedules`, `POST /api/oxylabs/scheduled-results/process`) reuse the existing convention — header `x-skew-admin-secret`, env var `SKEW-admin-secret` — for consistency with `/api/scrape` and `/api/analyze`. Not the `BIASLY_ADMIN_SECRET` name from AGENTS.md section 15/21, which the existing code already deviates from.
2. **One schedule row per active source**: `oxylabs_schedules.source_ids` will always be a single-element array (`[source.id]`) per AGENTS.md's "one Oxylabs schedule per active source." The array column is kept as-is (no schema change) but only ever holds one id.
3. **`end_time`**: since Oxylabs requires it but we want indefinite hourly runs, set it to 5 years from creation time (`YYYY-MM-DD HH:MM:SS`, UTC). Re-running the sync route naturally extends coverage since it only creates schedules for sources that don't already have an active DB row.
4. **Sync route also retires schedules for deactivated sources**: if a source's `active` flips to `false`, its DB schedule row is deactivated (`active=false` in DB + `PUT .../state {active:false}` on Oxylabs) during the next sync call, not just orphans from deleted/recreated rows. This is a small, logical extension of the "orphan schedule deactivation" rule (section 18) — flag for confirmation, but proceeding since it avoids paying for schedules on sources the user turned off.
5. **`GET /api/oxylabs/schedules` and `GET /api/oxylabs/runs` also require the admin secret.** These read `oxylabs_schedules`/`oxylabs_schedule_runs`, which are not granted to `anon`/`authenticated` in `schema.sql` — leaving the API route open would defeat that RLS boundary. AGENTS.md section 14 lists them as plain `GET` (method rule only); this adds the secret as an access-control measure, consistent with "read/status routes" still being internal/admin tooling with no public UI consumer.
6. **Dedupe of processed Oxylabs jobs**: each processed job (`result_status === 'done'`) gets one row in `oxylabs_schedule_runs` keyed by `external_run_id = <job id string>` scoped to `schedule_id`. Before processing a job, check whether a row already exists for that `(schedule_id, external_run_id)` pair; skip if so. This prevents reprocessing the same homepage snapshot on every hourly cron tick (schedules/runs history accumulates over time, not just the latest run).
7. **Shared pipeline extraction**: `lib/pipeline/scrape.ts` will be refactored to extract the "have homepage HTML, produce inserted articles" portion (steps 3–8 of section 9) into an exported `processSourceHomepage(source, listingHtml, supabase)` function, used by both `scrapeSource()` (live fetch) and the new scheduler processing code. No behavior change to manual scraping.

## Files to change / add

- `lib/pipeline/scrape.ts` — extract `processSourceHomepage()`, export it; `scrapeSource()` becomes a thin wrapper (fetch homepage live, then call it).
- `lib/oxylabs/scheduler.ts` (new) — Scheduler API client: `createSchedule`, `listScheduleIds`, `getScheduleRuns`, `setScheduleState`, `getJobResult`. All large-int fields extracted from raw response text.
- `lib/pipeline/scheduler.ts` (new) — `syncOxylabsSchedules()` (create+orphan-cleanup logic) and `processScheduledResults()` (runs pipeline against completed job HTML, using `processSourceHomepage`, with the same run-logging summary shape as manual scrape).
- `app/api/oxylabs/schedules/route.ts` (new) — `POST` (sync) and `GET` (list stored rows), admin-secret-gated.
- `app/api/oxylabs/scheduled-results/process/route.ts` (new) — `POST`, admin-secret-gated, calls `processScheduledResults()`.
- `app/api/oxylabs/runs/route.ts` (new) — `GET`, admin-secret-gated, reads `oxylabs_schedule_runs`.
- `app/api/cron/pipeline/route.ts` (new) — `GET`, `CRON_SECRET`-gated (skipped in `NODE_ENV=development`), chains `processScheduledResults()` then `analyzePendingArticles()`; step two runs even if step one throws.
- `vercel.json` (new) — cron config, `15 * * * *` → `/api/cron/pipeline`.
- `.env.example` — add `CRON_SECRET` as a documented-but-not-set entry? No — AGENTS.md explicitly says don't add it to `.env.local`; `.env.example` is fine to leave undocumented too since Vercel injects it and it's not a developer-set value. Skip touching `.env.example`.

## Implementation requirements

- Reuse `logs` table writes (`level`, `message`, `metadata`) matching the existing `logEvent` pattern in `lib/pipeline/*.ts` for all new run logging (section 9's required log points: schedule sync start/done, per-schedule run fetch, per-job processed/skipped/duplicate/failed, final summary object).
- `processScheduledResults()` must run the same **URL existence check** chunking rule (max 15 URLs per `.in()`) — currently `scrapeSource` does a single unchunked `.in()`; fix this as part of the `processSourceHomepage` extraction so both manual and scheduled paths get chunked dedupe.
- Detail-page scraping inside scheduled processing still uses live `scrapePage()` (Realtime) per source's homepage-derived candidate URLs — only the *homepage* HTML comes from the Oxylabs job result; AGENTS.md section 18 only replaces the homepage fetch step, not detail scraping.
- `syncOxylabsSchedules()` steps: load active sources → for each without an existing active `oxylabs_schedules` row, `POST /v1/schedules` with `items: [{ source: "universal", url: source.listing_url, render: "html" }]`, `cron: "0 * * * *"`, computed `end_time` → insert DB row with raw-text-extracted `schedule_id` → after all creations, `GET /v1/schedules`, diff against DB `external_schedule_id`s that are still `active`, deactivate anything else (both Oxylabs `PUT .../state` and the DB row, if the DB row exists) → also deactivate DB rows (+ Oxylabs schedule) for sources that are no longer `active`.
- `processScheduledResults()` steps: load active DB schedule rows → for each, `GET /v1/schedules/{id}/runs` → filter `result_status === 'done'` jobs not already present in `oxylabs_schedule_runs` → fetch job HTML via `getJobResult` → run `processSourceHomepage(source, html, supabase)` → insert an `oxylabs_schedule_runs` row (`schedule_id`, `external_run_id`, `status: 'done'`, `started_at: job.created_at`, `finished_at: job.result_created_at`) to mark it processed → aggregate into the run-logging summary object (status, sources checked, candidates found/rejected, duplicates skipped, detail pages scraped, articles inserted/rejected/failed, total duration, rejection reasons by count).
- `/api/cron/pipeline`: `export const runtime = "nodejs"`, `dynamic = "force-dynamic"`, reasonable `maxDuration` (300, matching the other two pipeline routes). Auth: if `process.env.NODE_ENV !== "development"`, require `Authorization: Bearer ${process.env.CRON_SECRET}`; if `CRON_SECRET` is unset in a non-development environment, reject with 401 (fail closed). Step 1 wrapped in try/catch that logs and continues; step 2 always runs.
- Zod is not required here (no AI-shaped output to validate) but keep response bodies typed (no `any`).

## Security requirements

- Never expose `OXY_WSA_USERNAME`/`OXY_WSA_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`, `SKEW-admin-secret`, or `CRON_SECRET` to client code — all new code lives under `app/api/**/route.ts` and `lib/**` (server-only).
- `x-skew-admin-secret` check on both sync and process POST routes and on the two new GET routes (schedules, runs), matching `isAuthorized()` pattern from `app/api/scrape/route.ts`.
- `CRON_SECRET` check on the cron route only; never accept it via query string; constant-time comparison isn't required by AGENTS.md but a plain `===` check matches existing project convention.
- Do not log secret values themselves in the `logs` table or console output.

## Acceptance criteria

- `POST /api/oxylabs/schedules` creates exactly one Oxylabs schedule per active source lacking one, stores it in `oxylabs_schedules`, and deactivates orphaned/stale Oxylabs schedules not present (active) in the DB.
- `GET /api/oxylabs/schedules` returns stored schedule rows.
- `POST /api/oxylabs/scheduled-results/process` processes all completed, not-yet-processed job runs across all active schedules, inserting only valid articles and recording processed jobs in `oxylabs_schedule_runs`.
- `GET /api/oxylabs/runs` returns stored run rows.
- `GET /api/cron/pipeline` runs process-then-analyze in sequence, works unauthenticated in local dev, and requires a valid `CRON_SECRET` bearer token elsewhere.
- `vercel.json` registers the `:15` hourly cron.
- Manual scraping (`/api/scrape`) behavior and output are unchanged after the `processSourceHomepage` refactor.
- No secrets reach client bundles; `npm run build` succeeds.

## Checks to run

- `npm run typecheck`
- `npm run lint`
- `npm run build` (routes and server modules are changing)

## Manual test steps (after implementation)

1. Start dev server: `npm run dev` (keep terminal visible for logs).
2. Sync schedules:
   ```bash
   curl -X POST http://localhost:3000/api/oxylabs/schedules \
     -H "x-skew-admin-secret: $SKEW_ADMIN_SECRET"
   ```
3. List stored schedules:
   ```bash
   curl http://localhost:3000/api/oxylabs/schedules \
     -H "x-skew-admin-secret: $SKEW_ADMIN_SECRET"
   ```
4. Wait for at least one Oxylabs run to complete (top of the hour), then process results manually:
   ```bash
   curl -X POST http://localhost:3000/api/oxylabs/scheduled-results/process \
     -H "x-skew-admin-secret: $SKEW_ADMIN_SECRET"
   ```
5. Check recorded runs:
   ```bash
   curl http://localhost:3000/api/oxylabs/runs \
     -H "x-skew-admin-secret: $SKEW_ADMIN_SECRET"
   ```
6. Test the cron route locally (no secret needed in dev):
   ```bash
   curl http://localhost:3000/api/cron/pipeline
   ```
7. Confirm newly inserted articles get analyzed (`article_analyses` rows appear, `analyzed_at` set) and eventually show on the homepage.
8. After deploying, confirm Vercel Cron is registered under the project's Cron Jobs dashboard tab and fires `/api/cron/pipeline` at `:15` past each hour with a `401` rejected if `CRON_SECRET` is tampered with.
