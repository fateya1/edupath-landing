# Design — Edupath SMS

Locked design system. Future Hallmark runs read this file first; pages defer
to it. Amend intentionally — the file is the rule.

## System

- Genre · modern-minimal
- Macrostructure · Compact About (home) · Split Studio (features) · Catalogue (blog index) · Long Document (blog article)
- Theme · custom · vibe: "polished enterprise, teal, minimal"
- Axes · light / roman-serif / cool

## Tokens (canonical · `src/styles/tokens.css` is the source of truth)

```css
:root {
  --color-paper:      oklch(100% 0 0);             /* background  #FFFFFF */
  --color-paper-2:    oklch(98.4% 0.003 247.858);  /* surface     #F8FAFC */
  --color-ink:        oklch(20.8% 0.042 265.755);  /* heading     #0F172A */
  --color-ink-2:      oklch(27.9% 0.041 260.031);  /* text        #1E293B */
  --color-rule:       oklch(92.9% 0.013 255.508);  /* hairline */
  --color-rule-2:     oklch(86.9% 0.022 252.894);  /* border      #CBD5E1 */
  --color-muted:      oklch(55.4% 0.046 257.417);  /* muted       #64748B */
  --color-neutral:    oklch(70.4% 0.04 256.788);
  --color-accent:     oklch(60% 0.118 184.704);    /* primary     #0D9488 */
  --color-accent-ink: oklch(98.4% 0.014 180.72);   /* on-teal */
  --color-focus:      oklch(70.4% 0.14 182.503);   /* teal-500 */
  --color-positive:   oklch(62.7% 0.194 149.214);  /* success     #16A34A */
  --color-caution:    oklch(76.9% 0.188 70.08);    /* warning     #F59E0B */
  --color-negative:   oklch(63.7% 0.237 25.331);   /* error       #EF4444 */
  --color-paper-3:    oklch(95.2% 0.01 248);       /* raised card */

  /* 4-pt spacing scale, named: --space-3xs … --space-4xl. See tokens.css.   */
  /* Type scale, 1.25 (major-third) ratio: --text-xs … --text-4xl.           */

  --font-display: "Fraunces", ui-serif, Georgia, serif;
  --font-body: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;

  --ease-out:    cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in:     cubic-bezier(0.7, 0, 0.84, 0);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --dur-fast: 180ms;  --dur-base: 240ms;  --dur-slow: 320ms;

  --radius-card: 8px;  --radius-pill: 999px;  --radius-input: 8px;
}
```

## Colour discipline

- Primary brand accent: teal (--color-accent). White + dark slate form the
  neutral backbone. Functional data hues (positive / caution /
  negative) are reserved for the comparison table and pricing badges only —
  never decorative, footprint ≤ 5% of any viewport.
- Every colour and every font-family goes through a named token. Inline
  oklch/hex/rgb values are forbidden outside the token block.
- Depth = weight and scale, not shadow. Cards are separated by hairlines
  (rule tokens) on the light paper; shadow is whisper-grade only.

## Typography

- Fraunces (display serif, roman — no italic headers) + Plus Jakarta Sans
  (body). No third family; no mono unless a code block appears (then
  ui-monospace via a token).
- Display: Fraunces 600/700, tracking -0.02em to -0.035em, line-height
  1.0–1.1, clamp(2.5rem, 5vw + 0.5rem, 4.75rem) on the home hero.
- Body: Plus Jakarta Sans 400 at 1rem base, line-height 1.6–1.75, prose
  measure 60–65ch (45–75ch hard floor).
- Numeric data always `font-variant-numeric: tabular-nums`.
- No eyebrow on every section. At most one eyebrow per page (the hero),
  stacked above the heading, never tag-left of a heading.

## CTA voice

- Primary · paper (accent ink) fill at accent · pill radius · modern-minimal
  pair: filled primary + hairline-outline secondary.
- Labels are verbs: "Create Free Account", "Start Free", "View Live Demo →",
  "Register Your School". Never "Submit" or "Get Started" alone.
- Minimal Hero (home) drives a single primary action — register — with a
  quiet outlined chip for the live demo. Split Studio uses an outlined chip
  below the text half. Catalogue uses card-internal links only
  ("Read article →"), no global CTA. Long Document uses a typographic link
  inside prose, with the in-article CTA block kept quiet.

## Motion stance

- Silent-composed. The home Minimal Hero exposes no reveal; the section
  grid is composed. Split Studio uses the diptych cross-fade. Max three
  primitives per page, transform/opacity only.
- Catalogue and Long Document are still: no reveal, no scroll effects.
- Reduced-motion fallback · ≤150 ms opacity crossfade.

## Sections

- Home (Compact About): Hero (two-column title + lede, one action) · Trust
  line · Features (full product index, 15 rows) · Portals (5 rows) ·
  Pricing (4 tiers incl Pro) · Testimonials (3 quotes) · Campus ·
  FAQ (accordion, 8) · Register · Contact · Footer
  All catalogue/footer sections render as quiet one-line index rows with
  detail behind links, about.google-style: plenty of offering, calm surface.
- Feature pages (Split Studio): split hero · stat strip · alternating
  diptychs · FAQ diptych · CTA band · Footer
- Blog index (Catalogue): no display headline; counted/dated inventory
  header + equal card grid + footer
- Blog article (Long Document): back-link · tag · title · meta · prose
  (raw HTML from content collection) · footer

## Stamps

- tokens.css and every page stylesheet carries the macrostructure stamp and
  the pre-emit critique stamp as its first lines.
- Nav: N1b canonical SaaS (one component, all pages — design.md-managed
  project, pages share the system). Footer: Ft1 statement, one component.

## Exports

`src/styles/tokens.css` (in this project) is the source of truth.