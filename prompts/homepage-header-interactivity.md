# Homepage header interactivity, live date, theme switching

## Goal

Every control in the homepage header/footer chrome currently renders but does nothing: the Theme "Light/Dark/Auto" labels are plain text, the utility-bar date is a hardcoded string ("Monday, June 1, 2026"), "Set Location" and "International Edition" have no dropdown, the hamburger menu button doesn't open anything, topic chips don't toggle, and most nav/footer links point at `#top-news` with no real behavior. Wire these up with real client-side interactivity and add an actual light/dark/auto theme system. Also fix the appearance of "missing" news card pictures.

## Skills read

None of the four approved skills (clerk, supabase, oxylabs-web-scraper, ai-sdk) apply — this is pure Next.js/client-component/CSS work. Read `node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md` for the canonical pattern used below (inline script in `<head>` to set `data-theme` before paint, `suppressHydrationWarning`, lazy `useState` initializer synced with the same localStorage key).

## Existing code inspected

- [app/page.tsx](../app/page.tsx) — homepage is a single async Server Component. Header, topic bar, story grid, and footer are all inline JSX with no client interactivity at all. Theme spans, date span, location/edition spans, menu button, topic chips, and most `<a>` links are static decoration.
- [app/layout.tsx](../app/layout.tsx) — root layout has no `data-theme` attribute or theme-init script.
- [app/globals.css](../app/globals.css) — 197 lines, one `:root` token block (light-only, no dark tokens), then mostly **hardcoded hex colors** per selector (`.utility-bar`, `.main-nav`, `.story-card`, `.site-footer`, etc.) rather than variables. No `[data-theme]` rules exist anywhere.
- [app/news-details/page.tsx](../app/news-details/page.tsx) — reuses `.main-nav` class for its own slim header (`brand` + "Back to news" link) but has no utility-bar/topic-bar/footer. Its article body, hero image, and analysis panels are separate CSS classes untouched by this prompt.
- [components/StoryCardLink.tsx](../components/StoryCardLink.tsx) — existing pattern for a small `"use client"` wrapper component that posts a PostHog event on click; same shape I'll follow for new client islands.
- **Image investigation** (queried Supabase `articles` directly): `image_url` values are valid, resolvable URLs — the pictures are not broken. Several of the top-sorted rows (`Africa News Reports | Latest News in Africa`, `Europe News...`, `Latin American News...`, `Asia Pacific...`, `China...`, `Iran war`) are AP **topic-hub pages**, not real articles, and they all share AP's generic gray default share image (`defaultshareimage-copy.png`) — that's why they look like blank/duplicate placeholders. This exact problem, and its scraper-side fix (`SOURCE_LINK_PATTERNS.ap` now restricts AP to `/article/...` URLs), is already documented and implemented per [prompts/ap-link-pattern-and-article-validation.md](./ap-link-pattern-and-article-validation.md) — confirmed the `ap` regex is live in [lib/scrapers/strategies.ts](../lib/scrapers/strategies.ts). That prompt's step 5 (deleting the pre-existing bad AP rows) was left as a manual SQL step and was never run — the bad rows are still in the DB today.

## Decisions / assumptions

- **Images**: no UI or pipeline code change needed for this — it was already fixed at the scraper level. The visible fix is deleting the ~6 leftover bad AP hub-page rows (and their `article_analyses`) from Supabase, per the SQL already written in `ap-link-pattern-and-article-validation.md` step 5. I will run this as a one-time cleanup **only after separate explicit confirmation**, since it deletes rows from the production database — it is not bundled into "implement the prompt" approval below.
- **Theme system**: add a real `light`/`dark`/`auto` theme using the Next.js-documented inline-script pattern — `<html data-theme="light" suppressHydrationWarning>` in `app/layout.tsx`, a synchronous inline `<script>` in `<head>` that reads `localStorage["biasly-theme"]` (`"light" | "dark" | "auto"`, default `"auto"`), resolves `auto` via `matchMedia("(prefers-color-scheme: dark)")`, and sets `data-theme` to the resolved `light`/`dark` before first paint. A new client component `ThemeToggle` (in `components/`) renders the three buttons, persists the preference, updates `data-theme` on click, and — when preference is `auto` — listens for OS theme changes via `matchMedia(...).addEventListener("change", ...)`.
- **Theme scope**: convert to CSS variables and add `[data-theme="dark"]` overrides for the chrome actually shown in the reported screenshot: `.utility-bar`, `.main-nav`, `.brand`, `.topic-bar`/`.topic-chip`, `.story-card`/`.story-image`/`.story-content`/`.bias-meter`, `.site-footer`, plus `body`/`:root` base tokens. The news-details article body/hero/analysis panels and the `/design-system` page are **not** themed in this pass (they're not part of what was screenshotted) — flagged as a follow-up, not silently dropped.
- **Date**: replace the hardcoded string with the real current date, formatted the same way ("Monday, June 1, 2026" style: `weekday: long, month: long, day: numeric, year: numeric`), using the doc's `LocalDate`-style pattern (SSR renders server's current date into a `<time suppressHydrationWarning>`, paired inline `<script>` corrects it to the browser's local date/timezone before paint). Not a live-ticking clock — correct on each load/navigation is sufficient for a news masthead.
- **Set Location**: click opens a small inline popover with a text input + "Save" button; value persists to `localStorage["biasly-location"]` and replaces the "Set Location" label (e.g. "New York, US") with a "Change" affordance to reopen it. No geolocation API — out of scope, and browser geolocation prompts are disruptive for a decorative masthead field.
- **Edition dropdown**: click opens a small popover listing a fixed set of editions (International, U.S., U.K., Asia); selecting one updates the label and persists to `localStorage["biasly-edition"]`. Purely cosmetic — no locale-specific content actually changes (out of scope; AGENTS.md section 1 doesn't include localized editions as a feature to build).
- **Menu button**: opens an off-canvas drawer (slide-in from the left, backdrop click / Escape / re-click to close) containing the primary nav links + the topic list — this is what makes navigation reachable at the `<820px` breakpoint where `.primary-nav` is currently `display: none` with no replacement.
- **Primary nav (For You / Local / Blindspot) and footer Company/Help links and social icons**: AGENTS.md section 1's "Build only" list doesn't include a For You feed, Local page, Blindspot page, or company/legal/social pages, so adding real destinations is over-scope. Instead of dead `href="#top-news"` anchors, clicking these shows a small transient "Coming soon" toast so the button visibly does something rather than silently no-op-ing. "Home" keeps its real behavior (already the current page).
- **Topic chips**: each chip's trailing "+" toggles a followed/added visual state (filled vs. outline style) for that chip, persisted to `localStorage["biasly-topics"]` as a list of followed topic names — this is local UI-preference state only, not written to Supabase (UI must not mutate pipeline state). The leading standalone "+" (`.topic-add`) opens a tiny inline text input to append a custom chip to the bar client-side (also localStorage-persisted, capped at a small max like 8 custom chips to avoid an unbounded bar).
- All new interactive pieces are small client components under `components/`, imported into the still-async Server Component `app/page.tsx` (which keeps fetching `getArticles()` server-side, unchanged) — no new API routes, no new admin-secret-protected endpoints, since nothing here starts or mutates pipeline work.

## Files likely to change

- `app/layout.tsx` — add `data-theme` attr + inline theme-init script to `<html>`/`<head>`.
- `app/globals.css` — add dark-mode CSS variables + `[data-theme="dark"]` overrides for the scoped selectors above; add drawer/popover/toast styles.
- `app/page.tsx` — replace static header/topic-bar/footer markup with the new client components; keep story-fetching logic as-is.
- `components/ThemeToggle.tsx` (new) — Light/Dark/Auto buttons + OS-theme listener.
- `components/MastheadControls.tsx` (new, or split into `LocationPicker.tsx` / `EditionPicker.tsx`) — Set Location + Edition popovers.
- `components/LocalDate.tsx` (new) — the SSR+inline-script date component from the Next.js doc pattern.
- `components/MobileNavDrawer.tsx` (new) — hamburger menu button + off-canvas drawer.
- `components/TopicBar.tsx` (new) — topic chip follow-toggle + add-custom-chip.
- `components/ComingSoonLink.tsx` (new) — shared "toast on click" wrapper for out-of-scope nav/footer/social links.

## Implementation requirements

1. No hydration errors/warnings in the browser console on a hard load of `/` with `TZ`/locale different from the dev machine's default (per the doc's guidance) — verify manually.
2. Theme preference persists across reloads; `auto` tracks live OS theme changes without a manual reload.
3. Date shown always matches the visitor's actual local today's date, not a stale build-time value.
4. Menu button drawer is keyboard-dismissible (Escape) and closes on backdrop click; focus doesn't get trapped/lost in a way that breaks tabbing.
5. All popovers (location, edition, topic-add) close on outside click and Escape.
6. Every clickable control in the header/topic-bar/footer produces a visible response — either real behavior (theme, date, location, edition, menu, topic follow/add) or an explicit "Coming soon" toast (nav/footer/social placeholders) — nothing is a silent no-op.
7. `Home`, `Subscribe`, `Login`, and Clerk's `UserButton` behavior are unchanged.
8. Story card click-through (`StoryCardLink`, PostHog `article_clicked` event) is unchanged.

## Security requirements

- No new secrets, no new server routes, no new admin-secret-protected endpoints.
- All new state is client-only `localStorage` (theme, location text, edition choice, followed topics) — nothing here touches Supabase, Clerk, or Oxylabs.
- Inline theme-init script is a static string with no user input interpolated into it (avoids any injection surface); location/edition/topic text entered by the user is only ever rendered as React text content, never via `dangerouslySetInnerHTML`.

## Acceptance criteria

- Theme buttons visibly switch the whole homepage chrome + story cards between light/dark, "Auto" follows the OS setting live, and the choice survives a page reload with no flash of the wrong theme.
- Utility-bar date shows today's real date in the visitor's locale/timezone, not a fixed string.
- Set Location and Edition are clickable, open a small popover, and reflect the chosen value in the header afterward.
- Hamburger menu opens a working nav drawer on narrow viewports.
- Topic chips visibly toggle a followed state; the "+" opens an add-topic input that appends a new chip.
- For You / Local / Blindspot and all footer/company/social links show a "Coming soon" toast instead of doing nothing.
- No console hydration warnings/errors on load.
- The repeated-gray-AP-image issue is understood to be stale bad data already fixed at the scraper level, not a UI bug — cleanup is offered as a separate, explicitly-confirmed step (see above), not silently bundled in.

## Checks to run

- `npm run typecheck`
- `npm run lint`
- `npm run build` (routes/client components are changing)

## Manual test steps

1. `npm run dev`, open `http://localhost:3000/`.
2. Click "Dark" in the utility bar — header, topic bar, story cards, and footer switch to dark styling immediately; reload the page — it stays dark (no flash of light first).
3. Click "Auto", then toggle your OS light/dark setting — the page updates without a manual reload.
4. Confirm the utility-bar date matches today's actual date.
5. Click "Set Location" → enter a value → Save — label updates; reload — value persists.
6. Click the "International Edition" row → pick a different edition — label updates.
7. Resize the browser below ~820px width, click the hamburger icon — a nav drawer slides in with Home/For You/Local/Blindspot; Escape or backdrop click closes it.
8. Click the "+" on a topic chip — it visually toggles to a "followed" state; click the leading "+" — an input appears to add a custom chip.
9. Click "For You", "Local", "Blindspot", or any footer Company/Help/social link — a "Coming soon" toast appears instead of nothing happening.
10. Open DevTools console — confirm no hydration warnings/errors on initial load.
