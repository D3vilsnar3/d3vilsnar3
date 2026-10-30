/* ============================================================================
   Per-project floating icons.
   A single themed glyph (set by the page's data-icon attribute) drifts
   slowly through the left/right margins of a project write-up page — the
   empty space either side of the text column on wide viewports. Desktop
   only, same convention as asteroids.js's ship zone, and bails out on
   prefers-reduced-motion like every other decorative canvas here.
   ========================================================================== */
(function () {
  "use strict";

  var canvas = document.getElementById("projicons");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var reduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  var iconName = canvas.getAttribute("data-icon");

  /* Each glyph is drawn stroked inside a roughly -12..12 box, centered on
     the origin, so every icon can share one spawn/animate/draw loop. */
  var ICONS = {
    tag: function (ctx) {
      ctx.beginPath();
      ctx.moveTo(-9, -1); ctx.lineTo(1, -11); ctx.lineTo(11, -1);
      ctx.lineTo(1, 9); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.arc(1, -5, 1.8, 0, Math.PI * 2); ctx.stroke();
    },
    camera: function (ctx) {
      ctx.beginPath();
      ctx.moveTo(-10, -5); ctx.lineTo(-10, 7); ctx.lineTo(10, 7); ctx.lineTo(10, -5);
      ctx.lineTo(4, -5); ctx.lineTo(1, -9); ctx.lineTo(-4, -9); ctx.lineTo(-7, -5);
      ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 1, 4, 0, Math.PI * 2); ctx.stroke();
    },
    club: function (ctx) {
      ctx.beginPath();
      ctx.moveTo(-6, -11); ctx.lineTo(6, 8); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(6, 8); ctx.lineTo(11, 11); ctx.lineTo(9, 3); ctx.closePath(); ctx.stroke();
    },
    trophy: function (ctx) {
      ctx.beginPath();
      ctx.moveTo(-6, -9); ctx.lineTo(6, -9); ctx.lineTo(5, 1);
      ctx.quadraticCurveTo(5, 6, 0, 6); ctx.quadraticCurveTo(-5, 6, -6, 1);
      ctx.closePath(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-6, -8); ctx.quadraticCurveTo(-12, -8, -9, -2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(6, -8); ctx.quadraticCurveTo(12, -8, 9, -2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-4, 10); ctx.lineTo(4, 10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, 10); ctx.stroke();
    },
    network: function (ctx) {
      var pts = [[0, -10], [-9, 7], [9, 7]];
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(pts[1][0], pts[1][1]);
      ctx.lineTo(pts[2][0], pts[2][1]); ctx.closePath(); ctx.stroke();
      for (var i = 0; i < pts.length; i++) {
        ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], 2.2, 0, Math.PI * 2); ctx.stroke();
      }
    },
    web: function (ctx) {
      ctx.beginPath(); ctx.arc(-2, -2, 7, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(3, 3); ctx.lineTo(11, 11); ctx.stroke();
    },
    plate: function (ctx) {
      ctx.beginPath(); ctx.arc(2, 0, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(2, 0, 4, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-10, -9); ctx.lineTo(-10, -1);
      ctx.moveTo(-11, -9); ctx.lineTo(-11, -4);
      ctx.moveTo(-9, -9); ctx.lineTo(-9, -4);
      ctx.moveTo(-10, -1); ctx.lineTo(-10, 9);
      ctx.stroke();
    },
    waveform: function (ctx) {
      var bars = [3, 8, 5, 10, 4];
      ctx.beginPath();
      for (var i = 0; i < bars.length; i++) {
        var x = -10 + i * 5;
        ctx.moveTo(x, -bars[i]); ctx.lineTo(x, bars[i]);
      }
      ctx.stroke();
    },
    chat: function (ctx) {
      ctx.beginPath();
      ctx.moveTo(-10, -8); ctx.lineTo(10, -8); ctx.lineTo(10, 4); ctx.lineTo(-2, 4);
      ctx.lineTo(-6, 10); ctx.lineTo(-6, 4); ctx.lineTo(-10, 4); ctx.closePath();
      ctx.stroke();
    },
    handset: function (ctx) {
      ctx.beginPath();
      ctx.moveTo(-8, -8);
      ctx.quadraticCurveTo(-11, -4, -6, 1);
      ctx.quadraticCurveTo(-1, 6, 4, 10);
      ctx.quadraticCurveTo(11, 13, 9, 7);
      ctx.quadraticCurveTo(7, 3, 4, 5);
      ctx.quadraticCurveTo(0, 1, -4, -3);
      ctx.quadraticCurveTo(-6, -6, -2, -8);
      ctx.quadraticCurveTo(-4, -12, -8, -8);
      ctx.closePath();
      ctx.stroke();
    },
    mail: function (ctx) {
      ctx.beginPath();
      ctx.moveTo(-11, -7); ctx.lineTo(11, -7); ctx.lineTo(11, 7); ctx.lineTo(-11, 7);
      ctx.closePath(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-11, -7); ctx.lineTo(0, 2); ctx.lineTo(11, -7); ctx.stroke();
    },
    cctv: function (ctx) {
      ctx.beginPath();
      ctx.moveTo(-9, -3); ctx.lineTo(4, -3); ctx.lineTo(4, 5); ctx.lineTo(-9, 5);
      ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.arc(4, 1, 3, -Math.PI / 2, Math.PI / 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(10, -2); ctx.lineTo(7, 1); ctx.lineTo(10, 4); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-9, -3); ctx.lineTo(-11, -9); ctx.moveTo(-9, 5); ctx.lineTo(-11, 9);
      ctx.stroke();
    },
    calendar: function (ctx) {
      ctx.beginPath();
      ctx.moveTo(-10, -8); ctx.lineTo(10, -8); ctx.lineTo(10, 10); ctx.lineTo(-10, 10);
      ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-10, -3); ctx.lineTo(10, -3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-5, -11); ctx.lineTo(-5, -6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(5, -11); ctx.lineTo(5, -6); ctx.stroke();
    },
    gear: function (ctx) {
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.stroke();
      for (var i = 0; i < 8; i++) {
        var a = (i / 8) * Math.PI * 2;
        var x1 = Math.cos(a) * 7, y1 = Math.sin(a) * 7;
        var x2 = Math.cos(a) * 11, y2 = Math.sin(a) * 11;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
    },
  };

  var draw = ICONS[iconName];
  if (!draw) return;

  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0, H = 0, marginW = 0;
  var items = [];

  function contentMax() {
    var v = getComputedStyle(document.documentElement).getPropertyValue("--content-max");
    var n = parseFloat(v);
    return isFinite(n) ? n : 760;
  }

  function color() {
    var light = document.documentElement.getAttribute("data-theme") === "light";
    return light ? "10, 143, 99" : "98, 217, 168";
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    marginW = Math.max(0, (W - contentMax()) / 2 - 24);
    build();
  }

  function build() {
    items = [];
    if (W < 900 || marginW < 110) return; // no room worth floating in
    var count = 5;
    for (var i = 0; i < count; i++) {
      var side = i % 2 === 0 ? 0 : 1;
      var x = side === 0
        ? 24 + Math.random() * (marginW - 24)
        : W - 24 - Math.random() * (marginW - 24);
      items.push({
        x: x,
        baseX: x,
        y: Math.random() * H,
        size: 13 + Math.random() * 9,
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.0025,
        vy: -(0.08 + Math.random() * 0.1),
        phase: Math.random() * Math.PI * 2,
        sway: 10 + Math.random() * 14,
        alpha: 0.1 + Math.random() * 0.14,
      });
    }
  }

  function frame() {
    ctx.clearRect(0, 0, W, H);
    if (items.length) {
      var rgb = color();
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        it.y += it.vy;
        it.rot += it.spin;
        it.phase += 0.006;
        if (it.y < -30) it.y = H + 30;
        if (it.y > H + 30) it.y = -30;
        var x = it.baseX + Math.sin(it.phase) * it.sway;
        ctx.save();
        ctx.translate(x, it.y);
        ctx.rotate(it.rot);
        ctx.scale(it.size / 22, it.size / 22);
        ctx.strokeStyle = "rgba(" + rgb + ", " + it.alpha + ")";
        ctx.lineWidth = 1.4;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        draw(ctx);
        ctx.restore();
      }
    }
    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(frame);
})();
