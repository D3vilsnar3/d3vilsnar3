/* ============================================================================
   Custom pointer — a small glowing dot that flows smoothly toward the real
   cursor position (eased every frame, not snapped per mousemove event, so
   motion reads as fluid rather than stepped), leaving a short wake of
   fading particles behind it. Desktop/fine-pointer only, and bails on
   prefers-reduced-motion like every other decorative layer on this site.
   ========================================================================== */
(function () {
  "use strict";

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  document.documentElement.classList.add("has-custom-cursor");

  var dot = document.createElement("div");
  dot.id = "cursorDot";
  dot.setAttribute("aria-hidden", "true");
  document.body.appendChild(dot);

  var canvas = document.createElement("canvas");
  canvas.id = "cursorTrail";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  var ctx = canvas.getContext("2d");

  var W, H, DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  var mx = W / 2, my = H / 2, dx = mx, dy = my;
  var moved = false;

  // the trail is one continuous path through recent raw pointer positions —
  // not independent spawned blobs — so it reads as a smooth line, not noise
  var TRAIL_MS = 260;
  var points = [];

  window.addEventListener(
    "mousemove",
    function (e) {
      mx = e.clientX;
      my = e.clientY;
      moved = true;
      var last = points[points.length - 1];
      if (!last || Math.hypot(mx - last.x, my - last.y) > 2) {
        points.push({ x: mx, y: my, t: performance.now() });
      }
    },
    { passive: true }
  );

  function color() {
    return getComputedStyle(document.documentElement).getPropertyValue("--fg").trim() || "#f0f2f0";
  }
  var fg = color();
  window.addEventListener("gp-theme-change", function () { fg = color(); });

  function frame() {
    requestAnimationFrame(frame);
    if (!moved) return;

    // ease the dot toward the raw pointer position every frame — this is
    // what makes the motion read as fluid rather than a series of jumps
    dx += (mx - dx) * 0.35;
    dy += (my - dy) * 0.35;
    dot.style.transform = "translate3d(" + (dx - 4) + "px," + (dy - 4) + "px,0)";

    var now = performance.now();
    while (points.length && now - points[0].t > TRAIL_MS) points.shift();

    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (var i = 1; i < points.length; i++) {
      var p0 = points[i - 1], p1 = points[i];
      var age = (now - p1.t) / TRAIL_MS; // 0 = fresh, 1 = about to expire
      var t = 1 - age;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.strokeStyle = hexToRgba(fg, t * 0.5);
      ctx.lineWidth = 2.5 + t * 6;
      ctx.stroke();
    }
  }

  function hexToRgba(hex, a) {
    var c = hex.replace("#", "");
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    var num = parseInt(c, 16);
    return "rgba(" + ((num >> 16) & 255) + "," + ((num >> 8) & 255) + "," + (num & 255) + "," + a + ")";
  }

  requestAnimationFrame(frame);
})();
