# Clerk Authentication Implementation Prompt

## Goal
Add Clerk authentication to the existing Next.js App Router application using the current `@clerk/nextjs` SDK. Keep the public news experience available while providing working sign-in, sign-up, account, and sign-out controls.

## Skills Read
- `.agents/skills/clerk/SKILL.md`
- `.agents/skills/clerk-setup/SKILL.md`
- Repository `AGENTS.md`

## Existing Code Inspected
- `package.json`: Next.js 16.2.10, React 19.2.4, no existing authentication package.
- `app/layout.tsx`: root layout currently renders children directly.
- `app/page.tsx`: homepage contains Login and Subscribe actions in the navigation.
- `app/news/[id]/page.tsx`: news detail route is currently public.
- `.env.local`: Clerk publishable and secret variables are already present.
- `app/globals.css`: existing light visual system and navigation styles.

## Decisions and Assumptions
- Use the current SDK package `@clerk/nextjs`, not the legacy Core 2 package patterns.
- Because this project uses Next.js 16, create `proxy.ts` at the project root and use Clerk's current `clerkMiddleware` integration.
- Keep the home feed public, but protect `/news(.*)` with Clerk so news detail pages require sign-in. Keep `/news-details(.*)` and Clerk's auth routes public.
- Use Clerk's prebuilt UI components for the first implementation: `SignInButton`, `SignUpButton`, `UserButton`, and `Show`.
- Do not expose, log, or hard-code the secret key. Existing credentials should remain environment-only.
- Add dedicated `/sign-in` and `/sign-up` routes using Clerk's `SignIn` and `SignUp` components so the navigation actions have a stable destination.

## Files Likely To Change
- `package.json` and `package-lock.json`: add `@clerk/nextjs`.
- `app/layout.tsx`: place `ClerkProvider` inside `<body>`.
- `app/page.tsx`: replace placeholder Login/Subscribe actions with Clerk-aware controls while preserving the existing layout.
- `app/globals.css`: add only the minimal styles needed for the auth controls and responsive states.
- `proxy.ts`: add Clerk middleware using the current Next.js 16 convention.
- `app/sign-in/[[...sign-in]]/page.tsx`: add the sign-in route.
- `app/sign-up/[[...sign-up]]/page.tsx`: add the sign-up route.

## Implementation Requirements
1. Install `@clerk/nextjs` with the package manager already used by the repository.
2. Add `ClerkProvider` inside the root layout's `<body>`, with dynamic rendering enabled if required by the installed SDK's types or build output.
3. Add `proxy.ts` using `clerkMiddleware` and a matcher that excludes static assets and Next internals while allowing Clerk to process application requests.
4. Configure sign-in and sign-up components to use `/sign-in` and `/sign-up` fallback URLs.
5. Update the homepage navigation:
   - Signed-out users see Login and Subscribe actions that open or navigate to Clerk sign-in/sign-up.
   - Signed-in users see `UserButton` and an authenticated state without duplicating controls.
   - Preserve accessible labels, keyboard focus behavior, and the existing visual language.
6. Keep the home feed public and protect `/news/[id]` through `createRouteMatcher` and `auth.protect()`.
7. Use only environment variables for Clerk keys and preserve the existing variable names.

## Security Requirements
- Never move `CLERK_SECRET_KEY` into client code or a `NEXT_PUBLIC_` variable.
- Do not print credentials in command output, source files, or documentation.
- Do not weaken middleware security by bypassing Clerk for application routes.
- Keep auth pages and user controls compatible with Clerk's server/client boundaries.

## Acceptance Criteria
- `npm run lint` succeeds.
- `npm run build` succeeds with the installed Next.js and Clerk versions.
- The homepage renders for signed-out visitors.
- Clicking Login reaches a functional Clerk sign-in flow.
- Clicking Subscribe reaches a functional Clerk sign-up flow.
- After authentication, the navigation shows a Clerk account control and supports sign-out.
- `/news/1` redirects signed-out visitors into the Clerk sign-in flow and is reachable after authentication.
- No secret key is present in client bundles or source-controlled application code.

## Checks To Run
- `npm run lint`
- `npm run build`
- Inspect `git diff --check` for whitespace errors.
- If a browser is available, manually verify signed-out homepage, sign-in route, sign-up route, and authenticated `UserButton` state.

## Manual Test Steps
1. Start the app with `npm run dev`.
2. Open `http://localhost:3000/` and confirm the public homepage loads.
3. Select Login and confirm Clerk's sign-in page loads at `/sign-in`.
4. Return to the homepage, select Subscribe, and confirm Clerk's sign-up page loads at `/sign-up`.
5. Complete authentication using the configured Clerk development instance.
6. Confirm the homepage shows the authenticated account control and that sign-out returns to the signed-out controls.
7. Open `http://localhost:3000/news/1` while signed out and confirm Clerk redirects to sign-in, then verify the page is reachable after authentication.
