#!/usr/bin/env node
/* ============================================================================
   Static site builder.

   Assembles src/pages/*.html into standalone pages under public/, each wrapped
   in the shared shell (head, top bar, hamburger nav, background canvases,
   footer). No framework and no build step on the host — run `node build.js`,
   commit the generated output, and Cloudflare serves it as plain files.
   ========================================================================== */
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "src", "pages");
const OUT = path.join(__dirname, "public");
const NAME = "Govind Pradeep";
const ROLE = "Senior Automation &amp; AI Systems Engineer";

/* Page order drives both the nav and the prev/next footer links. */
const PAGES = [
  { slug: "",            file: "hero.html",         nav: null,
    title: `${NAME} — Senior Automation & AI Systems Engineer`,
    desc: "Govind Pradeep — Senior Automation & AI Systems Engineer. Builds systems that act on their own: autonomous agents, computer vision, and production ML pipelines." },

  { slug: "capabilities", file: "capabilities.html", nav: "capabilities",
    title: `Capabilities — ${NAME}`,
    desc: "AI and LLM integration, computer vision, browser automation, cloud infrastructure, data engineering and team leadership." },

  { slug: "systems",      file: "systems.html",      nav: "systems",
    title: `Systems — ${NAME}`,
    desc: "Autonomous agents, production computer-vision pipelines and scraping systems, built end to end and run in production." },

  { slug: "experience",   file: "experience.html",   nav: "experience",
    title: `Experience — ${NAME}`,
    desc: "Senior Automation & AI Engineer at AsimovX, previously AI Engineer at Accubits Technologies." },

  { slug: "about",        file: "about.html",        nav: "about",
    title: `About — ${NAME}`,
    desc: "About Govind Pradeep — what I enjoy building, and what I do away from the keyboard." },

  { slug: "blog",         file: "blog.html",         nav: "blog",
    title: `Blog — ${NAME}`,
    desc: "Writing on automation, AI engineering and things built along the way." },

  { slug: "contact",      file: "contact.html",      nav: "contact",
    title: `Contact — ${NAME}`,
    desc: "Get in touch with Govind Pradeep — book a 30-minute call, email, or connect on LinkedIn." },
];

const href = (slug) => (slug === "" ? "/" : `/${slug}/`);

function nav(currentSlug) {
  const items = PAGES.filter((p) => p.nav)
    .map((p) => {
      const active = p.slug === currentSlug ? ' class="is-active"' : "";
      return `  <a href="${href(p.slug)}"${active}>${p.nav}</a>`;
    })
    .join("\n");
  return `${items}
  <a class="nav-cta" href="/book">let's talk for 30m</a>`;
}

function sectionWrap(id, body) {
  return `  <section class="block" id="${id}">\n${body}\n  </section>`;
}

function layout(page, body) {
  const isHome = page.slug === "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${page.title}</title>
<meta name="description" content="${page.desc}" />
<link rel="canonical" href="https://d3vilsnar3.com${href(page.slug)}" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
</head>
<body${isHome ? "" : ' data-page="inner"'}>

<canvas id="particles" aria-hidden="true"></canvas>
<canvas id="asteroids" aria-hidden="true"></canvas>

<header class="topbar">
  <a href="/" class="topbar-name">govind pradeep</a>
  <button type="button" class="hamburger" id="navToggle" aria-expanded="false" aria-controls="navMenu" aria-label="Open menu">
    <span></span><span></span><span></span>
  </button>
</header>

<nav class="nav-menu" id="navMenu" aria-label="Sections" hidden>
${nav(page.slug)}
  <span class="theme-toggle" role="group" aria-label="Theme">
    <span class="dim">theme:</span>
    <button type="button" class="theme-opt" data-theme-choice="dark">dark</button>
    <button type="button" class="theme-opt" data-theme-choice="light">light</button>
  </span>
</nav>
${isHome ? '\n<div class="intro-name" id="introName" aria-hidden="true">govind pradeep</div>\n' : ""}
<main id="top">

${body}

</main>

<footer class="footer">
  <span>&copy; 2026 ${NAME}</span>
</footer>

<script src="/js/particles.js"></script>
<script src="/js/asteroids.js"></script>
<script src="/script.js"></script>
</body>
</html>
`;
}

const read = (file) =>
  fs.readFileSync(path.join(SRC, file), "utf8").replace(/\s+$/, "");

let built = 0;
for (const page of PAGES) {
  let body;
  if (page.slug === "") {
    // the home page still carries every section, one after another, so the
    // whole story reads top to bottom for anyone who just scrolls
    body = PAGES.map((p) => sectionWrap(p.slug || "hero", read(p.file)))
      .join('\n\n  <hr class="rule">\n\n');
  } else {
    body = sectionWrap(page.slug, read(page.file));
  }
  const dir = page.slug === "" ? OUT : path.join(OUT, page.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), layout(page, body));
  console.log(`  ${href(page.slug).padEnd(16)} ${page.slug === "" ? "(all sections)" : "<- src/pages/" + page.file}`);
  built++;
}
console.log(`\nbuilt ${built} pages into public/`);
