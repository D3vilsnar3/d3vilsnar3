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

/* Page order drives the nav, the home section order and the sitemap. */
const PAGES = [
  { slug: "",            file: "hero.html",         nav: null,
    title: `${NAME} — Senior Automation & AI Systems Engineer`,
    desc: "Govind Pradeep — Senior Automation & AI Systems Engineer. Builds systems that act on their own: autonomous agents, computer vision, and production ML pipelines." },

  { slug: "capabilities", file: "capabilities.html", nav: "capabilities",
    homeFile: "capabilities-compact.html",
    title: `Capabilities — ${NAME}`,
    desc: "AI and LLM integration, computer vision, browser automation, cloud infrastructure, data engineering and team leadership." },

  { slug: "systems",      file: "systems.html",      nav: "systems",
    homeFile: "systems-table.html",
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

/* Sections that exist only on the home page: no standalone page, no nav entry
   and no sitemap URL. `after` names the PAGES slug they follow. */
const HOME_ONLY = [
  { slug: "stats", file: "stats.html", after: "" },
];

/* Each system/project gets its own page at /systems/<slug>/, generated from
   src/pages/systems/<slug>.html. `status` drives the tag shown on the page
   (ok | wip | run), `icon` names a glyph from public/js/project-icons.js
   that drifts through that page's margins. Order here is the order shown
   on /systems/ and in the home table — most recent/active first. */
const PROJECTS = [
  { slug: "thali", title: "Thali", status: "wip", icon: "plate",
    pipeline: "Natural-language meal log <span class=\"arrow\">-&gt;</span> AI coaching <span class=\"arrow\">-&gt;</span> Order through Swiggy &amp; Instamart",
    metric: "in beta on TestFlight" },
  { slug: "marketplace-negotiation-agent", title: "Marketplace Negotiation Agent", status: "run", icon: "tag",
    pipeline: "Capture listing <span class=\"arrow\">-&gt;</span> Vision model prices it <span class=\"arrow\">-&gt;</span> Negotiates autonomously",
    metric: "runs continuously on a cloud instance, negotiating in parallel" },
  { slug: "sports-capture-quality-control", title: "Sports Capture Quality Control", status: "ok", icon: "camera",
    pipeline: "Device upload <span class=\"arrow\">-&gt;</span> Parameter + CNN checks <span class=\"arrow\">-&gt;</span> AI fallback <span class=\"arrow\">-&gt;</span> Annotated video",
    metric: "86% recall on range-mode ball-impact detection · ~16s avg render time" },
  { slug: "launch-monitor-ml-suite", title: "Launch Monitor ML Suite", status: "ok", icon: "club",
    pipeline: "Collect 1,218 exports <span class=\"arrow\">-&gt;</span> Engineer features <span class=\"arrow\">-&gt;</span> Train 3 models <span class=\"arrow\">-&gt;</span> Ship to iOS",
    metric: "club speed error cut from 20.5 km/h (legacy) to 1.99 km/h" },
  { slug: "tournament-data-agent", title: "Tournament Data Agent", status: "ok", icon: "trophy",
    pipeline: "Discover pages <span class=\"arrow\">-&gt;</span> AI extraction <span class=\"arrow\">-&gt;</span> Read flyer images <span class=\"arrow\">-&gt;</span> Merge &amp; dedupe",
    metric: "178 tournaments extracted end to end from unstructured event pages" },
  { slug: "professional-network-automator", title: "Professional Network Automator", status: "ok", icon: "network",
    pipeline: "Browse leads <span class=\"arrow\">-&gt;</span> Human-paced engagement <span class=\"arrow\">-&gt;</span> Email alerting",
    metric: "1,541 items tracked · 98.8% success rate" },
  { slug: "web-scraping-fleet", title: "Web Scraping Fleet", status: "ok", icon: "web",
    pipeline: "Browser extension <span class=\"arrow\">-&gt;</span> Local server <span class=\"arrow\">-&gt;</span> Deduplicated dataset",
    metric: "22,000+ profiles and posts collected across 5 platforms" },

  { slug: "deep-listening", title: "Deep Listening", status: "ok", icon: "waveform", archive: true,
    pipeline: "Surveys &amp; uploads <span class=\"arrow\">-&gt;</span> Multi-modal extraction <span class=\"arrow\">-&gt;</span> Fine-tuned LLM <span class=\"arrow\">-&gt;</span> Vector retrieval",
    metric: "text, image, audio and video in one extraction pipeline" },
  { slug: "cipbot", title: "CipBot", status: "ok", icon: "chat", archive: true,
    pipeline: "WhatsApp <span class=\"arrow\">-&gt;</span> Structured chat flow <span class=\"arrow\">-&gt;</span> Client database <span class=\"arrow\">-&gt;</span> Admin panel",
    metric: "built on Rasa, live on WhatsApp for a pharma procurement team" },
  { slug: "trajectus-ivr", title: "Trajectus IVR", status: "ok", icon: "handset", archive: true,
    pipeline: "Phone call <span class=\"arrow\">-&gt;</span> Voice IVR <span class=\"arrow\">-&gt;</span> Medical query handling",
    metric: "voice-first, not text — a different failure surface entirely" },
  { slug: "coglide-cori-and-gx", title: "Coglide — Cori &amp; Gx", status: "ok", icon: "mail", archive: true,
    pipeline: "Inbound email <span class=\"arrow\">-&gt;</span> Contact extraction <span class=\"arrow\">-&gt;</span> Extension sync <span class=\"arrow\">-&gt;</span> Marketing database",
    metric: "the earliest version of the scraping work that runs through everything since" },
  { slug: "emotyx", title: "Emotyx", status: "ok", icon: "cctv", archive: true,
    pipeline: "Live CCTV <span class=\"arrow\">-&gt;</span> Backend network <span class=\"arrow\">-&gt;</span> Customer insights",
    metric: "real-time video in production, not batch analysis" },
  { slug: "attendance-management-system", title: "Attendance Management System", status: "ok", icon: "calendar", archive: true,
    pipeline: "Student records <span class=\"arrow\">-&gt;</span> Python backend <span class=\"arrow\">-&gt;</span> Image processing",
    metric: "full backend ownership, end to end" },
  { slug: "other-projects", title: "Other Projects", status: "ok", icon: "gear", archive: true,
    pipeline: null,
    metric: "the long tail — smaller builds, same instinct" },
];

const STATUS_TAG = { ok: "[ok]", wip: "[wip]", run: "[run]" };
const STATUS_CLASS = { ok: "tag-ok", wip: "tag-warn", run: "tag-run" };

/* The home page in section order — every page's section, with the home-only
   ones spliced in after whichever section they follow. */
function homeSections() {
  const out = [];
  for (const p of PAGES) {
    out.push({
      id: p.slug || "hero",
      // a page can render a different section on home than on its own page
      file: p.homeFile || p.file,
      attrs: "",
    });
    for (const extra of HOME_ONLY.filter((h) => h.after === p.slug)) {
      out.push({ id: extra.slug, file: extra.file, attrs: "" });
    }
  }
  return out;
}

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

function sectionWrap(id, body, attrs = "") {
  return `  <section class="block" id="${id}"${attrs}>\n${body}\n  </section>`;
}

function layout(page, body) {
  const isHome = page.slug === "";
  const urlPath = page.urlPath || href(page.slug);
  const navSlug = page.navSlug !== undefined ? page.navSlug : page.slug;
  return `<!doctype html>
<html lang="en"${isHome ? " data-snap" : ""}>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${page.title}</title>
<meta name="description" content="${page.desc}" />
<link rel="canonical" href="https://d3vilsnar3.com${urlPath}" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" type="image/png" sizes="32x32" href="/icon-32.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#08090b">
<link rel="stylesheet" href="/styles.css">
</head>
<body${isHome ? "" : ' data-page="inner"'}>

<canvas id="particles" aria-hidden="true"></canvas>
<canvas id="asteroids" aria-hidden="true"></canvas>
${page.icon ? `<canvas id="projicons" data-icon="${page.icon}" aria-hidden="true"></canvas>\n` : ""}

<header class="topbar">
  <a href="/" class="topbar-name" id="replayIntro"><img class="topbar-logo" src="/icon-32.png" alt="" width="32" height="32" decoding="async"><span>Govind Pradeep</span></a>
  <div class="topbar-right">
    <a class="topbar-cta" href="/contact/">contact me</a>
    <button type="button" class="hamburger" id="navToggle" aria-expanded="false" aria-controls="navMenu" aria-label="Open menu">
      <span></span><span></span><span></span>
    </button>
  </div>
</header>

<nav class="nav-menu" id="navMenu" aria-label="Sections" hidden>
  <div class="nav-inner">
  <div class="nav-main">
${nav(navSlug)}
    <span class="theme-toggle" role="group" aria-label="Theme">
      <span class="dim">theme:</span>
      <button type="button" class="theme-opt" data-theme-choice="dark">dark</button>
      <button type="button" class="theme-opt" data-theme-choice="light">light</button>
    </span>
  </div>
  <div class="nav-side">
    <p class="nav-side-title">quick links</p>
    <a href="https://www.linkedin.com/in/devilasenare/" target="_blank" rel="noopener noreferrer">linkedin <span class="ext" aria-hidden="true">-&gt;</span></a>
    <a href="https://github.com/D3vilsnar3" target="_blank" rel="noopener noreferrer">github <span class="ext" aria-hidden="true">-&gt;</span></a>
    <a href="/resume/Govind_Pradeep_Resume.pdf" download>resume <span class="ext" aria-hidden="true">pdf</span></a>
  </div>
  </div>
</nav>
${isHome ? '\n<div class="intro-name" id="introName" aria-hidden="true">Govind Pradeep</div>\n' : ""}
<main id="top">
${isHome ? "" : `<p class="cmd backlink"><a href="${page.backHref || `/#${page.slug}`}"><span class="back-arrow" aria-hidden="true">&#8592;</span><span class="prompt">$</span> cd ..<span class="dim"> # ${page.backLabel || "back to the home page"}</span></a></p>
`}
${body}

</main>

<footer class="footer">
  <span>&copy; 2026 ${NAME}</span>
</footer>

<script src="/js/particles.js"></script>
<script src="/js/asteroids.js"></script>
${page.icon ? '<script src="/js/project-icons.js"></script>\n' : ""}<script src="/js/fluid.js"></script>
<script src="/js/reveal.js"></script>
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
    body = homeSections()
      .map((s) => sectionWrap(s.id, read(s.file), s.attrs))
      .join('\n\n  <hr class="rule">\n\n');
  } else {
    // on its own page the section heading is the h1; inside home it stays an
    // h2 so the hero remains the single h1 there
    body = sectionWrap(
      page.slug,
      read(page.file).replace('<h2 class="page-title">', '<h1 class="page-title">')
                     .replace("</h2>", "</h1>")
    );
  }
  const dir = page.slug === "" ? OUT : path.join(OUT, page.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), layout(page, body));
  console.log(`  ${href(page.slug).padEnd(16)} ${page.slug === "" ? "(all sections)" : "<- src/pages/" + page.file}`);
  built++;
}

/* ---- one standalone page per system/project ---- */
for (const proj of PROJECTS) {
  const writeup = read(path.join("systems", `${proj.slug}.html`));
  const body = sectionWrap(
    proj.slug,
    `<p class="entry-head"><span class="tag ${STATUS_CLASS[proj.status]}">${STATUS_TAG[proj.status]}</span> <span class="path">${proj.title}</span></p>
${proj.pipeline ? `    <p class="pipeline">${proj.pipeline}</p>\n` : ""}    <h1 class="page-title">${proj.title.replace(/&amp;/g, "&")}</h1>
${writeup}
    <p class="entry-metric"># ${proj.metric}</p>`
  );
  const projPage = {
    slug: proj.slug,
    urlPath: `/systems/${proj.slug}/`,
    navSlug: "systems",
    backHref: "/systems/",
    backLabel: "back to systems",
    icon: proj.icon,
    title: `${proj.title.replace(/&amp;/g, "&")} — ${NAME}`,
    desc: `${proj.title.replace(/&amp;/g, "&")} — ${proj.metric}`,
  };
  const dir = path.join(OUT, "systems", proj.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), layout(projPage, body));
  console.log(`  /systems/${proj.slug}/`.padEnd(18) + ` <- src/pages/systems/${proj.slug}.html`);
  built++;
}

/* ---- sitemap + robots, so search engines can find every page ---- */
const today = new Date().toISOString().slice(0, 10);
const urls = PAGES.map((p) => `  <url>
    <loc>https://d3vilsnar3.com${href(p.slug)}</loc>
    <lastmod>${today}</lastmod>
    <priority>${p.slug === "" ? "1.0" : "0.8"}</priority>
  </url>`).concat(PROJECTS.map((p) => `  <url>
    <loc>https://d3vilsnar3.com/systems/${p.slug}/</loc>
    <lastmod>${today}</lastmod>
    <priority>0.6</priority>
  </url>`)).join("\n");

fs.writeFileSync(path.join(OUT, "sitemap.xml"),
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`);

fs.writeFileSync(path.join(OUT, "robots.txt"),
`User-agent: *
Allow: /

Sitemap: https://d3vilsnar3.com/sitemap.xml
`);
console.log("  /sitemap.xml     (" + (PAGES.length + PROJECTS.length) + " urls)");
console.log("  /robots.txt");

console.log(`\nbuilt ${built} pages into public/`);
