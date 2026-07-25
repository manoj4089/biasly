# For You, Local, and Blindspot pages

## Goal

Turn the three primary-nav links that currently show a "Coming soon" toast — For You, Local, Blindspot — into real, reachable routes, using only data already stored in Supabase (`articles`, `article_analyses`, `sources`) and the client-side followed-topics state that already exists. Home ("/") stays exactly as-is.

## Skills read

None of the four approved skills (clerk, supabase, oxylabs-web-scraper, ai-sdk) apply — this is Next.js routing/UI work reading already-stored data through the existing `lib/news.ts` helpers. No schema change, no scraping/analysis change.

## Existing code inspected

- [app/page.tsx](../app/page.tsx) — the entire header (utility bar, main nav, topic bar) and footer are inlined in this one file, along with local helper components `Icon`, `BiasMeter`, `Brand`, and `StoryCard`. `For You`/`Local`/`Blindspot` currently render as `ComingSoonLink` (a client component that `preventDefault()`s and fires a toast).
- [components/ComingSoonLink.tsx](../components/ComingSoonLink.tsx), [components/ToastHost.tsx](../components/ToastHost.tsx), [components/toast.ts](../components/toast.ts) — the toast plumbing being replaced for these three links only.
- [components/MobileNavDrawer.tsx](../components/MobileNavDrawer.tsx) — drawer's nav list also uses `ComingSoonLink` for the same three destinations.
- [components/TopicBar.tsx](../components/TopicBar.tsx) — already persists a followed-topics `Set<string>` to `localStorage["biasly-topics"]` (chip "+" toggle). This is the only existing signal usable for a "For You" feed — there is no server-side user-preference table.
- [lib/news.ts](../lib/news.ts) — `getArticles()` returns all analyzed articles (joined `analysis` + `source`), already sorted by `published_at` desc. `getArticleById()` is unrelated (details page only). No location/region field exists anywhere on `sources` or `articles`.
- [lib/supabase/database.types.ts](../lib/supabase/database.types.ts) — confirmed `article_analyses` columns: `bias_label` (`left | center | right | mixed | unclear`), `left_percentage`, `center_percentage`, `right_percentage`, `confidence`, `sentiment_label`, etc. — everything needed for a "Blindspot" (one-sided coverage) view already exists per-article.
- [app/globals.css](../app/globals.css) — `.top-news`, `.story-grid`, `.empty-state`, `.site-shell` classes are already generic/reusable for a second listing page; no new visual system needed.
- **Data gap**: no source or article is tagged with a region/locale anywhere in the schema or scraper. A real "Local" feed would require new source metadata and scraper changes, which is out of `AGENTS.md`'s "Build only" list. Per your answer, `/local` ships as a real, reachable page with an honest empty state, not fabricated results.

## Decisions / assumptions

- **Shared chrome extraction**: the header (utility bar + main nav + topic bar) and footer in `app/page.tsx` get pulled into `components/SiteHeader.tsx` and `components/SiteFooter.tsx` so all four routes (`/`, `/for-you`, `/local`, `/blindspot`) render identical chrome instead of copy-pasting ~90 lines three times. `SiteHeader` takes an `active: "home" | "for-you" | "local" | "blindspot"` prop to underline the current tab (replacing the hardcoded `className="active"` on Home). `Icon`, `BiasMeter`, `Brand`, and `StoryCard` move to `components/StoryCard.tsx` (kept together since `StoryCard` depends on the other three) so `/for-you` and `/blindspot` can render the same article cards as `/`.
- **Nav links become real `<Link>`s**: `For You`, `Local`, `Blindspot` switch from `ComingSoonLink` to plain `next/link` `Link` pointing at `/for-you`, `/local`, `/blindspot` in both `SiteHeader`'s primary nav and `MobileNavDrawer`. `ComingSoonLink` stays exactly as-is and keeps being used for the genuinely out-of-scope footer/social links (Company, Help, social icons) — that part of the earlier prompt is unaffected.
- **For You** (`/for-you`): async Server Component, calls `getArticles()` (same helper as home, no new query). Renders a small client component `ForYouFeed` that reads `localStorage["biasly-topics"]` on mount and filters the passed article list to ones whose `title` contains a followed topic name (case-insensitive substring match — the only signal available, since articles have no topic/category column). If no topics are followed yet, show an empty state: "Follow a topic on the homepage to build your feed" with a link back to `/`. This is genuinely best-effort client-side filtering, not a real recommendation system — acceptable given AGENTS.md's scope and the fact topics are freeform localStorage strings, not a DB column.
- **Local** (`/local`): async Server Component (for chrome consistency) that renders `SiteHeader`/`SiteFooter` plus a static empty-state panel: "Local coverage isn't available yet — biasly doesn't currently tag sources by region." No article fetch, no fake filtering. This matches your "Placeholder page" choice.
- **Blindspot** (`/blindspot`): async Server Component, calls `getArticles()`, filters to articles where `bias_label` is `"left"` or `"right"` (excludes `center`/`mixed`/`unclear`) with `confidence >= 0.6`, sorted by `Math.max(left_percentage, right_percentage)` descending — i.e. the most one-sidedly-framed stories first. Reuses `StoryCard` as-is (it already shows the bias meter and framing label, so no new card variant needed). Empty state if nothing currently qualifies: "No strongly one-sided stories detected right now."
- **Threshold values** (`confidence >= 0.6`, excluded labels) are a plain constant in the new route file, not user-configurable — keeps this a one-file decision, easy to adjust later without touching the pipeline.
- No new Supabase tables/columns, no new API routes, no new admin-secret-protected endpoints — everything here reads through the existing unauthenticated `getArticles()` server helper, same as `/` does today.

## Files likely to change

- `components/SiteHeader.tsx` (new) — utility bar + main nav (with `active` prop) + topic bar, extracted from `app/page.tsx`.
- `components/SiteFooter.tsx` (new) — footer, extracted from `app/page.tsx`.
- `components/StoryCard.tsx` (new) — `Icon`, `BiasMeter`, `Brand`, `StoryCard`, moved out of `app/page.tsx` and exported for reuse.
- `app/page.tsx` — rewritten to use `SiteHeader active="home"`, `SiteFooter`, and the imported `StoryCard`; story-fetching logic (`getArticles()`) unchanged.
- `components/MobileNavDrawer.tsx` — For You/Local/Blindspot become real `Link`s; `active` prop to highlight current route.
- `app/for-you/page.tsx` (new) + `components/ForYouFeed.tsx` (new, client) — filtered feed by followed topics.
- `app/local/page.tsx` (new) — static empty-state page.
- `app/blindspot/page.tsx` (new) — one-sided-coverage listing.

## Implementation requirements

1. No behavior change to `/` or `/news/[id]` beyond the header/footer/card extraction (visually identical output).
2. `For You`, `Local`, `Blindspot` are real navigable routes from both desktop nav and the mobile drawer; the active tab is visually underlined/highlighted per route.
3. `/for-you` filtering runs client-side only (reads `localStorage`), matching the existing `TopicBar` persistence key (`biasly-topics`) — no duplicate storage key.
4. `/blindspot` filtering/sorting happens server-side in the route component (plain array filter/sort over `getArticles()`'s result), not a new Supabase query.
5. All three new pages keep `UI must display stored data only` — no writes, no pipeline triggers, no new API routes.
6. Footer/social `ComingSoonLink`s and `Subscribe`/`Login`/`UserButton` behavior stay unchanged.

## Security requirements

- No new secrets, no new server routes, no new admin-secret-protected or Clerk-protected endpoints — these are public read-only pages like `/` already is.
- `/for-you`'s topic filter only ever reads `localStorage` and renders plain text/React children — no `dangerouslySetInnerHTML`.

## Acceptance criteria

- Clicking "For You" navigates to `/for-you` and shows articles matching your followed topics, or the empty state if none are followed yet.
- Clicking "Local" navigates to `/local` and shows the honest "not available yet" panel — no fabricated local results.
- Clicking "Blindspot" navigates to `/blindspot` and shows articles with strong left/right framing and confidence ≥ 0.6, most extreme first, or the empty state if none qualify.
- The active tab is visually distinguishable on all four routes, on both desktop nav and the mobile drawer.
- `/`'s visual output and behavior are unchanged after the header/footer/card extraction.
- No console hydration warnings/errors on any of the four routes.

## Checks to run

- `npx tsc --noEmit`
- `npm run lint`
- `npm run build` (new routes)

## Manual test steps

1. `npm run dev`, open `http://localhost:3000/`.
2. On the homepage, follow 1–2 topic chips (click their "+"). Click "For You" — confirm it navigates to `/for-you` and shows only articles whose titles reference a followed topic; unfollow all topics and reload `/for-you` — confirm the empty state appears.
3. Click "Local" — confirm it navigates to `/local` and shows the "not available yet" message, no article list.
4. Click "Blindspot" — confirm it navigates to `/blindspot` and shows articles with a clearly skewed bias meter; check one story's framing label/percentages match what's shown on `/`.
5. Resize below ~820px, open the hamburger drawer — confirm For You/Local/Blindspot are real links there too and close the drawer on navigation.
6. Reload `/`, `/for-you`, `/local`, `/blindspot` individually — confirm header/topic bar/footer look identical to before on all of them, and DevTools console shows no hydration warnings.
