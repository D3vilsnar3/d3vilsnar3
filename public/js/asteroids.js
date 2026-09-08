/* ============================================================================
   Full-page vector-asteroid field.
   Asteroids drift across the entire viewport as an ambient space backdrop;
   the ship patrols the top band of the screen, auto-firing at whatever rock
   is nearest. During the page-load intro the ship is handed a scripted
   straight-line pass so it flies through the centred name.

   Purely decorative: fixed behind all content, pointer-events none, no input.
   ========================================================================== */
(function () {
  "use strict";

  var canvas = document.getElementById("asteroids");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
  var MINT = "98, 217, 168";
  var AMBER = "255, 180, 84";
  var bullets = [], rocks = [], debris = [];
  var visible = true;
  var scriptedUntil = 0;   // straight commanded path (intro flyby)
  // intro: one aimed shot breaks a cluster apart, then the ship flies through it
  var clusterLive = false, clusterX = 0, clusterY = 0;
  var introShotAt = 0, introShatterAt = 0, introFired = false;
  var confineShip = false;    // hard-clamped inside the current zone
  var returningToBand = false; // flying back to it under its own power
  /* Where the ship is allowed to live. Null means the default top band; the
     page hands it a rectangle when a section leaves dead space on the right. */
  var shipZone = null;

  /* The ship stays inside the strip it used to occupy as a banner —
     200px on desktop, 140px on mobile — even though the asteroid field
     now covers the whole page. */
  function bannerHeight() {
    return window.matchMedia("(max-width: 600px)").matches ? 140 : 200;
  }
  function shipBand() { return bannerHeight() - 26; }

  /* The band across the top is just a zone like any other; it is the one the
     ship falls back to when the page has nothing better to offer. It wraps
     horizontally, where a parked zone bounces on every side. */
  function activeZone() {
    if (shipZone) return shipZone;
    return { x0: -24, y0: 34, x1: W + 24, y1: shipBand(), wrapX: true };
  }
  function zoneCentre() {
    var z = activeZone();
    return { x: (z.x0 + z.x1) / 2, y: (z.y0 + z.y1) / 2 };
  }
  function outsideZone() {
    var z = activeZone(), m = 8;
    return ship.x < z.x0 - m || ship.x > z.x1 + m || ship.y < z.y0 - m || ship.y > z.y1 + m;
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---------- ship ---------- */
  var ship = { x: 0, y: 0, angle: 0, vx: 0, vy: 0, cooldown: 0, thrust: false };

  function resetShip() {
    ship.x = W * 0.5;
    ship.y = shipBand() * 0.55;
    ship.angle = 0;
    ship.vx = 26;
    ship.vy = 4;
  }

  /* ---------- rocks ----------
     Four fixed craggy silhouettes in the spirit of the original arcade game,
     each a set of radius multipliers with deliberate deep notches. */
  var ROCK_SHAPES = [
    [1.00, 0.92, 1.06, 0.62, 0.90, 1.04, 0.86, 1.02, 0.66, 0.96, 1.06, 0.88],
    [0.94, 1.06, 0.82, 0.98, 0.58, 0.92, 1.04, 0.88, 1.06, 0.72, 0.96, 0.90],
    [1.06, 0.78, 0.96, 1.02, 0.86, 1.06, 0.60, 0.90, 1.00, 0.94, 0.70, 1.02],
    [0.88, 1.02, 0.64, 1.06, 0.94, 0.84, 1.04, 0.68, 0.98, 1.06, 0.90, 0.76]
  ];

  function makeRock(x, y, size) {
    var shape = ROCK_SHAPES[(Math.random() * ROCK_SHAPES.length) | 0];
    var n = shape.length, verts = [];
    for (var i = 0; i < n; i++) {
      verts.push({
        a: (i / n) * Math.PI * 2,
        r: size * shape[i] * (0.94 + Math.random() * 0.12)
      });
    }
    // a couple of interior crater marks give the silhouette some depth
    var craters = [];
    var cn = 1 + ((Math.random() * 3) | 0);
    for (var c = 0; c < cn; c++) {
      craters.push({
        a: Math.random() * Math.PI * 2,
        d: size * (0.15 + Math.random() * 0.4),
        r: size * (0.08 + Math.random() * 0.16)
      });
    }
    var ang = Math.random() * Math.PI * 2;
    var speed = 5 + Math.random() * 11 + (34 - size) * 0.18;
    return {
      x: x, y: y, size: size, verts: verts, craters: craters,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      rot: (Math.random() - 0.5) * 0.4,
      spin: Math.random() * Math.PI * 2,
      // vary brightness a little so the field has depth
      glow: 0.5 + Math.random() * 0.5
    };
  }

  function targetRockCount() {
    // scale with viewport area so a big screen isn't sparse. The home page
    // carries a denser field than the standalone pages, where the rocks sit
    // behind long-form reading and want to stay quieter.
    var home = document.body.getAttribute("data-page") !== "inner";
    var area = (W * H) / (home ? 72000 : 130000);
    return home
      ? Math.max(10, Math.min(30, Math.round(area)))
      : Math.max(7, Math.min(16, Math.round(area)));
  }

  function spawnRockAtEdge() {
    var size = 15 + Math.random() * 20;
    var edge = (Math.random() * 4) | 0;
    var x, y;
    if (edge === 0) { x = -size; y = Math.random() * H; }
    else if (edge === 1) { x = W + size; y = Math.random() * H; }
    else if (edge === 2) { x = Math.random() * W; y = -size; }
    else { x = Math.random() * W; y = H + size; }
    rocks.push(makeRock(x, y, size));
  }

  function populate() {
    rocks = [];
    var n = targetRockCount();
    for (var i = 0; i < n; i++) {
      rocks.push(makeRock(Math.random() * W, Math.random() * H, 15 + Math.random() * 20));
    }
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
    var limit = confineShip ? activeZone().y1 + 90 : H;
    for (var i = 0; i < rocks.length; i++) {
      var r = rocks[i];
      if (r.y > limit) continue;             // ignore rocks far below the band
      var dx = r.x - ship.x, dy = r.y - ship.y;
      var d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = r; }
    }
    return best;
  }

  function update(dt) {
    if (performance.now() < scriptedUntil) {
      ship.x += ship.vx * dt;
      ship.y += ship.vy * dt;
      ship.thrust = true;
      introStep();
      stepWorld(dt);
      return;
    }

    var target = nearestRock();
    if (target) {
      var desired = Math.atan2(target.y - ship.y, target.x - ship.x);
      var diff = Math.atan2(Math.sin(desired - ship.angle), Math.cos(desired - ship.angle));
      ship.angle += diff * Math.min(1, dt * 2.2);
    }
    ship.thrust = Math.random() < 0.05;
    if (ship.thrust) {
      ship.vx += Math.cos(ship.angle) * 210 * dt;
      ship.vy += Math.sin(ship.angle) * 210 * dt;
    }
    ship.vx *= 0.995; ship.vy *= 0.995;
    // normal patrol speed is a slow drift; the flight home is much brisker
    var maxSpeed = returningToBand ? 330 : 46;
    var sp = Math.hypot(ship.vx, ship.vy);
    if (sp > maxSpeed) { ship.vx = (ship.vx / sp) * maxSpeed; ship.vy = (ship.vy / sp) * maxSpeed; }

    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;

    if (returningToBand) {
      // fly across under thrust rather than snapping there: aim at the middle
      // of the zone and accelerate, handing over to the clamp on arrival
      var c = zoneCentre();
      var aim = Math.atan2(c.y - ship.y, c.x - ship.x);
      var d2 = Math.atan2(Math.sin(aim - ship.angle), Math.cos(aim - ship.angle));
      ship.angle += d2 * Math.min(1, dt * 4.5);
      ship.vx = Math.cos(ship.angle) * 330;
      ship.vy = Math.sin(ship.angle) * 330;
      ship.thrust = true;
      if (!outsideZone()) {
        returningToBand = false;
        confineShip = true;
        // bleed the transit speed off into a normal drift
        ship.vx *= 0.18; ship.vy *= 0.18;
      }
      if (!shipZone) wrap(ship);
    } else if (confineShip) {
      var z = activeZone();
      if (z.wrapX) {
        if (ship.x < z.x0) ship.x = z.x1;
        if (ship.x > z.x1) ship.x = z.x0;
      } else {
        if (ship.x < z.x0) { ship.x = z.x0; ship.vx = Math.abs(ship.vx) * 0.6 + 6; }
        if (ship.x > z.x1) { ship.x = z.x1; ship.vx = -Math.abs(ship.vx) * 0.6 - 6; }
      }
      if (ship.y < z.y0) { ship.y = z.y0; ship.vy = Math.abs(ship.vy) * 0.6 + 6; }
      if (ship.y > z.y1) { ship.y = z.y1; ship.vy = -Math.abs(ship.vy) * 0.6 - 6; }
    } else {
      wrap(ship);
    }

    ship.cooldown -= dt;
    if (ship.cooldown <= 0 && rocks.length) {
      ship.cooldown = 0.6 + Math.random() * 0.55;
      fire(215);
    }
    stepWorld(dt);
  }

  /* One decisive shot, timed to land on the cluster before the ship reaches
     it. The bullet's speed is derived from the distance and the time left, so
     the hit happens on schedule at any viewport size rather than by luck. */
  function introStep() {
    var now = performance.now();
    if (!introFired && now >= introShotAt) {
      introFired = true;
      var dx = clusterX - ship.x, dy = clusterY - ship.y;
      var dist = Math.hypot(dx, dy) || 1;
      var t = Math.max(0.12, (introShatterAt - now) / 1000);
      var sp = dist / t;
      bullets.push({
        x: ship.x + Math.cos(ship.angle) * 15,
        y: ship.y + Math.sin(ship.angle) * 15,
        vx: (dx / dist) * sp, vy: (dy / dist) * sp,
        life: 3, lance: true
      });
    }
    // if the shot somehow slips past, break it apart on cue anyway
    if (clusterLive && introFired && now >= introShatterAt) shatterCluster();
  }

  /* The cluster comes apart into small pieces that scatter outward from its
     centre, opening the field the ship is about to fly through. */
  function shatterCluster() {
    if (!clusterLive) return;
    clusterLive = false;
    var fresh = [];
    for (var i = rocks.length - 1; i >= 0; i--) {
      var r = rocks[i];
      if (!r.cluster) continue;
      burst(r.x, r.y, r.size * (r.core ? 1.8 : 1));
      var pieces = r.core ? 7 : 3;
      for (var pI = 0; pI < pieces; pI++) {
        var a = (pI / pieces) * Math.PI * 2 + Math.random() * 0.7;
        var frag = makeRock(
          r.x + Math.cos(a) * r.size * 0.45,
          r.y + Math.sin(a) * r.size * 0.45,
          Math.max(7, r.size * (r.core ? 0.22 : 0.36))
        );
        var ox = frag.x - clusterX, oy = frag.y - clusterY;
        var od = Math.hypot(ox, oy) || 1;
        var sp2 = 130 + Math.random() * 150;
        frag.vx = (ox / od) * sp2;
        frag.vy = (oy / od) * sp2 * 1.3;   // bias outward vertically
        // fragments are an event, not permanent furniture — let them go
        frag.fade = 7 + Math.random() * 3;
        fresh.push(frag);
      }
      rocks.splice(i, 1);
    }
    for (var f = 0; f < fresh.length; f++) rocks.push(fresh[f]);
  }

  function fire(speed) {
    bullets.push({
      x: ship.x + Math.cos(ship.angle) * 13,
      y: ship.y + Math.sin(ship.angle) * 13,
      vx: Math.cos(ship.angle) * speed + ship.vx,
      vy: Math.sin(ship.angle) * speed + ship.vy,
      life: 1.5
    });
  }

  function stepWorld(dt) {
    for (var i = bullets.length - 1; i >= 0; i--) {
      var b = bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      wrap(b, 4);
      if (b.life <= 0) { bullets.splice(i, 1); continue; }
      for (var j = rocks.length - 1; j >= 0; j--) {
        var r = rocks[j];
        if (Math.hypot(r.x - b.x, r.y - b.y) < r.size) {
          bullets.splice(i, 1);
          if (b.lance && r.cluster) { shatterCluster(); break; }
          burst(r.x, r.y, r.size);
          if (r.size > 14) {
            rocks.push(makeRock(r.x, r.y, r.size * 0.56));
            rocks.push(makeRock(r.x, r.y, r.size * 0.56));
          }
          rocks.splice(j, 1);
          break;
        }
      }
    }

    for (var k = rocks.length - 1; k >= 0; k--) {
      var rk = rocks[k];
      rk.x += rk.vx * dt; rk.y += rk.vy * dt; rk.spin += rk.rot * dt;
      if (rk.fade != null) {
        rk.fade -= dt;
        if (rk.fade <= 0) { rocks.splice(k, 1); continue; }
        rk.vx *= 0.992; rk.vy *= 0.992;
      }
      wrap(rk, rk.size + 8);
    }

    for (var m = debris.length - 1; m >= 0; m--) {
      var d = debris[m];
      d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt;
      d.vx *= 0.985; d.vy *= 0.985;
      if (d.life <= 0) debris.splice(m, 1);
    }

    if (rocks.length < targetRockCount() && Math.random() < 0.02) spawnRockAtEdge();
  }

  function burst(x, y, size) {
    var n = 6 + ((size / 6) | 0);
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var s = 24 + Math.random() * 70;
      debris.push({
        x: x, y: y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.4 + Math.random() * 0.4
      });
    }
  }

  /* ---------- draw ---------- */
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // ---- rocks ----
    for (var i = 0; i < rocks.length; i++) {
      var r = rocks[i];
      var fadeMul = r.fade != null ? Math.max(0, Math.min(1, r.fade / 2)) : 1;
      var a = 0.30 * r.glow * fadeMul;
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.spin);

      ctx.beginPath();
      for (var v = 0; v < r.verts.length; v++) {
        var vt = r.verts[v];
        var px = Math.cos(vt.a) * vt.r, py = Math.sin(vt.a) * vt.r;
        if (v === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      // faint interior so rocks read as solid bodies, not wireframe rings
      ctx.fillStyle = "rgba(" + MINT + "," + (0.030 * fadeMul).toFixed(3) + ")";
      ctx.fill();
      ctx.lineWidth = r.size > 22 ? 1.25 : 1;
      ctx.strokeStyle = "rgba(" + MINT + "," + a.toFixed(3) + ")";
      ctx.stroke();

      // ---- crater detail ----
      ctx.strokeStyle = "rgba(" + MINT + "," + (a * 0.5).toFixed(3) + ")";
      ctx.lineWidth = 0.85;
      for (var c = 0; c < r.craters.length; c++) {
        var cr = r.craters[c];
        ctx.beginPath();
        ctx.arc(Math.cos(cr.a) * cr.d, Math.sin(cr.a) * cr.d, cr.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // ---- debris ----
    ctx.lineWidth = 1;
    for (var d = 0; d < debris.length; d++) {
      var db = debris[d];
      ctx.strokeStyle = "rgba(" + MINT + "," + Math.max(0, db.life * 0.85).toFixed(3) + ")";
      ctx.beginPath();
      ctx.moveTo(db.x, db.y);
      ctx.lineTo(db.x - db.vx * 0.03, db.y - db.vy * 0.03);
      ctx.stroke();
    }

    // ---- bullets: glowing tracer ----
    ctx.save();
    ctx.shadowColor = "rgba(" + AMBER + ",0.9)";
    ctx.shadowBlur = 6;
    for (var b = 0; b < bullets.length; b++) {
      var bl = bullets[b];
      ctx.strokeStyle = "rgba(" + AMBER + ",0.95)";
      ctx.lineWidth = bl.lance ? 2.6 : 1.6;
      ctx.beginPath();
      ctx.moveTo(bl.x, bl.y);
      // the intro shot draws a longer tail, so one round still reads as an event
      ctx.lineTo(bl.x - bl.vx * (bl.lance ? 0.03 : 0.016), bl.y - bl.vy * (bl.lance ? 0.03 : 0.016));
      ctx.stroke();
    }
    ctx.restore();

    // ---- ship ----
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.angle);
    ctx.shadowColor = "rgba(" + MINT + ",0.75)";
    ctx.shadowBlur = 8;

    // engine flame, flickering, drawn behind the hull
    if (ship.thrust) {
      var f = 8 + Math.random() * 7;
      ctx.beginPath();
      ctx.moveTo(-7, 4.5);
      ctx.lineTo(-7 - f, 0);
      ctx.lineTo(-7, -4.5);
      ctx.strokeStyle = "rgba(" + AMBER + ",0.85)";
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }

    // hull
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(-9, 8.5);
    ctx.lineTo(-5.5, 0);
    ctx.lineTo(-9, -8.5);
    ctx.closePath();
    ctx.fillStyle = "rgba(8, 12, 10, 0.55)";
    ctx.fill();
    ctx.strokeStyle = "rgba(" + MINT + ",0.95)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // cockpit dot
    ctx.beginPath();
    ctx.arc(2.5, 0, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(" + MINT + ",0.9)";
    ctx.fill();
    ctx.restore();
  }

  /* ---------- loop ---------- */
  var last = performance.now();
  function frame(now) {
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (visible) { update(dt); draw(); }
    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", function () {
    var prevW = W, prevH = H;
    resize();
    // a big change in viewport would leave rocks bunched in the old area
    if (Math.abs(W - prevW) > 200 || Math.abs(H - prevH) > 200) populate();
  }, { passive: true });

  document.addEventListener("visibilitychange", function () {
    visible = !document.hidden;
    last = performance.now();
  });

  resize();
  resetShip();
  populate();
  requestAnimationFrame(frame);

  /* ---- public API, used by the page-load intro ---- */
  window.GPAsteroids = {
    /* Straight pass across the middle of the screen. A cluster of rock waits
       on the far side; the ship fires a single round that breaks it into
       pieces, then flies on through the scattering debris. */
    flyby: function (seconds) {
      seconds = seconds || 1.7;
      confineShip = false;

      clusterY = H * 0.5;
      clusterX = W * 0.79;
      var core = Math.max(34, Math.min(72, Math.min(W, H) * 0.085));

      var big = makeRock(clusterX, clusterY, core);
      big.vx = -7; big.vy = 0; big.rot *= 0.4;
      big.cluster = true; big.core = true;
      rocks.push(big);

      var ring = 4;
      for (var i = 0; i < ring; i++) {
        var a = (i / ring) * Math.PI * 2 + 0.6;
        var d = core * 1.15;
        var r = makeRock(clusterX + Math.cos(a) * d, clusterY + Math.sin(a) * d,
                         core * (0.32 + Math.random() * 0.14));
        r.vx *= 0.12; r.vy *= 0.12;
        r.cluster = true;
        rocks.push(r);
      }
      clusterLive = true;

      ship.x = -30;
      ship.y = clusterY;
      ship.angle = 0;
      ship.vx = (W + 160) / seconds;
      ship.vy = 0;

      var now = performance.now();
      introFired = false;
      introShotAt = now + seconds * 1000 * 0.18;      // fires early in the run
      introShatterAt = now + seconds * 1000 * 0.50;   // well before the ship arrives
      scriptedUntil = now + seconds * 1000;
    },
    // after the intro, keep the ship patrolling its current zone
    confineToTop: function () {
      if (!outsideZone()) { confineShip = true; returningToBand = false; }
      else { returningToBand = true; confineShip = false; }
    },
    /* Park the ship in a rectangle of empty page — passing null sends it back
       to the band across the top. It flies there under its own power. */
    setZone: function (rect) {
      var same = (!rect && !shipZone) ||
        (rect && shipZone && rect.x0 === shipZone.x0 && rect.y0 === shipZone.y0 &&
         rect.x1 === shipZone.x1 && rect.y1 === shipZone.y1);
      if (same) return;
      shipZone = rect || null;
      if (outsideZone()) { returningToBand = true; confineShip = false; }
      else { confineShip = true; returningToBand = false; }
    },
    zone: function () { return shipZone; },
    resize: function () { resize(); },
    // exposed for verification: where the ship currently is
    shipPos: function () { return { x: Math.round(ship.x), y: Math.round(ship.y), band: shipBand(), confined: confineShip }; },
    repopulate: populate,
    debug: function () {
      return { rocks: rocks.length, bullets: bullets.length, debris: debris.length,
               clusterLive: clusterLive, introFired: introFired,
               clusterRocks: rocks.filter(function (r) { return r.cluster; }).length,
               fragments: rocks.filter(function (r) { return r.fade != null; }).length,
               target: targetRockCount() };
    }
  };
})();
