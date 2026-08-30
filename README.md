# Edupath Landing

Marketing landing site for **Edupath SMS** — an all-in-one school management
platform for Kenyan schools. CBE-ready, with M-Pesa fee collection and
WhatsApp notifications built in.

## Tech stack

- **Astro 6** — static site generator, `output: 'static'`
- **Content collections** — the blog lives in `src/content/posts` as JSON
  documents (title, description, tag, date, read time, raw HTML body)
- **`@astrojs/sitemap`** — generates `sitemap-index.xml` at build time
- **Design tokens** — custom CSS design system in `src/styles/tokens.css`,
  documented in [design.md](design.md)

## Project structure

```
src/
  layouts/Layout.astro        Theme bleed global `<head>`, fonts, GA4
  layouts/FeaturePage.astro   Shared layout for feature pages
  components/                 Nav, Footer, PostCard, GA4
  pages/
    index.astro               Home — hero, features, portals, pricing, FAQ
    cbe-school-management.astro
    school-attendance.astro
    parent-portal.astro
    mpesa-school-fees.astro
    blog/index.astro          Blog index (Catalogue style)
    blog/[slug].astro         Blog article (Long Document style)
  content.config.ts           Content collection schema
  content/posts/*.json        Blog posts (raw HTML bodies)
  styles/                     tokens.css (source of truth), base, chrome,
                              home, feature
```

## Getting started

```bash
npm install
npm run dev          # start the dev server at http://localhost:4321
```

## Commands

| Command                | Action                                         |
| ---------------------- | ---------------------------------------------- |
| `npm run dev`          | Start local dev server                         |
| `npm run build`        | Build the static site into `dist/`             |
| `npm run preview`      | Preview the production build locally           |
| `npm run astro`        | Run the Astro CLI                              |

## Adding a blog post

Add a new JSON file under `src/content/posts/` (`{slug}.json`). The schema in
`src/content.config.ts` requires:

- `title`, `description`, `tag`
- `date` (ISO) and `dateDisplay` (human-readable)
- `readTime`, e.g. `"8 min read"`
- `body` — the article content as a raw HTML string

The post automatically appears in the blog index at `/blog` and the sitemap.

## Deployment

Deployment runs on Vercel (see `vercel.json`). The build command is
`npm run build` and output is `dist/`, with clean URLs enabled.

- Site URL: <https://www.edupath.co.ke>
- Configured in `astro.config.mjs` (`site` must stay in sync with any domain
  changes so the sitemap stays correct)

## Design system

The visual system is locked and documented in [design.md](design.md) —
modern-minimal, roman serif display (Fraunces) with a sans body (Plus Jakarta
Sans), cool/light theme with a teal accent (`--color-accent`). Color and
font tokens must be sourced from `src/styles/tokens.css`; inline values are
forbidden outside the token block. Consult `design.md` before changing page
styles.
