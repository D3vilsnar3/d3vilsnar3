/* ============================================================================
   Ambient full-page starfield.
   A quiet drifting particle layer behind the whole document, so the page
   reads as one continuous space rather than a game strip stuck at the top.
   Deliberately much subtler than the asteroids banner: small, slow, dim.
   ========================================================================== */
(function () {
  "use strict";

  var canvas = document.getElementById("particles");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var W = 0, H = 0;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var stars = [];
  var visible = true;

  function palette() {
    // follow the active theme so the field never fights the page
    var light = document.documentElement.getAttribute("data-theme") === "light";
    return light
      ? { dot: "10, 143, 99", maxA: 0.30 }
      : { dot: "98, 217, 168", maxA: 0.42 };
  }
  var colors = palette();

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
  }

  function build() {
    // density scales with area, capped so big monitors don't get busy
    var count = Math.min(150, Math.round((W * H) / 15000));
    stars = [];
    for (var i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.15 + 0.35,
        // slow drift, mostly upward — like the page is moving through space
        vx: (Math.random() - 0.5) * 5,
        vy: -(4 + Math.random() * 9),
        a: 0.18 + Math.random() * 0.55,
        tw: Math.random() * Math.PI * 2,          // twinkle phase
        tws: 0.4 + Math.random() * 1.1            // twinkle speed
      });
    }
  }

  function frame(dt, now) {
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;

      // wrap around the viewport
      if (s.y < -4) { s.y = H + 4; s.x = Math.random() * W; }
      if (s.x < -4) s.x = W + 4;
      if (s.x > W + 4) s.x = -4;

      var twinkle = 0.72 + 0.28 * Math.sin(s.tw + now * 0.001 * s.tws);
      var alpha = Math.min(colors.maxA, s.a * twinkle);
      ctx.fillStyle = "rgba(" + colors.dot + "," + alpha.toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  var last = performance.now();
  function loop(now) {
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (visible) frame(dt, now);
    requestAnimationFrame(loop);
  }

  window.addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", function () {
    visible = !document.hidden;
    last = performance.now();
  });

  // re-read colours when the light/dark toggle flips
  new MutationObserver(function () { colors = palette(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  resize();
  requestAnimationFrame(loop);
})();
