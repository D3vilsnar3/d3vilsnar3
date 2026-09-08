# d3vilsnar3.com — personal portfolio

Terminal-styled static portfolio site. No framework, no build step on the host:
`node build.js` assembles the pages, the generated output is committed, and
Cloudflare serves it as plain files.

## Deploying

**Pushing `master` to GitHub deploys the site.** Cloudflare builds from the
repo — there is no manual step.

`wrangler.toml` describes a static-asset Worker serving `public/`, which makes
it look like deployment is a local `wrangler deploy`. It is not, and Wrangler
is not authenticated here. The build takes a moment, so a `curl` against the
live site immediately after pushing can still show the previous version.

## Build

```
node build.js      # regenerates public/ from src/pages/ + the shell in build.js
node server.js     # local preview on http://localhost:3939
```

`build.js` holds the page shell (head, top bar, nav, canvases, footer) and a
`PAGES` array driving the nav, the home section order and the sitemap.

- **Every page is generated.** Edit `src/pages/*.html` and rebuild — never edit
  `public/*/index.html` by hand, it will be overwritten.
- `public/resume/` is the exception: `resume/resume.html` is copied there by
  hand, and `build.js` does not touch it. Edit both, or copy after editing.
- `build.js` stamps today's date into `sitemap.xml`, so every build shows a
  diff there even when nothing else changed.

### Home vs standalone pages

A `PAGES` entry may carry `homeFile`, letting a section render differently on
home than on its own page. Two use it: home shows a compact process table
(`systems-table.html`) and a capability index (`capabilities-compact.html`),
while `/systems/` and `/capabilities/` keep the full prose write-ups. Items in
both summaries deep-link to per-entry anchors on the detail pages.

`HOME_ONLY` lists sections that appear on home but are not pages at all — no
nav entry, no standalone URL, no sitemap row. `stats.html` is the only one.

## Layout and scroll

- Home carries `data-snap` on `<html>`; sections fill the viewport and settle
  on section starts. **Desktop only (>= 900px)** — on a phone nothing fits a
  screen anyway, and pinning sections to `100vh` made the collapsing address
  bar resize them mid-scroll.
- Sections carry `scroll-margin-top: 64px` for anchor jumps via ID selectors.
  Overriding that needs to out-specify an ID; the `:is(...)` rule in
  `styles.css` does this without `!important`.
- A `#hash` landing is re-aimed for ~2.8s after load: the browser jumps early,
  then the webfont and the hero typewriter grow the page, and scroll anchoring
  preserves the stale position.

## Canvases and JS

`public/js/` — `particles.js` and `asteroids.js` (2D canvas), `fluid.js`
(WebGL cursor), `reveal.js` (scroll reveal). All are decorative, behind the
content, `pointer-events: none`, and bail out on `prefers-reduced-motion`.

- `asteroids.js` exposes `window.GPAsteroids`. The ship is confined to a
  *zone*; `setZone(rect)` parks it in empty page space, `null` returns it to
  the band across the top. `script.js` measures each section's real text
  extent (block boxes are full-width and would report no space) and hands over
  whatever column is free, desktop only.
- `reveal.js` uses keyframes, not transitions — several targets carry their
  own higher-specificity `transition` that would win — and strips its own
  classes once each element lands, so nothing keeps overriding hover states or
  the `:target` highlight.
- The intro runs once per session, gated on `sessionStorage` `gp-intro`.
  Clicking the name clears it and reloads.

## Content conventions

Clients are **not named**. The copy says "a large consumer marketplace", "a
sports-technology product", "a pharmaceutical company". Two client names were
removed from the site and the resume; keep new copy consistent.

Numbers in the stats and write-ups are sourced from the Obsidian vault
(`AsimovX/`), not invented.
