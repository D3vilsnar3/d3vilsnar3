/* ============================================================================
   Scroll reveal.

   Content below the fold starts slightly offset and transparent, then settles
   into place the first time it scrolls into view. Deliberately short travel —
   12px for blocks, 6px sideways for list rows — so it reads as the page
   assembling itself rather than as things flying around.

   Items in the same group stagger, so a table or a card grid arrives in
   sequence instead of all at once. Runs once per element, then stops
   observing. Opacity and transform only: nothing reflows, so the scroll-snap
   positions stay exactly where they were.
   ========================================================================== */
(function () {
  "use strict";

  if (!("IntersectionObserver" in window)) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      el.classList.add("is-in");
      observer.unobserve(el);
      // Once it has arrived, strip everything this script added. The element
      // goes back to its own styles, so nothing here keeps overriding a hover
      // transition or the :target highlight on a deep-linked entry.
      var wait = (parseFloat(el.style.animationDelay) || 0) + 700;
      window.setTimeout(function () {
        el.classList.remove("reveal", "reveal-x", "is-in");
        el.style.animationDelay = "";
      }, wait);
    });
  }, { threshold: 0.08, rootMargin: "0px 0px -6% 0px" });

  /* [selector, direction, stagger step in ms]. An element is claimed by the
     first group that matches it, so the specific groups come before the
     catch-all block-level ones. */
  var GROUPS = [
    [".stat-log .stat-line", "y", 55],
    [".cap-grid .cap", "y", 50],
    [".proc tbody tr", "y", 38],
    [".timeline .tl-item", "y", 90],
    [".listing .entry", "y", 70],
    [".tl-points li", "x", 40],
    [".link-list li", "x", 45],
    [".contact-cards > *", "y", 70],
    [".block > .cmd", "y", 0],
    [".block > .page-title", "y", 0],
    [".block > .section-note", "y", 0],
    [".block > .out", "y", 0],
    [".block > .btn-row", "y", 0],
    [".block > .proc-more", "y", 0]
  ];

  var seen = [];

  GROUPS.forEach(function (g) {
    var sel = g[0], dir = g[1], step = g[2];
    var els = document.querySelectorAll(sel);
    // stagger counts per parent, so two separate tables each start from zero
    var parents = [], counters = [];

    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      // the hero runs its own scripted intro; leave it out of this
      if (el.closest && el.closest("#hero")) continue;
      if (seen.indexOf(el) !== -1) continue;
      seen.push(el);

      var p = el.parentNode;
      var pi = parents.indexOf(p);
      if (pi === -1) { parents.push(p); counters.push(0); pi = parents.length - 1; }
      var idx = counters[pi]++;

      el.classList.add("reveal");
      if (dir === "x") el.classList.add("reveal-x");
      if (step) el.style.animationDelay = Math.min(idx * step, 420) + "ms";
      observer.observe(el);
    }
  });
})();
