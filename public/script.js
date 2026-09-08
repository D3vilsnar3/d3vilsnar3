const root = document.documentElement;

/* ---------- page-load intro ----------
   The asteroid field already covers the whole page, so nothing has to resize:
   the name simply sits centred over it while the ship makes a scripted pass
   through it, then the name travels up into its hero position and the page
   fades in behind it. Runs once per session; any input skips to the end. */
(function intro() {
  const introName = document.getElementById("introName");
  const heroName = document.querySelector("#hero h1");
  // inner pages have no intro overlay — just settle the ship and move on
  if (!introName || !heroName) {
    if (window.GPAsteroids) window.GPAsteroids.confineToTop();
    return;
  }

  const settle = () => {
    if (window.GPAsteroids) window.GPAsteroids.confineToTop();
  };

  let played = false;
  try { played = sessionStorage.getItem("gp-intro") === "1"; } catch (e) {}
  if (played) { introName.remove(); settle(); return; }
  try { sessionStorage.setItem("gp-intro", "1"); } catch (e) {}

  root.classList.add("intro-active");

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    introName.remove();
    root.classList.remove("intro-active", "intro-settling");
    settle();
  };
  ["click", "keydown", "wheel", "touchstart"].forEach((ev) =>
    window.addEventListener(ev, finish, { once: true, passive: true })
  );

  // fly the ship straight through the centred name
  requestAnimationFrame(() => {
    if (window.GPAsteroids) window.GPAsteroids.flyby(1.7);
  });

  // then send the name up to its real position and bring the page in
  setTimeout(() => {
    if (done) return;
    root.classList.add("intro-settling");

    // Anchor the flight by TOP-LEFT, not centre. The floating name is
    // shrink-wrapped to its text while the hero <h1> is a full-width block,
    // so matching centres left their left edges ~35px apart on narrow
    // screens and the text visibly jumped sideways at the hand-off.
    const from = introName.getBoundingClientRect();
    introName.style.left = from.left + "px";
    introName.style.top = from.top + "px";
    introName.style.transform = "none";
    introName.style.transformOrigin = "top left";
    void introName.offsetWidth;                     // commit before animating

    const to = heroName.getBoundingClientRect();
    const fromFont = parseFloat(getComputedStyle(introName).fontSize);
    const toFont = parseFloat(getComputedStyle(heroName).fontSize);
    const scale = toFont / fromFont;                // glyphs match exactly

    introName.classList.add("flying");
    introName.style.transform =
      `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${scale})`;

    setTimeout(finish, 1600);
  }, 1750);
})();

/* ---------- hamburger nav ---------- */
const navToggle = document.getElementById("navToggle");
const navMenu = document.getElementById("navMenu");
if (navToggle && navMenu) {
  navToggle.addEventListener("click", () => {
    const isOpen = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!isOpen));
    navMenu.hidden = isOpen;
  });
  navMenu.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => {
      navToggle.setAttribute("aria-expanded", "false");
      navMenu.hidden = true;
    });
  });
}

/* ---------- theme toggle ---------- */
const THEME_KEY = "gp-theme";
const themeButtons = document.querySelectorAll(".theme-opt");

function applyTheme(theme) {
  if (theme === "light") {
    root.setAttribute("data-theme", "light");
  } else {
    root.setAttribute("data-theme", "dark");
  }
  themeButtons.forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.themeChoice === theme));
  });
}

let savedTheme = "dark";
try {
  savedTheme = localStorage.getItem(THEME_KEY) || "dark";
} catch (e) {
  /* localStorage unavailable — default to dark */
}
applyTheme(savedTheme);

themeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const choice = btn.dataset.themeChoice;
    applyTheme(choice);
    try {
      localStorage.setItem(THEME_KEY, choice);
    } catch (e) {
      /* ignore */
    }
  });
});

/* ---------- typewriter reveal for every descriptive text block ----------
   Applies to anything marked .type-target: the hero intro, every
   capability/system description, and every experience bullet. Each types
   out the first time it scrolls into view, preserving any links/bold text
   inside it (stored up front, restored once typing finishes). */
function typewriterReveal(el, speed) {
  if (el.dataset.typed === "1") return;
  el.dataset.typed = "1";
  const html = el.innerHTML;
  const text = el.textContent;
  el.textContent = "";
  el.classList.add("typing");
  let i = 0;
  /* Browsers clamp nested setTimeout to ~4ms, so simply lowering `speed` stops
     buying anything past that floor. Tick on a steady frame instead and type
     however many characters that frame is worth — genuinely faster, and
     smoother than fighting the timer. */
  const TICK = 16;
  const perTick = Math.max(1, Math.round(TICK / speed));
  function step() {
    if (i <= text.length) {
      el.textContent = text.slice(0, i);
      i += perTick;
      setTimeout(step, TICK);
    } else {
      el.innerHTML = html;
      el.classList.remove("typing");
    }
  }
  step();
}

const typeTargets = document.querySelectorAll(".type-target");
if (typeTargets.length) {
  const typeObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const isIntro = entry.target.id === "introText";
          typewriterReveal(entry.target, isIntro ? 6 : 3);
          typeObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
  );
  typeTargets.forEach((el) => typeObserver.observe(el));
}

/* ---------- stat count-up ---------- */
const statEls = document.querySelectorAll(".stat-num");

function formatNumber(n) {
  return n.toLocaleString("en-US");
}

/* Counts 0 -> data-count on first view. If data-end is set, the number then
   keeps creeping upward toward it while the page is open (a live telemetry
   feel); without data-end it simply settles and stays put. */
function animateCount(el) {
  const target = parseInt(el.dataset.count, 10) || 0;
  const end = el.dataset.end ? parseInt(el.dataset.end, 10) : null;
  const suffix = el.dataset.suffix || "";
  const duration = 2000;
  const start = performance.now();

  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    el.textContent = formatNumber(Math.round(target * eased)) + suffix;
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = formatNumber(target) + suffix;
      if (end && end > target) startLiveTick(el, target, end, suffix);
    }
  }
  requestAnimationFrame(step);
}

function startLiveTick(el, from, to, suffix) {
  if (el.dataset.ticking === "1") return;
  el.dataset.ticking = "1";
  let value = from;
  const span = to - from;
  // creep across the whole range over roughly four minutes
  const stepSize = Math.max(1, Math.round(span / 110));

  function tick() {
    if (value >= to) {
      el.textContent = formatNumber(to) + suffix;
      return;
    }
    const jitter = 0.4 + Math.random() * 1.2;
    value = Math.min(to, value + Math.max(1, Math.round(stepSize * jitter)));
    el.textContent = formatNumber(value) + suffix;
    setTimeout(tick, 1600 + Math.random() * 2600);
  }
  setTimeout(tick, 1200);
}

if (statEls.length) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.target.dataset.counted !== "1") {
          entry.target.dataset.counted = "1";
          animateCount(entry.target);
        }
      });
    },
    { threshold: 0.4 }
  );
  statEls.forEach((el) => observer.observe(el));
}


/* ---------- experience timeline: fill the rail as you scroll ---------- */
(function timelineRail() {
  const fill = document.getElementById("railFill");
  const rail = fill && fill.parentElement;
  if (!fill || !rail) return;

  function update() {
    const r = rail.getBoundingClientRect();
    const vh = window.innerHeight;
    // 0 when the rail's top reaches the middle of the screen, 1 at its bottom
    const progress = (vh * 0.5 - r.top) / r.height;
    fill.style.transform = `scaleY(${Math.max(0, Math.min(1, progress))})`;
  }

  let ticking = false;
  function onScroll() {
    if (!ticking) { requestAnimationFrame(() => { update(); ticking = false; }); ticking = true; }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  update();
})();


/* ---------- contact: live local time ---------- */
(function localClock() {
  const el = document.getElementById("localTime");
  if (!el) return;
  function tick() {
    el.textContent = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(new Date());
  }
  tick();
  setInterval(tick, 20000);
})();


/* ---------- park the ship in whatever space a section leaves ----------
   Some sections (the intro, writing, about) only fill the left of a wide
   screen, leaving a column of nothing on the right. Where that gap is big
   enough the ship is handed it and patrols there instead of the strip along
   the top; everywhere else it goes back to the top band.

   The gap is measured from the actual text, not from the block boxes - the
   blocks are full-width by definition, so their rects would always report no
   space at all. Desktop only: a phone has no spare column to give. */
(function shipParking() {
  if (!window.GPAsteroids || !window.GPAsteroids.setZone) return;

  const sections = [...document.querySelectorAll("main > section.block")];
  if (!sections.length) return;

  const wide = window.matchMedia("(min-width: 1000px)");
  const MIN_GAP = 380;           // narrower than this and the ship is cramped
  const GUTTER = 44;             // breathing room between the text and the ship
  let gaps = new Map();

  function textRight(section) {
    const range = document.createRange();
    let max = 0;
    const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      if (!n.nodeValue.trim()) continue;
      range.selectNodeContents(n);
      const r = range.getBoundingClientRect();
      if (r.width && r.right > max) max = r.right;
    }
    // logos, tables and other replaced boxes are content too
    section.querySelectorAll("img, table, canvas").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width && r.right > max) max = r.right;
    });
    return max;
  }

  function measure() {
    gaps = new Map();
    if (!wide.matches) return;
    sections.forEach((s) => {
      const right = textRight(s);
      const free = window.innerWidth - right;
      if (right > 0 && free >= MIN_GAP) {
        gaps.set(s.id, { x0: right + GUTTER, x1: window.innerWidth - 40 });
      }
    });
  }

  let current = null;
  function apply() {
    if (!wide.matches) {
      if (current !== null) { current = null; window.GPAsteroids.setZone(null); }
      return;
    }
    const mid = window.innerHeight / 2;
    let active = null;
    for (const s of sections) {
      const r = s.getBoundingClientRect();
      if (r.top <= mid && r.bottom >= mid) { active = s; break; }
    }
    const gap = active && gaps.get(active.id);
    const key = gap ? active.id : null;
    if (key === current) return;
    current = key;
    window.GPAsteroids.setZone(
      gap ? { x0: gap.x0, y0: 130, x1: gap.x1, y1: window.innerHeight - 130 } : null
    );
  }

  let queued = false;
  function onScroll() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; apply(); });
  }

  let resizeTimer;
  function refresh() { measure(); current = "?"; apply(); }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(refresh, 180);
  }, { passive: true });
  if (wide.addEventListener) wide.addEventListener("change", refresh);

  // wait for the webfont, so the width measured is the final one
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
  setTimeout(refresh, 600);

  window.GPShipParking = {
    gaps: function () { return Object.fromEntries(gaps); },
    current: function () { return current; }
  };
})();


/* ---------- clicking the name replays the page-load intro ----------
   The intro is gated on a sessionStorage flag so it only plays once a visit.
   Clearing the flag and reloading is what actually replays it: from an inner
   page a plain navigation is enough, but on the home page dropping a #hash
   alone would not reload, so the hash is stripped first and the load forced. */
(function replayIntro() {
  const name = document.getElementById("replayIntro");
  if (!name) return;
  name.addEventListener("click", (e) => {
    e.preventDefault();
    try { sessionStorage.removeItem("gp-intro"); } catch (err) {}
    if (window.location.pathname === "/") {
      history.replaceState(null, "", "/");
      window.location.reload();
    } else {
      window.location.href = "/";
    }
  });
})();


/* ---------- keep a #hash landing accurate after the page settles ----------
   The browser jumps to the fragment early, then the page keeps growing above
   it - the webfont swaps in, and the hero types its intro line out, which
   alone adds a couple of hundred pixels. Scroll anchoring then faithfully
   preserves the stale position, so the section ends up sitting well below the
   sticky bar instead of under it.

   One correction is not enough because the growth arrives in stages, so this
   re-aims for a short window and then gets out of the way - immediately, if
   the reader starts scrolling for themselves. */
(function anchorSettle() {
  if (!window.location.hash) return;

  var userMoved = false;
  ["wheel", "touchstart", "keydown"].forEach(function (ev) {
    window.addEventListener(ev, function () { userMoved = true; }, { once: true, passive: true });
  });

  var deadline = Date.now() + 2800;
  var timer = window.setInterval(function () {
    if (userMoved || Date.now() > deadline) { window.clearInterval(timer); return; }
    var el;
    try { el = document.getElementById(decodeURIComponent(window.location.hash.slice(1))); }
    catch (e) { window.clearInterval(timer); return; }
    if (!el) return;
    /* Where this target should come to rest: the scrollport's own padding,
       plus whatever scroll-margin the element carries. Entries set 80px of
       their own and inner pages set no padding, so neither number alone is
       the answer. Comparing against the real resting offset also avoids
       mistaking scroll anchoring's held position for a correct one. */
    var pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    var margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
    if (Math.abs(el.getBoundingClientRect().top - (pad + margin)) > 4) {
      el.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }, 110);
})();
