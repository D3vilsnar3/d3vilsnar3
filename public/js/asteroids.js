/* ============================================================================
   Decorative Asteroids banner — classic 1979 vector-wireframe style.
   A ship drifts and auto-fires at the nearest asteroid; asteroids wrap around
   the edges and split when hit. Purely ambient: no input, no score, no
   keyboard/scroll capture. Pauses when off-screen or when the tab is hidden.
   ========================================================================== */
(function () {
  "use strict";

  var canvas = document.getElementById("asteroids");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
  var stroke = "#62d9a8";      // mint — matches the terminal prompt colour
  var strokeDim = "#43866f";
  var bullets = [], rocks = [], debris = [];
  var running = true, visible = true;

  function resize() {
    var rect = canvas.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---------- ship ---------- */
  var ship = {
    x: 0, y: 0, angle: 0, vx: 0, vy: 0,
    cooldown: 0, thrust: false
  };

  function resetShip() {
    ship.x = W * 0.5;
    ship.y = H * 0.5;
    ship.angle = 0;
    ship.vx = 26;
    ship.vy = 6;
  }

  /* ---------- rocks ----------
     Four fixed silhouettes in the spirit of the original arcade game: each is
     a list of radius multipliers around the circle, with deliberate deep
     notches so the rocks read as angular and craggy rather than as blobs. */
  var ROCK_SHAPES = [
    [1.00, 0.92, 1.06, 0.62, 0.90, 1.04, 0.86, 1.02, 0.66, 0.96, 1.06, 0.88],
    [0.94, 1.06, 0.82, 0.98, 0.58, 0.92, 1.04, 0.88, 1.06, 0.72, 0.96, 0.90],
    [1.06, 0.78, 0.96, 1.02, 0.86, 1.06, 0.60, 0.90, 1.00, 0.94, 0.70, 1.02],
    [0.88, 1.02, 0.64, 1.06, 0.94, 0.84, 1.04, 0.68, 0.98, 1.06, 0.90, 0.76]
  ];

  function makeRock(x, y, size) {
    var verts = [];
    var shape = ROCK_SHAPES[Math.floor(Math.random() * ROCK_SHAPES.length)];
    var n = shape.length;
    var phase = Math.random() * Math.PI * 2;
    for (var i = 0; i < n; i++) {
      var a = phase + (i / n) * Math.PI * 2;
      // small per-instance jitter so repeats of the same silhouette differ
      var r = size * shape[i] * (0.94 + Math.random() * 0.12);
      verts.push({ a: a - phase, r: r });
    }
    var ang = Math.random() * Math.PI * 2;
    var speed = 8 + Math.random() * 16 + (3 - size / 14) * 4;
    return {
      x: x, y: y, size: size, verts: verts,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      rot: (Math.random() - 0.5) * 0.5,
      spin: 0
    };
  }

  function spawnRockAtEdge() {
    var size = 16 + Math.random() * 16;
    var edge = Math.floor(Math.random() * 4);
    var x = 0, y = 0;
    if (edge === 0) { x = -size; y = Math.random() * H; }
    else if (edge === 1) { x = W + size; y = Math.random() * H; }
    else if (edge === 2) { x = Math.random() * W; y = -size; }
    else { x = Math.random() * W; y = H + size; }
    rocks.push(makeRock(x, y, size));
  }

  function wrap(o, pad) {
    pad = pad || 20;
    if (o.x < -pad) o.x = W + pad;
    if (o.x > W + pad) o.x = -pad;
    if (o.y < -pad) o.y = H + pad;
    if (o.y > H + pad) o.y = -pad;
  }

  /* ---------- update ---------- */
  function nearestRock() {
    var best = null, bestD = Infinity;
    for (var i = 0; i < rocks.length; i++) {
      var dx = rocks[i].x - ship.x, dy = rocks[i].y - ship.y;
      var d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = rocks[i]; }
    }
    return best;
  }

  function update(dt) {
    // aim at the nearest rock, drift gently
    var target = nearestRock();
    if (target) {
      var desired = Math.atan2(target.y - ship.y, target.x - ship.x);
      var diff = Math.atan2(Math.sin(desired - ship.angle), Math.cos(desired - ship.angle));
      ship.angle += diff * Math.min(1, dt * 2.4);
    }
    ship.thrust = Math.random() < 0.04;
    if (ship.thrust) {
      ship.vx += Math.cos(ship.angle) * 22 * dt * 10;
      ship.vy += Math.sin(ship.angle) * 22 * dt * 10;
    }
    // gentle drag + speed clamp so it never rockets off
    ship.vx *= 0.995; ship.vy *= 0.995;
    var sp = Math.hypot(ship.vx, ship.vy);
    if (sp > 48) { ship.vx = (ship.vx / sp) * 48; ship.vy = (ship.vy / sp) * 48; }
    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;
    wrap(ship);

    // fire
    ship.cooldown -= dt;
    if (ship.cooldown <= 0 && rocks.length) {
      ship.cooldown = 0.55 + Math.random() * 0.5;
      bullets.push({
        x: ship.x + Math.cos(ship.angle) * 10,
        y: ship.y + Math.sin(ship.angle) * 10,
        vx: Math.cos(ship.angle) * 210 + ship.vx,
        vy: Math.sin(ship.angle) * 210 + ship.vy,
        life: 1.5
      });
    }

    // bullets
    for (var i = bullets.length - 1; i >= 0; i--) {
      var b = bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      wrap(b, 4);
      if (b.life <= 0) { bullets.splice(i, 1); continue; }
      for (var j = rocks.length - 1; j >= 0; j--) {
        var r = rocks[j];
        if (Math.hypot(r.x - b.x, r.y - b.y) < r.size) {
          bullets.splice(i, 1);
          // debris burst
          for (var d = 0; d < 6; d++) {
            var a = Math.random() * Math.PI * 2;
            var s = 20 + Math.random() * 50;
            debris.push({ x: r.x, y: r.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 });
          }
          if (r.size > 13) {
            rocks.push(makeRock(r.x, r.y, r.size * 0.55));
            rocks.push(makeRock(r.x, r.y, r.size * 0.55));
          }
          rocks.splice(j, 1);
          break;
        }
      }
    }

    // rocks
    for (var k = 0; k < rocks.length; k++) {
      var rk = rocks[k];
      rk.x += rk.vx * dt; rk.y += rk.vy * dt; rk.spin += rk.rot * dt;
      wrap(rk, rk.size + 6);
    }

    // debris
    for (var m = debris.length - 1; m >= 0; m--) {
      var dbg = debris[m];
      dbg.x += dbg.vx * dt; dbg.y += dbg.vy * dt; dbg.life -= dt;
      if (dbg.life <= 0) debris.splice(m, 1);
    }

    // keep the field populated
    if (rocks.length < 5 && Math.random() < 0.03) spawnRockAtEdge();
  }

  /* ---------- draw ---------- */
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 1.15;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // rocks
    ctx.strokeStyle = strokeDim;
    for (var i = 0; i < rocks.length; i++) {
      var r = rocks[i];
      ctx.beginPath();
      for (var v = 0; v < r.verts.length; v++) {
        var vert = r.verts[v];
        var a = vert.a + r.spin;
        var px = r.x + Math.cos(a) * vert.r;
        var py = r.y + Math.sin(a) * vert.r;
        if (v === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // bullets
    ctx.strokeStyle = stroke;
    for (var b = 0; b < bullets.length; b++) {
      var bl = bullets[b];
      ctx.beginPath();
      ctx.moveTo(bl.x, bl.y);
      ctx.lineTo(bl.x - bl.vx * 0.012, bl.y - bl.vy * 0.012);
      ctx.stroke();
    }

    // debris
    ctx.strokeStyle = strokeDim;
    for (var d = 0; d < debris.length; d++) {
      var dd = debris[d];
      ctx.globalAlpha = Math.max(0, dd.life * 2);
      ctx.beginPath();
      ctx.moveTo(dd.x, dd.y);
      ctx.lineTo(dd.x - dd.vx * 0.02, dd.y - dd.vy * 0.02);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // ship — classic triangle with a notched tail
    ctx.strokeStyle = stroke;
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.angle);
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-9, 8);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-9, -8);
    ctx.closePath();
    ctx.stroke();
    if (ship.thrust) {
      ctx.beginPath();
      ctx.moveTo(-6, 3);
      ctx.lineTo(-13, 0);
      ctx.lineTo(-6, -3);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------- loop ---------- */
  var last = performance.now();
  function frame(now) {
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (running && visible) {
      update(dt);
      draw();
    }
    requestAnimationFrame(frame);
  }

  function init() {
    resize();
    resetShip();
    rocks = [];
    for (var i = 0; i < 5; i++) {
      rocks.push(makeRock(Math.random() * W, Math.random() * H, 16 + Math.random() * 16));
    }
  }

  window.addEventListener("resize", function () { resize(); }, { passive: true });
  document.addEventListener("visibilitychange", function () {
    visible = !document.hidden;
    last = performance.now();
  });

  // stop drawing once the banner scrolls out of view
  if (window.IntersectionObserver) {
    var io = new IntersectionObserver(function (entries) {
      running = entries[0].isIntersecting;
      last = performance.now();
    }, { threshold: 0 });
    io.observe(canvas);
  }

  init();
  requestAnimationFrame(frame);
})();
