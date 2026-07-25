# Design System Implementation Prompt

Implement a responsive, single-page **Biasly News Design System** board in this Next.js application. Use the supplied UI reference as the visual source of truth.

## Before you code

- Read `AGENTS.md` and the relevant documentation in `node_modules/next/dist/docs/` before changing Next.js files.
- Preserve the App Router structure and use `app/page.tsx`, `app/globals.css`, and `app/layout.tsx` unless a new file is genuinely needed.
- Do not add dependencies unless necessary.

## Visual direction

Create a light, editorial design-system layout with a warm off-white page background, thin gray panel borders, restrained shadows, dark charcoal text, and a dark footer. Use a three-column desktop grid that collapses gracefully on tablets and phones.

The board should contain the following sections:

1. **Brand**
   - Large `biasly` wordmark with a smaller `News` label.
   - Tagline: “Balanced news coverage, powered by AI.”

2. **Colors**
   - Primary: text primary `#0D0D0F`, text secondary `#687280`, surface `#F6F6F6`.
   - Semantic: left bias `#B42318`, center `#E5E7EB`, right bias `#1D4ED8`.
   - Neutrals: white primary background and soft gray background, border, and divider tokens.

3. **Typography**
   - Use a geometric sans-serif appearance similar to Poppins, with a practical local/system fallback.
   - Show font-family sample plus rows for H1/H2/H3/H4 and body/caption styles.
   - Include style, intended use, size, weight, and line-height columns.

4. **UI elements**
   - Button states for primary, secondary, and text buttons: default, hover, outline, and disabled.
   - Category chips.
   - A three-part bias meter: red left, gray center, blue right.

5. **Icons**
   - Present a consistent line-icon set in a five-column grid.
   - Use inline SVG icons; do not add an icon package solely for this page.
   - Show a note for 2px strokes and rounded caps.

6. **Card example**
   - Build a compact news card with an editorial image treatment, article metadata, headline, supporting copy, bias meter, time, and reading-duration details.

7. **Foundations**
   - Spacing scale based on 4px: 4, 8, 16, 24, 32, 40, 64.
   - 12-column grid reference with 24px gutters and margins.
   - Small, medium, and large shadow examples.
   - Border radius examples: 4px, 8px, 12px, and full/pill.

8. **Footer**
   - Dark, rounded footer including the wordmark, tagline, version, date, and “Stay consistent. Stay unbiased.”

## Quality requirements

- Implement all styling in `app/globals.css` and keep the page markup semantic and readable.
- Match the reference’s compact editorial spacing, subdued dividers, rounded corners, and hierarchy.
- Add responsive behavior for narrow viewports; sections should stack without horizontal overflow.
- Update page metadata to identify the page as the Biasly Design System.
- Verify with `npm.cmd run lint` and `npm.cmd run build` on Windows PowerShell environments where `npm` may be blocked by execution policy.
