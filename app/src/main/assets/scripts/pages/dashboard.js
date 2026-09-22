/* =========================================================================
 * Mail Factory — Dashboard visual runtime
 * -------------------------------------------------------------------------
 * Warp-style energy streaks, circuit nodes and falling binary digits.
 * Ported VERBATIM from the source (matrix §5: DO-NOT-TOUCH visual system —
 * the randomness here is presentation FX, not business data). The only
 * structural change: the draw loop now lives in this module and exposes
 * onShow() so the router can re-measure the canvas exactly like the
 * source's global resize() call did.
 * ========================================================================= */
(function (global) {
  'use strict';
  var MF = global.MF = global.MF || {};

  var canvas = document.getElementById('fx');
  var ctx = canvas.getContext('2d');
  var w, h, cx, cy;

  function resize() {
    var rect = canvas.parentElement.getBoundingClientRect();
    w = canvas.width = rect.width;
    h = canvas.height = rect.height;
    var logoWrap = document.querySelector('.logo-wrap');
    if (logoWrap) {
      var logoRect = logoWrap.getBoundingClientRect();
      cx = (logoRect.left + logoRect.width / 2) - rect.left;
      cy = (logoRect.top + logoRect.height / 2) - rect.top;
    } else {
      cx = w * 0.5;
      cy = h * 0.42;
    }
  }
  resize();
  window.addEventListener('resize', resize);

  // Warp-style energy streaks: not static radial lines. Each streak is born
  // small and thin near the core, then accelerates outward, growing in
  // length/width/brightness as it travels, leaving a glowing trail behind -
  // like light rays rushing past the camera through 3D depth (hyperspace feel).
  function angularDist(a, b) {
    var d = Math.abs(a - b) % (Math.PI * 2);
    if (d > Math.PI) d = Math.PI * 2 - d;
    return d;
  }
  var UP_ANGLE = 3 * Math.PI / 2; // straight up in canvas coords
  var UP_WINDOW = Math.PI * 0.45;
  function upFactorFor(angle) {
    var dist = angularDist(angle, UP_ANGLE);
    return dist < UP_WINDOW ? (0.25 + 0.75 * (dist / UP_WINDOW)) : 1;
  }

  // Equalizer-style sectors driving asymmetric emphasis around the circle -
  // some directions surge while others recede, then it shifts over time.
  var SECTOR_COUNT = 12;
  var sectors = [];
  for (var si = 0; si < SECTOR_COUNT; si++) {
    sectors.push({
      speed: 0.12 + Math.random() * 0.20,
      phase: Math.random() * Math.PI * 2,
      speed2: 0.04 + Math.random() * 0.08,
      phase2: Math.random() * Math.PI * 2
    });
  }
  function sectorAmp(angle, tt) {
    var a = angle % (Math.PI * 2);
    if (a < 0) a += Math.PI * 2;
    var idx = (a / (Math.PI * 2)) * SECTOR_COUNT;
    var i0 = Math.floor(idx) % SECTOR_COUNT;
    var i1 = (i0 + 1) % SECTOR_COUNT;
    var frac = idx - Math.floor(idx);
    var s0 = sectors[i0], s1 = sectors[i1];
    var fast0 = 0.5 + 0.5 * Math.sin(tt * s0.speed + s0.phase);
    var fast1 = 0.5 + 0.5 * Math.sin(tt * s1.speed + s1.phase);
    var fast = fast0 * (1 - frac) + fast1 * frac;
    var slow0 = 0.5 + 0.5 * Math.sin(tt * s0.speed2 + s0.phase2);
    var slow1 = 0.5 + 0.5 * Math.sin(tt * s1.speed2 + s1.phase2);
    var slow = slow0 * (1 - frac) + slow1 * frac;
    return 0.32 + 0.68 * (fast * 0.55 + slow * 0.45);
  }

  function spawnStreak(initial) {
    return {
      angle: Math.random() * Math.PI * 2,
      z: initial ? Math.random() : (0.02 + Math.random() * 0.05),
      speedMult: 0.6 + Math.random() * 1.1,
      baseWidth: 1.4 + Math.random() * 2.2
    };
  }
  var STREAK_COUNT = 54;
  var streaks = [];
  for (var i = 0; i < STREAK_COUNT; i++) streaks.push(spawnStreak(true));

  // Scattered circuit nodes: drift slowly downward, wrap to top (subtle "moving" field)
  var nodes = [];
  for (var ni = 0; ni < 32; ni++) {
    nodes.push({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 1.2 + Math.random() * 2.6,
      phase: Math.random() * Math.PI * 2,
      pulseSpeed: 0.5 + Math.random() * 0.9,
      fallSpeed: 4 + Math.random() * 9, // px per second, downward drift
      hollow: Math.random() < 0.35
    });
  }

  // Falling binary digits, deep in the background
  var binCols = [];
  var BIN_COL_COUNT = 14;
  for (var bi = 0; bi < BIN_COL_COUNT; bi++) {
    binCols.push({
      x: Math.random() * w,
      y: Math.random() * h - Math.random() * h,
      speed: 60 + Math.random() * 70,
      opacity: 0.16 + Math.random() * 0.18,
      chars: Array.from({ length: 12 + Math.floor(Math.random() * 6) }, function () { return Math.round(Math.random()); }),
      spacing: 18
    });
  }

  var last = performance.now();
  var t = 0;

  function draw(now) {
    // Performance: the hero field only renders while the Dashboard screen is visible.
    if (!document.getElementById('screen-dashboard').classList.contains('active')) {
      last = now;
      requestAnimationFrame(draw);
      return;
    }
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    t += dt;

    ctx.clearRect(0, 0, w, h);

    // warp-style energy streaks bursting from the core toward the edges,
    // growing in length/width/brightness as they travel, with a fading trail
    var maxR = Math.sqrt(w * w + h * h) * 0.6;
    ctx.lineCap = 'round';
    for (var si2 = 0; si2 < streaks.length; si2++) {
      var s = streaks[si2];
      var speed = 0.11 * s.speedMult * (0.35 + 1.8 * s.z);
      s.z += speed * dt;
      if (s.z >= 1) {
        Object.assign(s, spawnStreak(false));
      }

      var sAmp = sectorAmp(s.angle, t);
      var upF = upFactorFor(s.angle);
      var amp = (0.5 + 0.5 * sAmp) * (0.55 + 0.45 * upF); // softened floor so streaks stay visible
      var z = s.z;
      var R = maxR * z;
      var trailFrac = 0.10 + 0.24 * z;
      var R0 = Math.max(0, (z - trailFrac)) * maxR;
      var width = s.baseWidth * (0.3 + 3.0 * z);

      var x1 = cx + Math.cos(s.angle) * R0, y1 = cy + Math.sin(s.angle) * R0;
      var x2 = cx + Math.cos(s.angle) * R, y2 = cy + Math.sin(s.angle) * R;

      var grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, 'rgba(110,8,8,0)');
      grad.addColorStop(0.55, 'rgba(160,18,15,' + ((0.55 + 0.3 * z) * amp).toFixed(3) + ')');
      grad.addColorStop(1, 'rgba(205,28,20,' + ((0.8 + 0.4 * z) * amp).toFixed(3) + ')');
      ctx.strokeStyle = grad;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // hot leading tip
      ctx.beginPath();
      ctx.fillStyle = 'rgba(220,45,32,' + ((0.6 + 0.35 * z) * amp).toFixed(3) + ')';
      ctx.arc(x2, y2, width * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }

    // scattered independent circuit nodes: slow downward drift + pulse
    for (var k = 0; k < nodes.length; k++) {
      var n = nodes[k];
      n.y += n.fallSpeed * dt;
      if (n.y > h + 6) { n.y = -6; n.x = Math.random() * w; }

      var pulse = 0.35 + 0.65 * Math.abs(Math.sin(t * n.pulseSpeed + n.phase));
      ctx.shadowColor = 'rgba(255,34,34,0.8)';
      ctx.shadowBlur = 2.5 * pulse;
      if (n.hollow) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255,80,80,' + (0.5 * pulse).toFixed(3) + ')';
        ctx.lineWidth = 1;
        ctx.arc(n.x, n.y, n.r + 1, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.fillStyle = 'rgba(255,60,60,' + (0.5 * pulse).toFixed(3) + ')';
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }

    // falling binary digits, deep background
    ctx.font = '12px monospace';
    for (var c = 0; c < binCols.length; c++) {
      var col = binCols[c];
      col.y += col.speed * dt;
      if (col.y > h + col.chars.length * col.spacing) {
        col.y = -col.chars.length * col.spacing;
        col.x = Math.random() * w;
      }
      col.chars.forEach(function (digit, idx) {
        var py = col.y + idx * col.spacing;
        if (py < -20 || py > h + 20) return;
        ctx.fillStyle = 'rgba(255,60,60,' + col.opacity + ')';
        ctx.fillText(digit, col.x, py);
      });
    }

    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  MF.dashboard = {
    /** Called by the router when the Dashboard becomes active (source parity). */
    onShow: function () { try { resize(); } catch (_) {} }
  };
})(window);
