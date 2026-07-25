# News Details Page — Bottom Section Redesign (Related Stories, Source Breakdown, Newsletter)

## Goal

Redesign the bottom of the news details page (`app/news-details/page.tsx`) to match the provided screenshot:
1. "Related Stories" grid — each card shows source + sentiment label on one line, title, and a "N sources" line.
2. A richer "Source Breakdown" side panel — total source count, colored Left/Center/Right bars with count + percentage, a "Top Sources" list (name + bias label), and a "View All Sources" button.
3. A full-width "Stay Informed. Stay Balanced." newsletter signup bar below the main layout.

This is a pure UI/markup task — no schema, query, or pipeline changes. It builds on the already-implemented pgvector related-articles feature (`prompts/related-articles-ui.md`), which currently renders a plain related-articles grid with only title + "bias framing" text.

## Skills read

None of the four approved skills (`clerk`, `supabase`, `oxylabs-web-scraper`, `ai-sdk`) apply — this is presentational-only work using existing project CSS/React patterns, per AGENTS.md section 3 ("For ... Tailwind, and shadcn/ui, use existing project patterns").

## Existing code inspected

- [app/news-details/page.tsx](app/news-details/page.tsx) — `RelatedStory` (lines 15-24) currently renders image, `source.name`, title, and `{bias_label} framing`. `sources-panel` (line 52) currently renders only a static "1 source" total and a single source/bias row — no bars, no "Top Sources" heading, no "View All Sources" button. No newsletter section exists anywhere on this page.
- [app/globals.css](app/globals.css) — CSS for the target design **already exists but is unused by any JSX**:
  - `.related-section`, `.related-grid`, `.related-story`, `.related-image`, `.related-copy` (line 156) — already used by `RelatedStory`, just needs updated content (sentiment instead of bias framing, "N sources" line).
  - `.source-total`, `.source-bars`, `.source-list-heading`, `.source-list` (+ `.left/.center/.right` color variants) (line 161) — styled but not rendered anywhere.
  - `.analysis-row` / `.analysis-track` (+ `.left/.center/.right` variants) (line 159) — already used by the bias-panel `MeterRow`; same classes give the colored bar look needed for the Source Breakdown bars.
  - `.outline-action` (line 159) — full-width outline button style, unused — matches "View All Sources".
  - `.newsletter`, `.newsletter-form` (line 163) — fully styled full-width signup bar, completely unused.
  - Responsive rules for all of the above already exist at the tablet/mobile breakpoints (lines 166-180).
- [lib/news.ts](lib/news.ts) — `NewsArticle.analysis` has `sentiment_label` (`positive`/`neutral`/`negative`), `bias_label` (`left`/`center`/`right`/`mixed`/`unclear`), `left_percentage`/`center_percentage`/`right_percentage`.
- [app/page.tsx](app/page.tsx) — no existing capitalization helper for `sentiment_label`/`bias_label`; they're used lowercase today. The screenshot shows them capitalized ("Positive", "Center"), so this task introduces `text-transform: capitalize` on the new elements only, not project-wide.
- [app/news/[id]/page.tsx](app/news/[id]/page.tsx) — already fetches `relatedArticles` via `getRelatedArticles`; no changes needed here.

## Decisions / assumptions

- **"N sources" on related cards**: each article has exactly one `source`, and there is no multi-source story clustering anywhere in the schema (per AGENTS.md section 1/7 scope). So this literally renders `1 sources` for every card, matching the screenshot's own text exactly ("1 sources" appears on every card there too, including single-source items) — not a bug, just a literal per-article count. No new data needed.
- **Source Breakdown bars & counts**: since a details page only ever has one source (the current article's), "Total Sources" = 1, and the Left/Center/Right bucket counts are derived by comparing `analysis.bias_label` to each bucket (1 in the matching bucket, 0 in the other two) — mirroring the screenshot (Center 1, Left/Right 0). The bar **length/percentage** reuses the article's own `left_percentage`/`center_percentage`/`right_percentage` (same numbers already shown in the "Framing distribution" bar higher up the page), since there's no other source to aggregate against. `mixed`/`unclear` bias labels won't match any of the three buckets, so all three counts show 0 in that case — acceptable given it's still an edge case for a single-source page.
- **"Top Sources" list**: single row — current article's source name + its `bias_label`, reusing the same color classes (`.source-list b.left/.center/.right`) already defined in CSS.
- **"View All Sources" button**: no "all sources" page exists in AGENTS.md's build list (section 1), so this links to `/` (the homepage news grid) as the closest existing "all sources" destination, styled with the existing `.outline-action` class. Flagging this as the one assumption most likely to need adjustting — happy to change the target if you have something else in mind.
- **Newsletter form**: no email/subscription backend exists or is in scope (not listed in AGENTS.md section 1's build list). The form is presentational only — `onSubmit` calls `preventDefault()` and does nothing else, matching "minimal responsive UI" and avoiding overbuilding an unrequested feature.
- **"Provide Feedback" button** (visible cut off at the top of the screenshot): this belongs to the existing `summary-panel` ("Signals") card, which already has an unused `.feedback-button` CSS class. Adding it as a static, non-functional button at the end of that panel (no feedback backend exists or is in scope) so the sidebar stack visually matches the screenshot. If you'd rather leave this out until there's a real feedback flow, say so and I'll drop it from the prompt.
- Sentiment/bias label text is capitalized for display only (`"positive"` → `"Positive"`) via CSS `text-transform: capitalize` on the specific new elements, not by changing the underlying stored/typed values or other pages.

## Visual interpretation (from screenshot)

- **Related Stories**: 2-column grid (existing `.related-grid`), each card = small square-ish thumbnail image on the left, on the right: small gray line "`{Source} · {Sentiment}`", bold 2-line-clamped title below it, then a smaller muted "`1 sources`" line at the bottom of the copy block. This is the existing `.related-story`/`.related-image`/`.related-copy` structure — only the text content changes.
- **Source Breakdown card** (existing `.side-panel.sources-panel`): heading row "Source Breakdown" + small info (ⓘ) icon on the right (reuse `.side-heading` pattern already used by other panels, which has `svg` slot styling). Below: small muted "`{n} Total Sources`" line. Then three bar rows (Left / Center / Right), each with the label on the left, "`{count} ({percentage}%)`" right-aligned, and a colored horizontal bar beneath/inline — Left is red/dark-red, Center is gray, Right is blue, matching `.analysis-row.left/.center/.right` + `.analysis-track` colors already defined. Then a "Top Sources" / "Bias" two-column list heading (`.source-list-heading`), then the one-row source list. Then a full-width outline "View All Sources" button (`.outline-action`) at the bottom of the card.
- **Newsletter bar**: full-width card below the two-column `detail-layout`, inside `site-shell` so it spans the full content width. Left side: bold "Stay Informed. Stay Balanced." heading + smaller gray subtext "Get the top stories and bias analysis delivered to your inbox." Right side: email input + black "Subscribe" button, laid out horizontally on desktop, stacking on mobile (already defined in the responsive CSS rules).
- Colors, spacing, fonts: all governed by existing CSS custom properties and classes (`--color-left-bias`, `--color-center-bias`, `--color-right-bias`, `--radius-sm/lg`, `--shadow-sm`) — no new design tokens needed, this task is 100% wiring existing styles to new/updated markup.

## Files likely to change

- `app/news-details/page.tsx` — update `RelatedStory`, rewrite the `sources-panel` section, add a `NewsletterSignup`-style section, add the feedback button to `summary-panel`.
- No CSS changes expected (styles already exist); will double-check exact class names/structure against `globals.css` during implementation and add minor rules only if something is genuinely missing.

## Implementation requirements

1. `RelatedStory`: line 1 = `{source.name} · {capitalized sentiment_label}`; title unchanged; new bottom line = `1 sources`.
2. `sources-panel`: 
   - Heading "Source Breakdown" with info icon.
   - `{1} Total Sources` (singular count, literal "Total Sources" label per screenshot).
   - Three bar rows for left/center/right using `analysis.{left,center,right}_percentage` for bar width/percentage and a derived 0/1 count per bucket from `bias_label`.
   - "Top Sources" / "Bias" list heading, one row: source name + capitalized bias label.
   - "View All Sources" outline button linking to `/`.
3. Add a newsletter section (`.newsletter`/`.newsletter-form`) as a full-width block inside `site-shell`, below `main.detail-layout`, with a no-op `onSubmit`.
4. Add a "Provide Feedback" button (`.feedback-button`) to the end of `summary-panel`, non-functional.
5. Keep all changes presentational — no new data fetching, no new Supabase queries, no new routes.

## Security requirements

- None — no new server calls, no new secrets, no new routes. Purely client-rendered static markup from data already fetched server-side.

## Acceptance criteria

- News details page bottom section visually matches the screenshot: Related Stories grid with sentiment + "N sources" line, Source Breakdown card with bars/top-sources/button, newsletter bar.
- No regressions to the rest of the page (hero, framing distribution, bias panel, signals panel).
- `npm run typecheck` and `npm run lint` pass.

## Checks to run

- `npm run typecheck`
- `npm run lint`

## Manual test steps

1. `npm run dev`.
2. Open an analyzed article's details page at `/news/{id}` for an article that has related articles (embeddings backfilled) — confirm:
   - Related Stories cards show `Source · Sentiment`, title, and `1 sources`.
   - Source Breakdown card shows total sources, three colored bars with counts/percentages, Top Sources row, and a working "View All Sources" link back to `/`.
   - Newsletter bar renders at the bottom, full width, input + Subscribe button do not error on submit (no-op).
3. Resize the browser to tablet and mobile widths to confirm the existing responsive CSS rules still apply cleanly to the updated markup.
