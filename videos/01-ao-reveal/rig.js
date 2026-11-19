/* AO — character rig + shared graphic helpers.
 * Everything is drawn procedurally on a 1920x1080 canvas so every frame is deterministic.
 * Character angles use screen convention: 0 = forward (+x), 90 = down, -90 = up. */
(function (G) {
  'use strict';

  const W = 1920, H = 1080, FPS = 24;

  // ---- Palette (ice blue, cobalt, white, silver-grey, black) + character colours ----
  const C = {
    ice: '#8fd8ff', ice2: '#d4f1ff', iceD: '#5bb6ec',
    cobalt: '#1e3ff2', cobaltD: '#1630b8', cobaltL: '#3d5cff',
    white: '#ffffff', paper: '#f6f7f9',
    silver: '#b8c1cc', silverL: '#dde3ea', silverD: '#7d8794',
    black: '#07080c', ink: '#0b1020',
    hair: '#1f6bff', hairD: '#1240b8', hairL: '#6aa8ff',
    skin: '#ffe7dc', skinS: '#f3c3b1', skinD: '#e2a693',
    lblue: '#a9dcff', lblueD: '#79b9ee',
    iris: '#6fd0ff', irisD: '#1a54d8',
  };

  const FONT_BIG = '"Anton", Impact, "Arial Narrow", sans-serif';
  const FONT_WIDE = '"Archivo Black", "Arial Black", sans-serif';
  const FONT_MONO = '"Space Mono", "Courier New", monospace';

  // ---- math ----
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, u) => a + (b - a) * u;
  const k = (f, a, b) => clamp((f - a) / (b - a));
  const rad = d => d * Math.PI / 180;
  const E = {
    outExpo: u => (u >= 1 ? 1 : 1 - Math.pow(2, -10 * u)),
    outCubic: u => 1 - Math.pow(1 - u, 3),
    inCubic: u => u * u * u,
    inOut: u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
    outBack: (u, s = 2.2) => 1 + (s + 1) * Math.pow(u - 1, 3) + s * Math.pow(u - 1, 2),
  };
  const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  function rng(a) { // mulberry32
    a = a | 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /** decaying camera shake that starts at frame f0 */
  function impact(f, f0, amp, dur = 6) {
    if (f < f0 || f >= f0 + dur) return [0, 0];
    const d = 1 - (f - f0) / dur, a = amp * d * d;
    return [(rnd(f * 3.1 + f0) - 0.5) * 2 * a, (rnd(f * 7.7 + f0 + 50) - 0.5) * 2 * a];
  }
  function shakeSum(f, list) {
    let x = 0, y = 0;
    for (const [f0, amp, dur] of list) { const s = impact(f, f0, amp, dur); x += s[0]; y += s[1]; }
    return [x, y];
  }

  // ---- text ----
  function txt(ctx, s, x, y, size, o = {}) {
    const { font = FONT_BIG, color = C.black, align = 'center', base = 'alphabetic', stroke = null,
      lw = 0, track = 0, sx = 1, sy = 1, rot = 0, alpha = 1 } = o;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.scale(sx, sy);
    ctx.font = `${size}px ${font}`;
    ctx.textAlign = align;
    ctx.textBaseline = base;
    if ('letterSpacing' in ctx) ctx.letterSpacing = track + 'px';
    if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.lineJoin = 'round'; ctx.strokeText(s, 0, 0); }
    if (color) { ctx.fillStyle = color; ctx.fillText(s, 0, 0); }
    ctx.restore();
  }
  /** text centred on its cap height; sx/sy/rot apply around that centre */
  function txtC(ctx, s, x, y, size, o = {}) {
    const m = measure(ctx, s, size, o.font || FONT_BIG, o.track || 0);
    const off = (m.asc - m.desc) / 2;
    ctx.save();
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale(o.sx || 1, o.sy || 1);
    txt(ctx, s, 0, off, size, Object.assign({}, o, { sx: 1, sy: 1, rot: 0 }));
    ctx.restore();
  }
  function measure(ctx, s, size, font = FONT_BIG, track = 0) {
    ctx.save();
    ctx.font = `${size}px ${font}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = track + 'px';
    const m = ctx.measureText(s);
    ctx.restore();
    return { w: m.width, asc: m.actualBoundingBoxAscent, desc: m.actualBoundingBoxDescent, l: m.actualBoundingBoxLeft, r: m.actualBoundingBoxRight };
  }

  // ---- graphic primitives ----
  function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
  function circle(ctx, x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2); ctx.fill(); }
  function ring(ctx, x, y, r, lw, c) { ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2); ctx.stroke(); }
  function poly(ctx, pts, c) { ctx.fillStyle = c; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill(); }
  /** a slanted band (parallelogram) between two points */
  function band(ctx, x1, y1, x2, y2, w, c) {
    const a = Math.atan2(y2 - y1, x2 - x1), nx = -Math.sin(a) * w / 2, ny = Math.cos(a) * w / 2;
    poly(ctx, [[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]], c);
  }

  function barcode(ctx, x, y, w, h, seed, color = C.black, label = null) {
    const r = rng(seed), u = w / 95;
    ctx.fillStyle = color;
    let cx = x;
    while (cx < x + w) {
      const bw = u * (r() < 0.5 ? 1 : r() < 0.6 ? 2 : 3.5);
      if (cx + bw > x + w) break;
      ctx.fillRect(cx, y, bw, h);
      cx += bw + u * (r() < 0.65 ? 1 : 2.2);
    }
    if (label) txt(ctx, label, x, y + h + h * 0.12, Math.max(10, h * 0.22), { font: FONT_MONO, color, align: 'left', base: 'top', track: 2 });
  }

  function ticks(ctx, x, y, len, n, o = {}) {
    const { vert = false, color = C.black, h = 14, major = 5, lw = 2 } = o;
    ctx.fillStyle = color;
    for (let i = 0; i <= n; i++) {
      const p = (i / n) * len, hh = i % major === 0 ? h : h * 0.5;
      if (vert) ctx.fillRect(x, y + p, hh, lw); else ctx.fillRect(x + p, y, lw, hh);
    }
  }

  function brackets(ctx, x, y, w, h, len, lw, c) {
    ctx.fillStyle = c;
    const B = (bx, by, sx, sy) => { ctx.fillRect(bx, by, len * sx, lw * sy); ctx.fillRect(bx, by, lw * sx, len * sy); };
    B(x, y, 1, 1); B(x + w, y, -1, 1); B(x, y + h, 1, -1); B(x + w, y + h, -1, -1);
  }

  function halftone(ctx, x, y, w, h, sp, color, fn) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let j = 0; j <= h / sp; j++) {
      for (let i = 0; i <= w / sp + 1; i++) {
        const px = x + i * sp + (j % 2 ? sp / 2 : 0), py = y + j * sp;
        const r = fn((px - x) / w, (py - y) / h) * sp * 0.55;
        if (r > 0.4) { ctx.moveTo(px + r, py); ctx.arc(px, py, r, 0, Math.PI * 2); }
      }
    }
    ctx.fill();
  }

  function speedLines(ctx, f, seed, o = {}) {
    const { x = 0, y = 0, w = W, h = H, count = 40, color = C.white, len = [200, 700], thick = [2, 8], alpha = 1 } = o;
    const r = rng(seed + f * 131);
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = color;
    for (let i = 0; i < count; i++) {
      const ly = y + r() * h, L = lerp(len[0], len[1], r()), lx = x - L + r() * (w + L), th = lerp(thick[0], thick[1], r());
      ctx.fillRect(lx, ly, L, th);
    }
    ctx.restore();
  }

  function zoomLines(ctx, cx, cy, f, seed, o = {}) {
    const { count = 70, inner = 320, outer = 1500, color = C.white, width = [3, 22], alpha = 1 } = o;
    const r = rng(seed + f * 31);
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const a = r() * Math.PI * 2, ri = inner + r() * 260, wd = lerp(width[0], width[1], r()) / outer;
      ctx.moveTo(cx + Math.cos(a) * ri, cy + Math.sin(a) * ri);
      ctx.lineTo(cx + Math.cos(a + wd) * outer, cy + Math.sin(a + wd) * outer);
      ctx.lineTo(cx + Math.cos(a - wd) * outer, cy + Math.sin(a - wd) * outer);
      ctx.closePath();
    }
    ctx.fill();
    ctx.restore();
  }

  // ---- shards (flat-colour shatter) ----
  function makeShards(seed, cx, cy, R, sectors, rings, colors) {
    const r = rng(seed), angs = [];
    let a = r() * 0.5;
    const step = (Math.PI * 2) / sectors;
    while (a < Math.PI * 2 - step * 0.4) { angs.push(a); a += step * (0.6 + r() * 0.8); }
    const radii = [0];
    for (let i = 1; i < rings; i++) radii.push(R * (i / rings) * (0.85 + r() * 0.3));
    radii.push(R);
    const P = (ang, rr) => [cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr];
    const shards = [];
    for (let i = 0; i < angs.length; i++) {
      const a0 = angs[i], a1 = i + 1 < angs.length ? angs[i + 1] : angs[0] + Math.PI * 2;
      for (let j = 0; j < rings; j++) {
        const r0 = radii[j], r1 = radii[j + 1];
        let pts;
        if (j === 0) pts = [[cx, cy]]; else pts = [P(a0, r0)];
        const sub = j === rings - 1 ? 4 : 1;
        for (let s = 0; s <= sub; s++) pts.push(P(lerp(a0, a1, s / sub), r1));
        if (j > 0) pts.push(P(a1, r0));
        shards.push(finishShard(pts, cx, cy, r, colors));
      }
    }
    return shards;
  }
  function makeRectShards(seed, x, y, w, h, cols, rows, colors, ox, oy) {
    const r = rng(seed), g = [];
    for (let j = 0; j <= rows; j++) {
      g.push([]);
      for (let i = 0; i <= cols; i++) {
        const edgeX = i === 0 || i === cols, edgeY = j === 0 || j === rows;
        g[j].push([x + (i / cols) * w + (edgeX ? 0 : (r() - 0.5) * (w / cols) * 0.7), y + (j / rows) * h + (edgeY ? 0 : (r() - 0.5) * (h / rows) * 0.7)]);
      }
    }
    const shards = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const a = g[j][i], b = g[j][i + 1], c = g[j + 1][i + 1], d = g[j + 1][i];
      if (r() < 0.5) { shards.push(finishShard([a, b, c], ox, oy, r, colors)); shards.push(finishShard([a, c, d], ox, oy, r, colors)); }
      else { shards.push(finishShard([a, b, d], ox, oy, r, colors)); shards.push(finishShard([b, c, d], ox, oy, r, colors)); }
    }
    return shards;
  }
  function finishShard(pts, cx, cy, r, colors) {
    let mx = 0, my = 0;
    pts.forEach(p => { mx += p[0]; my += p[1]; });
    mx /= pts.length; my /= pts.length;
    let dx = mx - cx, dy = my - cy;
    const d = Math.hypot(dx, dy) || 1;
    dx = dx / d + (r() - 0.5) * 0.5; dy = dy / d + (r() - 0.5) * 0.5;
    return {
      pts: pts.map(p => [p[0] - mx, p[1] - my]), x: mx, y: my, dx, dy, dist: d,
      speed: 500 + r() * 1100, rot: (r() - 0.5) * 9, color: colors[Math.floor(r() * colors.length)], z: r(),
    };
  }
  function drawShards(ctx, shards, u, o = {}) {
    const { gravity = 0, grow = 0, fade = 0, colorOverride = null } = o;
    for (const s of shards) {
      const e = E.outCubic(u);
      const x = s.x + s.dx * s.speed * e, y = s.y + s.dy * s.speed * e + gravity * u * u;
      const sc = 1 + grow * u * (0.5 + s.z);
      ctx.save();
      ctx.globalAlpha *= 1 - fade * u;
      ctx.translate(x, y);
      ctx.rotate(s.rot * e);
      ctx.scale(sc, sc);
      poly(ctx, s.pts, colorOverride || s.color);
      ctx.restore();
    }
  }

  /** draw `fn` into an offscreen buffer and composite it smeared along x (whip-pan blur) */
  const buffers = {};
  function buffer(name) {
    if (!buffers[name]) {
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      buffers[name] = cv;
    }
    const b = buffers[name], bc = b.getContext('2d');
    bc.setTransform(1, 0, 0, 1, 0, 0);
    bc.globalAlpha = 1;
    bc.globalCompositeOperation = 'source-over';
    bc.clearRect(0, 0, W, H);
    return [b, bc];
  }
  function smear(ctx, fn, dx, dy, n = 8) {
    const [b, bc] = buffer('smear');
    fn(bc);
    ctx.save();
    for (let i = 0; i < n; i++) {
      ctx.globalAlpha = 1 / (i + 1);
      ctx.drawImage(b, (dx * i) / (n - 1), (dy * i) / (n - 1));
    }
    ctx.restore();
  }
  /** chromatic RGB split of whatever `fn` draws */
  function rgbSplit(ctx, fn, off) {
    const [b, bc] = buffer('rgbsrc');
    fn(bc);
    const [t, tc] = buffer('rgbtmp');
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const chans = [['#ff0000', -off, 0], ['#00ff00', 0, off * 0.3], ['#0000ff', off, 0]];
    for (const [col, ox, oy] of chans) {
      tc.globalCompositeOperation = 'source-over';
      tc.clearRect(0, 0, W, H);
      tc.drawImage(b, 0, 0);
      tc.globalCompositeOperation = 'multiply';
      tc.fillStyle = col;
      tc.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(t, ox, oy);
    }
    ctx.restore();
  }
  function flash(ctx, a, c = '#fff') { if (a <= 0) return; ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = c; ctx.fillRect(-W, -H, W * 3, H * 3); ctx.restore(); }
  function invert(ctx) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'difference'; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.restore(); }

  // =====================================================================
  //  CHARACTER RIG — AO
  // =====================================================================
  const SEG = { torso: 2.05, neck: 0.22, th: 1.75, sh: 1.7, ua: 1.25, fa: 1.15 };
  const V = a => [Math.cos(rad(a)), Math.sin(rad(a))];
  const add = (p, v, s = 1) => [p[0] + v[0] * s, p[1] + v[1] * s];

  // t torso, h head tilt (rel), ua* upper arm (abs), fa* forearm (rel), th* thigh (abs), sh* shin (rel, + = knee bend), ft* foot (rel)
  const POSES = {
    stand:   { t: -90, h: 0, uaB: 96, faB: -8, uaF: 84, faF: -10, thB: 93, shB: 0, ftB: -90, thF: 87, shF: 0, ftF: -90 },
    pockets: { t: -91, h: -3, uaB: 103, faB: -62, uaF: 99, faF: -66, thB: 96, shB: 2, ftB: -92, thF: 83, shF: 5, ftF: -95 },
    runA:    { t: -70, h: 10, uaB: 30, faB: -85, uaF: 150, faF: -70, thB: 135, shB: 75, ftB: -70, thF: 30, shF: 75, ftF: -85 },
    runB:    { t: -70, h: 10, uaB: 150, faB: -70, uaF: 30, faF: -85, thB: 30, shB: 75, ftB: -85, thF: 135, shF: 75, ftF: -70 },
    slide:   { t: -118, h: 18, uaB: 172, faB: -15, uaF: 25, faF: -35, thB: 78, shB: 100, ftB: -95, thF: 12, shF: 0, ftF: -75 },
    knee:    { t: -114, h: -12, uaB: 158, faB: -10, uaF: 140, faF: -25, thB: 62, shB: 113, ftB: -5, thF: 50, shF: 126, ftF: -5 },
    takeoff: { t: -66, h: 5, uaB: -25, faB: -20, uaF: -55, faF: -10, thB: 122, shB: 18, ftB: -40, thF: 5, shF: 100, ftF: -90 },
    tuck:    { t: -78, h: 22, uaB: 40, faB: -65, uaF: 28, faF: -70, thB: -12, shB: 150, ftB: -60, thF: -25, shF: 155, ftF: -60 },
    land:    { t: -55, h: -18, uaB: 150, faB: -10, uaF: 78, faF: -2, thB: 62, shB: 112, ftB: -80, thF: -12, shF: 122, ftF: -110 },
    spin:    { t: -92, h: -6, uaB: -150, faB: -12, uaF: -25, faF: -15, thB: 112, shB: 45, ftB: -60, thF: 58, shF: 70, ftF: -80 },
    vaultIn: { t: -25, h: -55, uaB: 150, faB: -20, uaF: 92, faF: 0, thB: 150, shB: 20, ftB: -80, thF: 125, shF: 35, ftF: -80 },
    vault:   { t: -18, h: -62, uaB: 175, faB: -25, uaF: 95, faF: 0, thB: 8, shB: 6, ftB: -85, thF: -8, shF: 0, ftF: -90 },
    vaultOut:{ t: -55, h: -25, uaB: 190, faB: -30, uaF: 120, faF: -20, thB: 55, shB: 40, ftB: -90, thF: 35, shF: 30, ftF: -95 },
    hang:    { t: -80, h: -12, uaB: -135, faB: -30, uaF: 18, faF: -45, thB: 132, shB: 62, ftB: -70, thF: 22, shF: 112, ftF: -90 },
    dive:    { t: -90, h: 30, uaB: -160, faB: 0, uaF: -145, faF: -5, thB: 100, shB: 25, ftB: -60, thF: 84, shF: 35, ftF: -70 },
    open:    { t: -95, h: -25, uaB: -165, faB: -5, uaF: -140, faF: -10, thB: 98, shB: 8, ftB: -80, thF: 80, shF: 15, ftF: -85 },
    hero:    { t: -88, h: -4, uaB: 103, faB: -62, uaF: 99, faF: -66, thB: 100, shB: 0, ftB: -92, thF: 78, shF: 6, ftF: -95 },
  };
  const KEYS = Object.keys(POSES.stand);
  function mix(a, b, u) { const o = {}; for (const kk of KEYS) o[kk] = lerp(a[kk], b[kk], u); return o; }
  function runPose(phase) { return mix(POSES.runA, POSES.runB, 0.5 + 0.5 * Math.sin(phase)); }

  function fk(p) {
    const P = [0, 0], tv = V(p.t), nv = V(p.t + 90);
    const N = add(P, tv, SEG.torso), S = add(P, tv, SEG.torso * 0.86);
    const ha = p.t + p.h, Hc = add(N, V(ha), SEG.neck + 0.5);
    const leg = (th, sh, ft, off) => {
      const hip = add(P, nv, off), K = add(hip, V(th), SEG.th), sa = th + sh, A = add(K, V(sa), SEG.sh);
      return { hip, K, A, sa, fa: sa + ft };
    };
    const arm = (ua, fa, off) => {
      const Sh = add(S, nv, off), El = add(Sh, V(ua), SEG.ua), wa = ua + fa, Wr = add(El, V(wa), SEG.fa);
      return { S: Sh, E: El, W: Wr, wa, ua };
    };
    return { P, N, S, Hc, ha, tv, nv, lB: leg(p.thB, p.shB, p.ftB, -0.1), lF: leg(p.thF, p.shF, p.ftF, 0.1), aB: arm(p.uaB, p.faB, -0.05), aF: arm(p.uaF, p.faF, 0.08) };
  }
  /** how far below the pelvis the lowest sole reaches (units), for standing on a floor */
  function footDepth(p) {
    const J = fk(p);
    const sole = l => l.A[1] + 0.42;
    return Math.max(sole(J.lB), sole(J.lF));
  }
  /** world position of a joint for a figure drawn with drawAO(x,y,s,p,o) */
  function jointWorld(x, y, s, p, o, pick) {
    const J = fk(p), pt = pick(J), R = rad(o.R || 0), dir = o.dir || 1;
    const rx = pt[0] * Math.cos(R) - pt[1] * Math.sin(R), ry = pt[0] * Math.sin(R) + pt[1] * Math.cos(R);
    return [x + rx * s * dir * (o.sx || 1), y + ry * s];
  }

  function drawSneaker(ctx, mono, back) {
    // local: origin at ankle, +x toe direction, +y down. chunky white & blue platform
    const OL = mono ? null : C.ink;
    const col = c => mono || c;
    const shape = (fn, fill, olw = 0.07) => {
      ctx.beginPath(); fn();
      if (OL) { ctx.lineWidth = olw * 2; ctx.strokeStyle = OL; ctx.stroke(); }
      ctx.fillStyle = col(fill); ctx.fill();
    };
    // sole (thick platform)
    shape(() => ctx.roundRect(-0.36, 0.1, 1.08, 0.34, 0.12), back ? C.silverL : C.white);
    if (!mono) {
      ctx.fillStyle = C.cobalt; ctx.fillRect(-0.32, 0.24, 1.0, 0.06);
      ctx.fillStyle = C.silver; ctx.fillRect(-0.3, 0.37, 0.98, 0.05);
    }
    // upper
    shape(() => {
      ctx.moveTo(-0.34, 0.12); ctx.lineTo(-0.3, -0.26); ctx.quadraticCurveTo(-0.1, -0.34, 0.08, -0.2);
      ctx.quadraticCurveTo(0.42, -0.08, 0.68, 0.04); ctx.quadraticCurveTo(0.74, 0.12, 0.66, 0.14); ctx.closePath();
    }, back ? C.silverL : C.white);
    if (!mono) {
      // blue overlay panels + collar
      ctx.fillStyle = C.cobalt;
      ctx.beginPath(); ctx.moveTo(-0.3, -0.26); ctx.quadraticCurveTo(-0.1, -0.34, 0.08, -0.2); ctx.lineTo(0.02, -0.1); ctx.quadraticCurveTo(-0.12, -0.2, -0.28, -0.12); ctx.closePath(); ctx.fill();
      ctx.fillStyle = C.lblueD;
      ctx.beginPath(); ctx.moveTo(-0.1, 0.1); ctx.quadraticCurveTo(0.15, -0.12, 0.5, 0.0); ctx.lineTo(0.42, 0.08); ctx.quadraticCurveTo(0.15, -0.02, 0.02, 0.1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = C.cobalt; ctx.beginPath(); ctx.ellipse(0.6, 0.08, 0.08, 0.05, 0, 0, 7); ctx.fill();
    }
  }

  /**
   * drawAO(ctx, x, y, s, pose, o)
   *  x,y  pelvis position (px) · s px per unit (standing ≈ 7.3 units tall)
   *  o.dir 1/-1 facing · o.R body rotation (deg) · o.mono flat silhouette colour
   *  o.flare jacket flare 0..1 · o.time seconds (cloth sway) · o.sx horizontal squash (spins)
   *  o.blink 0..1 · o.look eye offset
   */
  function drawAO(ctx, x, y, s, p, o = {}) {
    const dir = o.dir || 1, R = o.R || 0, mono = o.mono || null, tm = o.time || 0, flare = o.flare == null ? 0.3 : o.flare;
    const OL = mono ? null : C.ink, OLW = 0.075;
    const col = c => mono || c;
    const J = fk(p);
    ctx.save();
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    ctx.translate(x, y);
    ctx.scale(dir * s * (o.sx || 1), s);
    ctx.rotate(rad(R));
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    const line = (a, b) => { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); };
    const chain = (segs, color) => { // segs: [[a,b,w],...]  outline pass then fill pass (seamless joints)
      if (OL) { ctx.strokeStyle = OL; for (const [a, b, w] of segs) { ctx.lineWidth = w + OLW * 2; line(a, b); } }
      ctx.strokeStyle = col(color); for (const [a, b, w] of segs) { ctx.lineWidth = w; line(a, b); }
    };
    const shape = (pts, fill, ol = true) => {
      ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath();
      if (OL && ol) { ctx.lineWidth = OLW * 2; ctx.strokeStyle = OL; ctx.stroke(); }
      ctx.fillStyle = col(fill); ctx.fill();
    };
    const sneaker = (l, back) => { ctx.save(); ctx.translate(l.A[0], l.A[1]); ctx.rotate(rad(l.fa)); ctx.scale(1.12, 1.12); drawSneaker(ctx, mono, back); ctx.restore(); };
    const handPt = a => add(a.W, V(a.wa), 0.1);
    const armDraw = (a, back) => {
      const hp = handPt(a);
      // hand first (sleeve cuff overlaps it)
      if (OL) { ctx.fillStyle = OL; ctx.beginPath(); ctx.arc(hp[0], hp[1], 0.17 + OLW, 0, 7); ctx.fill(); }
      ctx.fillStyle = col(back ? C.skinS : C.skin); ctx.beginPath(); ctx.arc(hp[0], hp[1], 0.17, 0, 7); ctx.fill();
      chain([[a.S, a.E, 0.56], [a.E, a.W, 0.5]], back ? C.silverL : C.white);
      if (!mono) {
        // cuff band
        ctx.strokeStyle = back ? C.silver : C.silverL; ctx.lineWidth = 0.5; ctx.lineCap = 'butt';
        line(add(a.W, V(a.wa), -0.14), a.W); ctx.lineCap = 'round';
        if (!back) {
          // blue utility pocket on the left sleeve
          const m = add(a.S, V(a.ua), SEG.ua * 0.55), u = V(a.ua), n = V(a.ua + 90);
          const q = (du, dn) => [m[0] + u[0] * du + n[0] * dn, m[1] + u[1] * du + n[1] * dn];
          shape([q(-0.24, -0.2), q(0.24, -0.2), q(0.24, 0.2), q(-0.24, 0.2)], C.cobalt);
          ctx.strokeStyle = C.lblue; ctx.lineWidth = 0.04; line(q(-0.1, -0.2), q(-0.1, 0.2));
        }
      }
    };
    const legDraw = (l, back) => {
      chain([[l.hip, l.K, 0.5], [l.K, l.A, 0.38]], back ? C.skinS : C.skin);
      sneaker(l, back);
    };
    const shortsLeg = (l, back) => {
      const e = add(l.hip, V(fkAng(l)), SEG.th * 0.42);
      chain([[l.hip, e, 0.72]], back ? C.lblueD : C.lblue);
      if (!back && !mono) { // barcode tag at the hem
        const t = add(l.hip, V(fkAng(l)), SEG.th * 0.36), n = V(fkAng(l) + 90);
        ctx.save(); ctx.translate(t[0] + n[0] * 0.18, t[1] + n[1] * 0.18); ctx.rotate(rad(fkAng(l) - 90));
        ctx.fillStyle = C.white; ctx.fillRect(-0.11, -0.07, 0.22, 0.15);
        ctx.fillStyle = C.black; for (let i = 0; i < 6; i++) ctx.fillRect(-0.09 + i * 0.033, -0.05, i % 2 ? 0.012 : 0.02, 0.1);
        ctx.restore();
      }
    };
    function fkAng(l) { return Math.atan2(l.K[1] - l.hip[1], l.K[0] - l.hip[0]) * 180 / Math.PI; }

    const { P, N, S, tv, nv } = J;
    const T = (u, n) => [P[0] + tv[0] * u + nv[0] * n, P[1] + tv[1] * u + nv[1] * n];
    const sway = Math.sin(tm * 9) * 0.06;

    // 1 back arm, back leg
    armDraw(J.aB, true);
    legDraw(J.lB, true);
    shortsLeg(J.lB, true);
    // 2 hood bunched behind the neck
    {
      const hc = T(SEG.torso * 0.93, -0.38);
      if (OL) { ctx.fillStyle = OL; ctx.beginPath(); ctx.ellipse(hc[0], hc[1], 0.42 + OLW, 0.3 + OLW, rad(p.t + 90), 0, 7); ctx.fill(); }
      ctx.fillStyle = col(C.silverL); ctx.beginPath(); ctx.ellipse(hc[0], hc[1], 0.42, 0.3, rad(p.t + 90), 0, 7); ctx.fill();
    }
    // 3 front leg
    legDraw(J.lF, false);
    // 4 shorts body + front shorts leg
    shape([T(0.46, -0.45), T(0.46, 0.42), T(-0.12, 0.5), T(-0.2, -0.5)], C.lblue);
    shortsLeg(J.lF, false);
    if (!mono) { // drawstring
      ctx.strokeStyle = C.white; ctx.lineWidth = 0.035;
      const d0 = T(0.4, 0.36); line(d0, add(d0, [sway, 1], 0.3));
    }
    // 5 oversized windbreaker body, with crop top + midriff showing through the open front
    const fl = flare;
    shape([T(1.92, -0.6), T(1.95, 0.3), T(1.35, 0.34), T(0.5, 0.32 + fl * 0.12), T(0.4, -0.66 - fl * 0.6), T(1.3, -0.72)], C.white);
    shape([T(1.42, 0.28), T(1.42, 0.48), T(0.86, 0.48), T(0.86, 0.28)], C.paper);
    shape([T(0.86, 0.28), T(0.86, 0.46), T(0.5, 0.44), T(0.5, 0.28)], C.skin);
    shape([T(1.95, 0.28), T(1.4, 0.58), T(0.58, 0.62 + fl * 0.32), T(0.5, 0.48), T(1.3, 0.46), T(1.86, 0.24)], C.white);
    if (!mono) {
      ctx.strokeStyle = C.silver; ctx.lineWidth = 0.05;
      line(T(1.7, -0.3), T(0.55, -0.4 - fl * 0.35)); // fold
      ctx.strokeStyle = C.silverD; ctx.lineWidth = 0.035;
      line(T(1.9, 0.27), T(0.55, 0.5 + fl * 0.1)); // zip edge
      // hem band
      ctx.strokeStyle = C.silverL; ctx.lineWidth = 0.09; line(T(0.52, -0.1), T(0.44, -0.6 - fl * 0.55));
      // blue drawstrings from the hood
      ctx.strokeStyle = C.cobalt; ctx.lineWidth = 0.055;
      const d1 = T(SEG.torso * 0.86, 0.3), d2 = T(SEG.torso * 0.84, 0.18);
      const s1 = [sway + fl * 0.2 + Math.cos(rad(p.t)) * 0, 1];
      line(d1, add(d1, [nv[0] * 0.1 - tv[0] * 0.75 + s1[0] * 0.2, nv[1] * 0.1 - tv[1] * 0.75]));
      line(d2, add(d2, [-tv[0] * 0.62 + sway * 0.2, -tv[1] * 0.62]));
      ctx.fillStyle = C.cobaltD;
      const e1 = add(d1, [nv[0] * 0.1 - tv[0] * 0.75 + s1[0] * 0.2, nv[1] * 0.1 - tv[1] * 0.75]);
      ctx.beginPath(); ctx.arc(e1[0], e1[1], 0.06, 0, 7); ctx.fill();
    }
    // 7 neck + head
    {
      const nb = add(N, V(J.ha), 0.05);
      chain([[add(N, tv, -0.15), nb, 0.3]], C.skinS);
      ctx.save();
      ctx.translate(J.Hc[0], J.Hc[1]);
      ctx.rotate(rad(J.ha + 90));
      drawHead(ctx, mono, o, tm);
      ctx.restore();
    }
    // 8 front arm
    armDraw(J.aF, false);
    ctx.restore();
  }

  /** 3/4 head facing +x, unit ≈ head radius 0.5, origin at head centre, up = -y */
  function drawHead(ctx, mono, o, tm) {
    const OL = mono ? null : C.ink, OLW = 0.06;
    const col = c => mono || c;
    const path = (cmds, fill, ol = true) => {
      ctx.beginPath(); cmds();
      if (OL && ol) { ctx.lineWidth = OLW * 2; ctx.strokeStyle = OL; ctx.stroke(); }
      ctx.fillStyle = col(fill); ctx.fill();
    };
    const w = Math.sin(tm * 11) * 0.025;
    // back hair mass (chin-length bob)
    path(() => {
      ctx.moveTo(0.2, -0.55); ctx.bezierCurveTo(-0.45, -0.7, -0.78, -0.3, -0.7, 0.15);
      ctx.lineTo(-0.66 + w, 0.62); ctx.lineTo(-0.5, 0.52); ctx.lineTo(-0.38 + w, 0.68); ctx.lineTo(-0.22, 0.56); ctx.lineTo(-0.05 + w, 0.7);
      ctx.lineTo(0.1, 0.4); ctx.lineTo(0.2, -0.2); ctx.closePath();
    }, C.hairD);
    // face
    path(() => {
      ctx.moveTo(0.0, -0.4); ctx.lineTo(0.48, -0.3); ctx.quadraticCurveTo(0.58, -0.05, 0.57, 0.08);
      ctx.lineTo(0.64, 0.2); ctx.lineTo(0.57, 0.26); ctx.quadraticCurveTo(0.56, 0.36, 0.5, 0.4);
      ctx.quadraticCurveTo(0.44, 0.55, 0.32, 0.58); ctx.quadraticCurveTo(0.12, 0.54, -0.02, 0.4); ctx.lineTo(-0.1, 0.0); ctx.closePath();
    }, C.skin);
    if (!mono) {
      // eyes
      const blink = o.blink || 0, lk = o.look || [0, 0];
      const eye = (ex, ey, sxe) => {
        ctx.save(); ctx.translate(ex, ey); ctx.scale(sxe, 1 - blink * 0.92);
        ctx.fillStyle = C.white; ctx.beginPath(); ctx.ellipse(0, 0, 0.1, 0.085, 0, 0, 7); ctx.fill();
        ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, 0.1, 0.085, 0, 0, 7); ctx.clip();
        ctx.fillStyle = C.irisD; ctx.beginPath(); ctx.ellipse(0.02 + lk[0] * 0.03, 0.005 + lk[1] * 0.03, 0.065, 0.085, 0, 0, 7); ctx.fill();
        ctx.fillStyle = C.iris; ctx.beginPath(); ctx.ellipse(0.022 + lk[0] * 0.03, 0.02 + lk[1] * 0.03, 0.05, 0.06, 0, 0, 7); ctx.fill();
        ctx.fillStyle = C.ink; ctx.beginPath(); ctx.ellipse(0.025 + lk[0] * 0.03, 0.01 + lk[1] * 0.03, 0.022, 0.032, 0, 0, 7); ctx.fill();
        ctx.fillStyle = C.white; ctx.beginPath(); ctx.arc(0.0 + lk[0] * 0.03, -0.025, 0.017, 0, 7); ctx.fill();
        ctx.restore();
        ctx.strokeStyle = C.ink; ctx.lineWidth = 0.035; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-0.11, -0.03); ctx.quadraticCurveTo(0.0, -0.11, 0.12, -0.06); ctx.stroke();
        ctx.restore();
      };
      eye(0.3, 0.08, 1);
      eye(0.535, 0.075, 0.45);
      // nose + mouth
      ctx.strokeStyle = C.skinD; ctx.lineWidth = 0.025;
      ctx.beginPath(); ctx.moveTo(0.6, 0.19); ctx.lineTo(0.575, 0.24); ctx.stroke();
      ctx.strokeStyle = C.ink; ctx.lineWidth = 0.022;
      ctx.beginPath(); ctx.moveTo(0.42, 0.41); ctx.quadraticCurveTo(0.47, 0.415, 0.52, 0.385); ctx.stroke();
    }
    // near side lock (frames the face, covers the ear)
    path(() => {
      ctx.moveTo(-0.2, -0.4); ctx.quadraticCurveTo(0.12, -0.25, 0.14, 0.05); ctx.lineTo(0.15 + w, 0.62);
      ctx.lineTo(0.05, 0.5); ctx.lineTo(-0.05 + w, 0.64); ctx.lineTo(-0.14, 0.45); ctx.lineTo(-0.3, 0.1); ctx.closePath();
    }, C.hair);
    // messy bangs
    path(() => {
      ctx.moveTo(-0.45, -0.45); ctx.bezierCurveTo(-0.2, -0.75, 0.45, -0.7, 0.66, -0.3);
      ctx.lineTo(0.6, -0.02); ctx.lineTo(0.5, -0.16); ctx.lineTo(0.42, 0.02 + w); ctx.lineTo(0.34, -0.14);
      ctx.lineTo(0.24, -0.02); ctx.lineTo(0.17, -0.2); ctx.lineTo(0.05, -0.05 + w); ctx.lineTo(-0.02, -0.25); ctx.lineTo(-0.2, -0.18); ctx.closePath();
    }, C.hair);
    if (!mono) {
      ctx.strokeStyle = C.hairL; ctx.lineWidth = 0.035; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-0.15, -0.5); ctx.quadraticCurveTo(0.15, -0.58, 0.4, -0.45); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0.02, 0.05); ctx.lineTo(0.06, 0.35); ctx.stroke();
    }
    // light-blue knit beanie
    path(() => {
      ctx.moveTo(-0.66, -0.3); ctx.bezierCurveTo(-0.66, -1.02, 0.5, -1.08, 0.66, -0.4); ctx.lineTo(0.64, -0.36); ctx.lineTo(-0.64, -0.24); ctx.closePath();
    }, C.lblue);
    path(() => { ctx.moveTo(-0.7, -0.22); ctx.lineTo(0.7, -0.33); ctx.lineTo(0.66, -0.5); ctx.lineTo(-0.66, -0.42); ctx.closePath(); }, C.lblueD);
    if (!mono) {
      ctx.strokeStyle = C.lblue; ctx.lineWidth = 0.03;
      for (let i = 0; i < 9; i++) { const xx = -0.6 + i * 0.15; ctx.beginPath(); ctx.moveTo(xx, -0.24 - i * 0.012); ctx.lineTo(xx + 0.01, -0.42 - i * 0.012); ctx.stroke(); }
      ctx.strokeStyle = C.lblueD; ctx.lineWidth = 0.025;
      ctx.beginPath(); ctx.moveTo(-0.2, -0.82); ctx.quadraticCurveTo(-0.3, -0.6, -0.32, -0.46); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0.15, -0.84); ctx.quadraticCurveTo(0.12, -0.62, 0.12, -0.5); ctx.stroke();
    }
  }

  /** frontal face close-up; u = half head width in px */
  function drawFaceCU(ctx, cx, cy, u, o = {}) {
    const lk = o.look || [0, 0], blink = o.blink || 0, tm = o.time || 0, OL = C.ink;
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(u, u);
    if (o.rot) ctx.rotate(o.rot);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const P = (fn, fill, olw = 0.025) => { ctx.beginPath(); fn(); ctx.lineWidth = olw * 2; ctx.strokeStyle = OL; ctx.stroke(); ctx.fillStyle = fill; ctx.fill(); };
    const w = Math.sin(tm * 10) * 0.02;
    // jacket collar + hood
    P(() => { ctx.moveTo(-2.4, 2.6); ctx.lineTo(-1.6, 1.25); ctx.quadraticCurveTo(-0.9, 0.95, -0.35, 1.35); ctx.lineTo(0.35, 1.35); ctx.quadraticCurveTo(0.9, 0.95, 1.6, 1.25); ctx.lineTo(2.4, 2.6); ctx.closePath(); }, C.white);
    P(() => { ctx.moveTo(-0.42, 1.3); ctx.lineTo(0.42, 1.3); ctx.lineTo(0.5, 2.6); ctx.lineTo(-0.5, 2.6); ctx.closePath(); }, C.paper);
    // neck
    P(() => { ctx.moveTo(-0.32, 0.7); ctx.lineTo(0.32, 0.7); ctx.lineTo(0.36, 1.35); ctx.quadraticCurveTo(0, 1.5, -0.36, 1.35); ctx.closePath(); }, C.skinS);
    // collar sides (zip-up stand collar)
    P(() => { ctx.moveTo(-1.5, 1.3); ctx.quadraticCurveTo(-0.9, 0.8, -0.45, 1.2); ctx.lineTo(-0.5, 1.9); ctx.lineTo(-1.6, 2.0); ctx.closePath(); }, C.white);
    P(() => { ctx.moveTo(1.5, 1.3); ctx.quadraticCurveTo(0.9, 0.8, 0.45, 1.2); ctx.lineTo(0.5, 1.9); ctx.lineTo(1.6, 2.0); ctx.closePath(); }, C.white);
    ctx.strokeStyle = C.cobalt; ctx.lineWidth = 0.06;
    ctx.beginPath(); ctx.moveTo(-0.55, 1.3); ctx.quadraticCurveTo(-0.6 + w, 1.9, -0.52, 2.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0.55, 1.3); ctx.quadraticCurveTo(0.6 - w, 1.9, 0.52, 2.3); ctx.stroke();
    // back hair
    P(() => {
      ctx.moveTo(-1.1, -0.5); ctx.bezierCurveTo(-1.25, 0.2, -1.2, 0.6, -1.15, 1.0); ctx.lineTo(-0.9, 0.86); ctx.lineTo(-0.78 + w, 1.06);
      ctx.lineTo(0.78 - w, 1.06); ctx.lineTo(0.9, 0.86); ctx.lineTo(1.15, 1.0); ctx.bezierCurveTo(1.2, 0.6, 1.25, 0.2, 1.1, -0.5); ctx.closePath();
    }, C.hairD);
    // face
    P(() => { ctx.moveTo(-0.84, -0.3); ctx.quadraticCurveTo(-0.86, 0.45, -0.55, 0.75); ctx.quadraticCurveTo(-0.2, 1.02, 0, 1.04); ctx.quadraticCurveTo(0.2, 1.02, 0.55, 0.75); ctx.quadraticCurveTo(0.86, 0.45, 0.84, -0.3); ctx.closePath(); }, C.skin);
    // shadow under bangs
    ctx.fillStyle = 'rgba(31,63,242,0.12)';
    ctx.beginPath(); ctx.moveTo(-0.84, -0.1); ctx.quadraticCurveTo(0, 0.12, 0.84, -0.1); ctx.lineTo(0.84, -0.3); ctx.lineTo(-0.84, -0.3); ctx.fill();
    // eyes
    const eye = (ex, side) => {
      ctx.save(); ctx.translate(ex, 0.18); ctx.scale(side, 1);
      ctx.save(); ctx.scale(1, 1 - blink * 0.95);
      ctx.beginPath(); ctx.moveTo(-0.2, 0.02); ctx.quadraticCurveTo(0.0, -0.17, 0.22, -0.07); ctx.quadraticCurveTo(0.22, 0.12, 0.05, 0.15); ctx.quadraticCurveTo(-0.15, 0.14, -0.2, 0.02); ctx.closePath();
      ctx.fillStyle = C.white; ctx.fill();
      ctx.save(); ctx.clip();
      const ix = 0.01 + lk[0] * 0.06 * side, iy = 0.0 + lk[1] * 0.06;
      const g = ctx.createRadialGradient(ix, iy + 0.04, 0.01, ix, iy, 0.16);
      g.addColorStop(0, C.ice2); g.addColorStop(0.45, C.iris); g.addColorStop(1, C.irisD);
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(ix, iy, 0.12, 0.155, 0, 0, 7); ctx.fill();
      ctx.fillStyle = C.ink; ctx.beginPath(); ctx.ellipse(ix, iy, 0.045, 0.075, 0, 0, 7); ctx.fill();
      ctx.fillStyle = C.white; ctx.beginPath(); ctx.arc(ix - 0.05 * side, iy - 0.06, 0.035, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(ix + 0.05 * side, iy + 0.06, 0.016, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(11,16,32,0.25)'; ctx.fillRect(-0.3, -0.2, 0.6, 0.07);
      ctx.restore();
      ctx.restore();
      // lashes
      ctx.strokeStyle = C.ink; ctx.lineWidth = 0.055;
      ctx.beginPath(); ctx.moveTo(-0.22, 0.03 - blink * 0.0); ctx.quadraticCurveTo(0.0, -0.18 + blink * 0.18, 0.25, -0.08 + blink * 0.12); ctx.lineTo(0.3, -0.12 + blink * 0.12); ctx.stroke();
      ctx.lineWidth = 0.018; ctx.beginPath(); ctx.moveTo(-0.08, 0.15); ctx.quadraticCurveTo(0.06, 0.16, 0.16, 0.1); ctx.stroke();
      // brow (thin, mostly under bangs)
      ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(-0.15, -0.3); ctx.quadraticCurveTo(0.05, -0.36, 0.25, -0.3); ctx.stroke();
      ctx.restore();
    };
    eye(-0.4, -1); eye(0.4, 1);
    // nose + mouth (confident smirk)
    ctx.strokeStyle = C.skinD; ctx.lineWidth = 0.03;
    ctx.beginPath(); ctx.moveTo(0.02, 0.44); ctx.lineTo(-0.02, 0.5); ctx.stroke();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 0.03;
    const sm = o.smirk == null ? 1 : o.smirk;
    ctx.beginPath(); ctx.moveTo(-0.13, 0.7); ctx.quadraticCurveTo(0.02, 0.72, 0.15, 0.66 - sm * 0.04); ctx.stroke();
    // side locks
    P(() => { ctx.moveTo(-1.08, -0.5); ctx.quadraticCurveTo(-0.7, -0.2, -0.68, 0.3); ctx.lineTo(-0.66 + w, 0.98); ctx.lineTo(-0.8, 0.84); ctx.lineTo(-0.95, 1.02); ctx.lineTo(-1.15, 0.7); ctx.closePath(); }, C.hair);
    P(() => { ctx.moveTo(1.08, -0.5); ctx.quadraticCurveTo(0.7, -0.2, 0.68, 0.3); ctx.lineTo(0.66 - w, 0.98); ctx.lineTo(0.8, 0.84); ctx.lineTo(0.95, 1.02); ctx.lineTo(1.15, 0.7); ctx.closePath(); }, C.hair);
    // messy bangs
    P(() => {
      ctx.moveTo(-1.12, -0.42); ctx.bezierCurveTo(-1.1, -1.2, 1.1, -1.2, 1.12, -0.42);
      const tips = [[0.95, 0.05], [0.82, -0.2], [0.66, 0.1 + w], [0.52, -0.18], [0.36, 0.02], [0.22, -0.22], [0.08, 0.06 + w], [-0.06, -0.2], [-0.2, 0.04], [-0.34, -0.2], [-0.5, 0.08 - w], [-0.64, -0.16], [-0.8, 0.02], [-0.95, -0.2]];
      tips.forEach(t => ctx.lineTo(t[0], t[1]));
      ctx.closePath();
    }, C.hair);
    ctx.strokeStyle = C.hairL; ctx.lineWidth = 0.04;
    ctx.beginPath(); ctx.moveTo(-0.7, -0.7); ctx.quadraticCurveTo(-0.2, -0.86, 0.35, -0.78); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-0.5, -0.5); ctx.lineTo(-0.42, -0.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0.4, -0.5); ctx.lineTo(0.5, -0.24); ctx.stroke();
    // beanie
    P(() => { ctx.moveTo(-1.14, -0.62); ctx.bezierCurveTo(-1.15, -1.95, 1.15, -1.95, 1.14, -0.62); ctx.closePath(); }, C.lblue);
    P(() => { ctx.moveTo(-1.2, -0.5); ctx.quadraticCurveTo(0, -0.62, 1.2, -0.5); ctx.lineTo(1.16, -0.86); ctx.quadraticCurveTo(0, -0.98, -1.16, -0.86); ctx.closePath(); }, C.lblueD);
    ctx.strokeStyle = C.lblue; ctx.lineWidth = 0.035;
    for (let i = -7; i <= 7; i++) { const xx = i * 0.155; ctx.beginPath(); ctx.moveTo(xx, -0.58 + Math.abs(xx) * 0.05); ctx.lineTo(xx, -0.88 + Math.abs(xx) * 0.06); ctx.stroke(); }
    ctx.strokeStyle = C.lblueD; ctx.lineWidth = 0.03;
    for (const xx of [-0.6, -0.2, 0.2, 0.6]) { ctx.beginPath(); ctx.moveTo(xx * 0.9, -1.55 + Math.abs(xx) * 0.4); ctx.quadraticCurveTo(xx, -1.2, xx * 1.05, -0.98); ctx.stroke(); }
    ctx.restore();
  }

  /** extreme close-up of one eye; R = eye half-width px; look [x,y] in -1..1 */
  function drawEyeECU(ctx, cx, cy, R, look = [0, 0], blink = 0) {
    ctx.save(); ctx.translate(cx, cy); ctx.scale(R, R);
    // skin + soft lid shading
    ctx.fillStyle = C.skin; ctx.fillRect(-3, -3, 6, 6);
    ctx.fillStyle = C.skinS;
    ctx.beginPath(); ctx.ellipse(0, -0.25, 1.35, 0.7, 0, 0, 7); ctx.fill();
    // brow under hair
    ctx.save(); ctx.scale(1, 1 - blink * 0.94);
    ctx.beginPath(); ctx.moveTo(-1.05, 0.12); ctx.quadraticCurveTo(-0.2, -0.82, 1.05, -0.3); ctx.quadraticCurveTo(0.95, 0.45, 0.2, 0.6); ctx.quadraticCurveTo(-0.7, 0.62, -1.05, 0.12); ctx.closePath();
    ctx.fillStyle = C.white; ctx.fill();
    ctx.save(); ctx.clip();
    const ix = look[0] * 0.3, iy = look[1] * 0.28 + 0.02;
    const g = ctx.createRadialGradient(ix, iy + 0.1, 0.02, ix, iy, 0.62);
    g.addColorStop(0, '#e8f8ff'); g.addColorStop(0.3, C.ice); g.addColorStop(0.7, C.iris); g.addColorStop(1, C.irisD);
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(ix, iy, 0.5, 0.6, 0, 0, 7); ctx.fill();
    // striations
    ctx.strokeStyle = 'rgba(26,84,216,0.45)'; ctx.lineWidth = 0.018;
    for (let i = 0; i < 36; i++) { const a = (i / 36) * Math.PI * 2, r0 = 0.2, r1 = 0.46 + (i % 3) * 0.03; ctx.beginPath(); ctx.moveTo(ix + Math.cos(a) * r0, iy + Math.sin(a) * r0 * 1.15); ctx.lineTo(ix + Math.cos(a) * r1, iy + Math.sin(a) * r1 * 1.15); ctx.stroke(); }
    ctx.strokeStyle = C.irisD; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.ellipse(ix, iy, 0.5, 0.6, 0, 0, 7); ctx.stroke();
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.ellipse(ix, iy, 0.17, 0.24, 0, 0, 7); ctx.fill();
    ctx.fillStyle = C.white; ctx.beginPath(); ctx.ellipse(ix - 0.2, iy - 0.22, 0.12, 0.09, -0.4, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(ix + 0.22, iy + 0.25, 0.05, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(11,16,32,0.3)'; ctx.fillRect(-2, -1, 4, 0.55);
    ctx.restore();
    // upper lash line
    ctx.strokeStyle = C.ink; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = 0.13;
    ctx.beginPath(); ctx.moveTo(-1.08, 0.14); ctx.quadraticCurveTo(-0.2, -0.86, 1.08, -0.3); ctx.lineTo(1.3, -0.48); ctx.stroke();
    ctx.lineWidth = 0.05;
    for (let i = 0; i < 7; i++) { const u = 0.45 + i * 0.08, x0 = lerp(-1.08, 1.08, u), y0 = -0.42 + Math.pow(u - 0.4, 2) * 0.6; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + 0.18, y0 - 0.2 - i * 0.015); ctx.stroke(); }
    ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(-0.6, 0.55); ctx.quadraticCurveTo(0.1, 0.72, 0.85, 0.3); ctx.stroke();
    ctx.restore();
    // eyelid crease
    ctx.strokeStyle = C.skinD; ctx.lineWidth = 0.03;
    ctx.beginPath(); ctx.moveTo(-0.9, -0.35); ctx.quadraticCurveTo(-0.1, -1.05, 1.0, -0.62); ctx.stroke();
    // strands of blue bangs crossing the top
    ctx.fillStyle = C.hair;
    ctx.beginPath(); ctx.moveTo(-3, -3); ctx.lineTo(3, -3); ctx.lineTo(3, -1.1); ctx.lineTo(1.6, -0.95); ctx.lineTo(1.25, -1.3); ctx.lineTo(0.6, -1.05); ctx.lineTo(0.2, -1.5); ctx.lineTo(-0.35, -1.1); ctx.lineTo(-0.9, -1.45); ctx.lineTo(-1.5, -0.8); ctx.lineTo(-3, -1.0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.hairD;
    ctx.beginPath(); ctx.moveTo(-3, -3); ctx.lineTo(3, -3); ctx.lineTo(3, -1.55); ctx.lineTo(1.0, -1.7); ctx.lineTo(-0.4, -1.55); ctx.lineTo(-3, -1.7); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = C.hairL; ctx.lineWidth = 0.04;
    ctx.beginPath(); ctx.moveTo(-1.4, -1.9); ctx.lineTo(-0.95, -1.5); ctx.moveTo(0.4, -1.9); ctx.lineTo(0.62, -1.15); ctx.stroke();
    ctx.restore();
  }

  G.AOKIT = {
    W, H, FPS, C, FONT_BIG, FONT_WIDE, FONT_MONO, clamp, lerp, k, rad, E, rnd, rng, impact, shakeSum,
    txt, txtC, measure, rect, circle, ring, poly, band, barcode, ticks, brackets, halftone, speedLines, zoomLines,
    makeShards, makeRectShards, drawShards, buffer, smear, rgbSplit, flash, invert,
    POSES, mix, runPose, fk, footDepth, jointWorld, drawAO, drawSneaker, drawFaceCU, drawEyeECU,
  };
})(window);
