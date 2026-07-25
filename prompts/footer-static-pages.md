# Footer static pages + LinkedIn link

## Goal

Make the footer's Company and Help links navigate to real pages instead of showing a "Coming soon" toast. Wire the LinkedIn icon to the real profile URL. Leave X, Instagram, and YouTube as "Coming soon" (no real URLs provided).

## Skills read

None of the approved skills (`clerk`, `supabase`, `oxylabs-web-scraper`, `ai-sdk`) apply — this is plain Next.js App Router routing and static UI content, no auth/DB/scraping/AI involved.

## Existing code inspected

- [components/SiteFooter.tsx](components/SiteFooter.tsx) — renders 8 `ComingSoonLink`s (About, Careers, Press, Contact, Help Center, Guides, Privacy Policy, Terms of Service) plus 4 social `ComingSoonLink`s (X, LinkedIn, Instagram, YouTube).
- [components/ComingSoonLink.tsx](components/ComingSoonLink.tsx) — client component, `<a href="#top-news">` that `preventDefault()`s and shows a toast. This is the intentional placeholder pattern currently in use.
- `app/for-you/page.tsx`, `app/design-system/page.tsx` — confirm App Router page conventions (`app/<route>/page.tsx`, default export, `SiteHeader`/`SiteFooter`/`ToastHost` wrapper pattern) and confirm styling goes through custom classes in `app/globals.css`, not Tailwind utility classes.
- `app/globals.css` — no existing "prose"/legal/static-page classes; a minimal new class block is needed for readable static content.

## Decisions / assumptions

- Company/Help links become real internal routes with simple placeholder/boilerplate copy (per your answer), not full CMS-backed content:
  - `/about`, `/careers`, `/press`, `/contact`, `/help-center`, `/guides`, `/privacy-policy`, `/terms-of-service`
- Each page reuses `SiteHeader` + `SiteFooter` + `ToastHost` for a consistent shell (same pattern as `for-you`), with an `<h1>` and a few paragraphs of neutral placeholder copy appropriate to the page's purpose (e.g. Privacy Policy gets generic placeholder privacy-policy-shaped text, not legally binding content — clearly a starting point to be edited later).
- Contact page includes a simple `mailto:` link (no working contact form / backend — out of scope, would require a new API route + mutation which AGENTS.md scope doesn't cover).
- LinkedIn icon links to `https://www.linkedin.com/in/manoj-r-6391091b7`, opens in a new tab (`target="_blank" rel="noopener noreferrer"`), replacing its `ComingSoonLink` wrapper with a plain `<a>`.
- X, Instagram, YouTube stay exactly as-is (`ComingSoonLink`, "Coming soon" toast) since no real URLs exist yet.
- New shared CSS added to `app/globals.css` under a `.static-page` class (or similar) for basic heading/paragraph spacing — no new design-system dependency.

## Files likely to change

- `components/SiteFooter.tsx` — swap the 8 `ComingSoonLink`s for real `<a href="/...">` (via Next.js `Link`), swap LinkedIn's `ComingSoonLink` for a real external link.
- New: `app/about/page.tsx`, `app/careers/page.tsx`, `app/press/page.tsx`, `app/contact/page.tsx`, `app/help-center/page.tsx`, `app/guides/page.tsx`, `app/privacy-policy/page.tsx`, `app/terms-of-service/page.tsx`
- `app/globals.css` — add minimal `.static-page` styling.

## Implementation requirements

- Use Next.js `Link` from `next/link` for internal footer links (not raw `<a>`), per App Router convention.
- Each new page: Server Component (no `"use client"` needed), default export, wrapped in `SiteHeader` (no `active` tab highlighted, since these aren't primary nav items) + `main.site-shell` + `SiteFooter`.
- Keep each page small — heading + 3-6 short paragraphs of placeholder copy relevant to the page title. No forms, no data fetching, no Supabase/Clerk/API calls.
- LinkedIn link: plain anchor tag with `target="_blank" rel="noopener noreferrer"`, keep existing `Icon name="linkedin"` child and `aria-label="LinkedIn"`.
- Do not touch X/Instagram/YouTube `ComingSoonLink`s.
- Do not modify `ComingSoonLink.tsx` itself (still needed for the 3 remaining social placeholders).

## Security requirements

- None of these routes touch auth, secrets, or mutations — no admin secret, no Clerk gating needed (public marketing/legal pages).
- External LinkedIn link must use `rel="noopener noreferrer"` to avoid `window.opener` leakage.

## Acceptance criteria

- Clicking About/Careers/Press/Contact/Help Center/Guides/Privacy Policy/Terms of Service in the footer navigates to a real page with a heading and placeholder content, using the site's existing header/footer shell.
- Clicking the LinkedIn icon opens `https://www.linkedin.com/in/manoj-r-6391091b7` in a new tab.
- X, Instagram, YouTube icons still show the "Coming soon" toast, unchanged.
- No console errors; typecheck and lint pass.

## Checks to run

- `npm run typecheck`
- `npm run lint`

(`npm run build` not required — no routing/config/server changes beyond new static pages, but can run if you want extra confidence.)

## Manual test steps

1. `npm run dev`
2. Visit `http://localhost:3000/for-you` (or any page with the footer).
3. Click each of: About, Careers, Press, Contact, Help Center, Guides, Privacy Policy, Terms of Service — confirm each navigates to its own page with a heading and placeholder text, and the header/footer are present.
4. Click the LinkedIn icon in the footer — confirm it opens `https://www.linkedin.com/in/manoj-r-6391091b7` in a new browser tab.
5. Click X, Instagram, YouTube icons — confirm the "Coming soon" toast still appears and the page does not navigate.
