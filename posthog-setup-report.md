<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into **biasly / Skew News**. Client-side tracking is initialised in `instrumentation-client.ts` using the Next.js 15.3+ instrumentation pattern (no provider needed). A reverse proxy routes PostHog traffic through `/ingest` to avoid ad blockers. User identification is wired to Clerk — signed-in users are identified on every page load, and PostHog resets when a session ends. Six events are captured across four client components and two API route handlers, giving full visibility from article discovery through pipeline health.

| Event | Description | File |
|---|---|---|
| `article_clicked` | User clicks a story card on the home page to read an article. | `components/StoryCardLink.tsx` |
| `article_viewed` | User views a full article on the news detail page. | `components/ArticleViewTracker.tsx` |
| `newsletter_subscribe_submitted` | User submits the newsletter subscription form on the article detail page. | `app/news-details/newsletter-form.tsx` |
| `related_article_clicked` | User clicks a related article in the related articles section on the detail page. | `components/RelatedStoryLink.tsx` |
| `scrape_completed` | The article scraping pipeline completed, reporting sources checked and articles inserted. | `app/api/scrape/route.ts` |
| `analysis_completed` | The AI analysis pipeline completed, reporting articles analyzed, skipped, and failed. | `app/api/analyze/route.ts` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard** — [Analytics basics (wizard)](https://eu.posthog.com/project/232162/dashboard/848246)
- **Article engagement funnel** — [IDyHzg5I](https://eu.posthog.com/project/232162/insights/IDyHzg5I)
- **Article clicks over time** — [3dST4LPf](https://eu.posthog.com/project/232162/insights/3dST4LPf)
- **Newsletter subscriptions** — [Ukl6aRvE](https://eu.posthog.com/project/232162/insights/Ukl6aRvE)
- **Article clicks by bias label** — [yjgRakxA](https://eu.posthog.com/project/232162/insights/yjgRakxA)
- **Pipeline activity** — [24ZYWfyl](https://eu.posthog.com/project/232162/insights/24ZYWfyl)

## Verify before merging

- [ ] Run a full production build (`npm run build`) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` to `.env.example` and any CI/deployment secrets so collaborators and Vercel know what to set. (Already added to `.env.example` in this run — confirm they are also set in your Vercel project environment variables.)
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify.
- [ ] Confirm the returning-visitor path also calls `identify` — the `PostHogIdentifier` component identifies on every page load when Clerk reports a signed-in user, so this should be covered, but verify with a real login session.
- [ ] This project uses Supabase, Clerk, and Groq/OpenAI as data sources. Running `npx @posthog/wizard warehouse` will connect them to PostHog's data warehouse for deeper cross-source analysis.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
