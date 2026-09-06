const root = document.documentElement;

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
  function step() {
    if (i <= text.length) {
      el.textContent = text.slice(0, i);
      i++;
      setTimeout(step, speed);
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
          typewriterReveal(entry.target, isIntro ? 14 : 6);
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
