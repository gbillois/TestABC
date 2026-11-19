'use strict';
/* ------------------------------------------------------------------
   AO // CHARACTER REVEAL — core: constants, math, drawing + FX helpers
   Everything is a pure function of the frame number (24 fps), so any
   frame can be rendered on demand (scrubbing now, MP4 export later).
------------------------------------------------------------------- */
const W = 1920, H = 1080, FPS = 24, TOTAL = 360;

const PAL = {
  ice: '#a9e2ff',
  cobalt: '#0b3bff',
  white: '#ffffff',
  silver: '#b9c1cc',
  black: '#06070b',
};

const FONT_D = "'Anton','Impact','Haettenschweiler','Arial Narrow Bold','Arial Black',sans-serif";
const FONT_M = "'JetBrains Mono',ui-monospace,'SF Mono',Menlo,Consolas,'DejaVu Sans Mono',monospace";

/* ---------- math ---------- */
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const map = (x, a, b) => clamp((x - a) / (b - a));
const eOut = t => 1 - Math.pow(1 - t, 3);
const eIn = t => t * t * t;
const eIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eExpo = t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const eBack = t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const D2R = Math.PI / 180;
function rnd(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
const rr = (n, a, b) => a + (b - a) * rnd(n);
const pick = (n, arr) => arr[Math.floor(rnd(n) * arr.length) % arr.length];

/* hard "slam" scale curve: t = frames since the hit */
const PUNCH = [1.85, 0.93, 1.04, 1];
const punch = t => (t < 0 ? 0 : t < PUNCH.length ? PUNCH[t] : 1);

/* ---------- scratch buffers for post FX ---------- */
function mkBuf() { const c = document.createElement('canvas'); c.width = W; c.height = H; return c.getContext('2d'); }
const BUF_A = mkBuf(), BUF_B = mkBuf(), BUF_T = mkBuf();

/* ---------- basic drawing ---------- */
function bg(g, col) { g.fillStyle = col; g.fillRect(-500, -500, W + 1000, H + 1000); }

function T(g, s, x, y, size, o = {}) {
  g.save();
  g.font = `${o.weight || (o.mono ? 700 : 400)} ${size}px ${o.mono ? FONT_M : FONT_D}`;
  g.textAlign = o.align || 'left';
  g.textBaseline = o.base || 'alphabetic';
  if ('letterSpacing' in g) g.letterSpacing = (o.ls || 0) + 'px';
  if (o.stroke) {
    g.lineWidth = o.lw || 4; g.strokeStyle = o.stroke; g.lineJoin = 'miter'; g.miterLimit = 3;
    g.strokeText(s, x, y);
  }
  if (o.fill !== null) { g.fillStyle = o.fill || PAL.black; g.fillText(s, x, y); }
  g.restore();
}
function textW(g, s, size, o = {}) {
  g.save();
  g.font = `${o.weight || (o.mono ? 700 : 400)} ${size}px ${o.mono ? FONT_M : FONT_D}`;
  if ('letterSpacing' in g) g.letterSpacing = (o.ls || 0) + 'px';
  const w = g.measureText(s).width; g.restore(); return w;
}
/* font size that makes `s` exactly `width` px wide */
function fitSize(g, s, width) { return 200 * width / textW(g, s, 200); }
/* cap height (px) of the display font at a given size */
let _capRatio = null;
function capH(g, size) {
  if (_capRatio == null) {
    g.save(); g.font = `400 200px ${FONT_D}`; g.textBaseline = 'alphabetic';
    const m = g.measureText('H'); _capRatio = (m.actualBoundingBoxAscent || 146) / 200; g.restore();
  }
  return _capRatio * size;
}

/* ---------- logo glyphs (custom geometric A and O) ---------- */
function logoA(g, x, base, h, col) {
  const w = 0.94 * h, P = (u, v) => [x + u * w, base - h + v * h];
  g.beginPath();
  [[0, 1], [0.34, 0], [0.66, 0], [1, 1], [0.70, 1], [0.645, 0.78], [0.355, 0.78], [0.30, 1]]
    .forEach((p, i) => { const q = P(p[0], p[1]); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); });
  g.closePath();
  [[0.5, 0.20], [0.5925, 0.57], [0.4075, 0.57]]
    .forEach((p, i) => { const q = P(p[0], p[1]); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); });
  g.closePath();
  g.fillStyle = col; g.fill('evenodd');
}
const O_HOLE = 0.56;
function logoO(g, cx, cy, R, col) {
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.closePath();
  g.moveTo(cx + R * O_HOLE, cy); g.arc(cx, cy, R * O_HOLE, 0, Math.PI * 2, true); g.closePath();
  g.fillStyle = col; g.fill('evenodd');
}
/* lockup geometry: centred on cx, sitting on `base`, cap height h */
function lockup(cx, base, h) {
  const total = 2.04 * h, left = cx - total / 2;
  return { ax: left, base, h, ox: left + 1.52 * h, oy: base - h / 2, R: 0.52 * h, left, right: left + total };
}

/* ---------- graphic furniture ---------- */
function barcode(g, x, y, w, h, seed, col, unit = 2) {
  g.fillStyle = col; let cx = x, i = 0;
  while (cx < x + w) {
    const bw = pick(seed + i * 1.37, [1, 1, 2, 3, 1, 4]) * unit;
    if (i % 2 === 0) g.fillRect(cx, y, Math.min(bw, x + w - cx), h);
    cx += bw; i++;
  }
}
function vbarcode(g, x, y, w, h, seed, col, unit = 2) {
  g.fillStyle = col; let cy = y, i = 0;
  while (cy < y + h) {
    const bh = pick(seed + i * 1.37, [1, 1, 2, 3, 1, 4]) * unit;
    if (i % 2 === 0) g.fillRect(x, cy, w, Math.min(bh, y + h - cy));
    cy += bh; i++;
  }
}
function ruler(g, x, y, len, step, col, vert = false, major = 5, s = 10) {
  g.fillStyle = col;
  for (let i = 0, p = 0; p <= len; i++, p += step) {
    const L = i % major === 0 ? s * 2 : s;
    if (vert) g.fillRect(x, y + p, L, 2); else g.fillRect(x + p, y, 2, L);
  }
}
function cross(g, x, y, s, col, lw = 2) {
  g.fillStyle = col; g.fillRect(x - s, y - lw / 2, s * 2, lw); g.fillRect(x - lw / 2, y - s, lw, s * 2);
}
function brackets(g, x, y, w, h, len, col, lw = 4) {
  g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'butt'; g.lineJoin = 'miter';
  const c = [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]];
  for (const [px, py, sx, sy] of c) {
    g.beginPath(); g.moveTo(px + sx * len, py); g.lineTo(px, py); g.lineTo(px, py + sy * len); g.stroke();
  }
}
function slash(g, x1, y1, x2, y2, th, col) {
  const a = Math.atan2(y2 - y1, x2 - x1), nx = -Math.sin(a) * th / 2, ny = Math.cos(a) * th / 2;
  g.beginPath(); g.moveTo(x1 + nx, y1 + ny); g.lineTo(x2 + nx, y2 + ny); g.lineTo(x2 - nx, y2 - ny); g.lineTo(x1 - nx, y1 - ny);
  g.closePath(); g.fillStyle = col; g.fill();
}
function halftone(g, x, y, w, h, sp, fn, col) {
  g.fillStyle = col; g.beginPath();
  let row = 0;
  for (let py = y; py <= y + h; py += sp * 0.866, row++) {
    for (let px = x + (row % 2 ? sp / 2 : 0); px <= x + w; px += sp) {
      const r = fn((px - x) / w, (py - y) / h) * sp * 0.62;
      if (r > 0.6) { g.moveTo(px + r, py); g.arc(px, py, r, 0, 7); }
    }
  }
  g.fill();
}
/* horizontal speed lines streaming through a region */
function speedLines(g, seed, n, x, y, w, h, phase, col, lmin = 120, lmax = 600, th = 6) {
  g.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const L = rr(seed + i * 3.1, lmin, lmax), sp = rr(seed + i * 5.3, 0.6, 1.6);
    const span = w + L;
    let px = (rnd(seed + i * 7.7) * span + phase * sp) % span; if (px < 0) px += span;
    g.fillRect(x + px - L, y + rnd(seed + i * 9.9) * h, L, rr(seed + i * 2.2, th * 0.3, th));
  }
}
/* radial speed lines (snap zooms) */
function radialLines(g, cx, cy, seed, n, r0, r1, col) {
  g.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const a = rnd(seed + i * 1.9) * Math.PI * 2, wd = rr(seed + i * 4.1, 0.004, 0.03);
    const ra = r0 * rr(seed + i * 6.3, 0.75, 1.5);
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * ra, cy + Math.sin(a) * ra);
    g.lineTo(cx + Math.cos(a - wd) * r1, cy + Math.sin(a - wd) * r1);
    g.lineTo(cx + Math.cos(a + wd) * r1, cy + Math.sin(a + wd) * r1);
    g.closePath(); g.fill();
  }
}
/* text set around a circle, tops pointing outwards */
function ringText(g, str, cx, cy, r, size, rot, o = {}) {
  g.save();
  g.font = `400 ${size}px ${FONT_D}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  const gap = o.gap || 0;
  let total = 0; const ws = [];
  for (const ch of str) { const w = g.measureText(ch).width + gap; ws.push(w); total += w; }
  const k = (Math.PI * 2 * r) / total; // stretch so the string closes the loop exactly
  let a = rot;
  [...str].forEach((ch, i) => {
    const half = ws[i] * k / 2 / r; a += half;
    const sc = o.scatter ? o.scatter(i) : null;
    const rad = r + (sc ? sc.d : 0);
    g.save();
    g.translate(cx + Math.cos(a - Math.PI / 2) * rad, cy + Math.sin(a - Math.PI / 2) * rad);
    g.rotate(a + (sc ? sc.r : 0));
    if (sc && sc.s != null) g.scale(sc.s, sc.s);
    if (o.stroke) { g.lineWidth = o.lw || 4; g.strokeStyle = o.stroke; g.strokeText(ch, 0, 0); }
    if (o.fill) { g.fillStyle = o.fill; g.fillText(ch, 0, 0); }
    g.restore();
    a += half;
  });
  g.restore();
}

/* ---------- shard systems ---------- */
/* radial shards tiling a disc of radius R; t = frames since shatter */
function radialShards(g, cx, cy, R, t, seed, colFn, o = {}) {
  const rings = o.rings || 4, sect = o.sect || 16, speed = o.speed || 60;
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < sect; j++) {
      const id = seed + i * 31 + j * 7.13;
      const a0 = (j + rr(id, -0.25, 0.25)) / sect * Math.PI * 2, a1 = (j + 1 + rr(id + 7.13, -0.25, 0.25)) / sect * Math.PI * 2;
      const r0 = R * i / rings, r1 = R * (i + 1) / rings * (i === rings - 1 ? rr(id + 2, 1, 1.25) : 1);
      const am = (a0 + a1) / 2, rm = (r0 + r1) / 2;
      const pts = i === 0
        ? [[0, 0], [Math.cos(a0) * r1, Math.sin(a0) * r1], [Math.cos(a1) * r1, Math.sin(a1) * r1]]
        : (rnd(id + 4) > 0.5
          ? [[Math.cos(a0) * r0, Math.sin(a0) * r0], [Math.cos(a0) * r1, Math.sin(a0) * r1], [Math.cos(a1) * r1, Math.sin(a1) * r1], [Math.cos(a1) * r0, Math.sin(a1) * r0]]
          : [[Math.cos(a0) * r0, Math.sin(a0) * r0], [Math.cos(am) * r1, Math.sin(am) * r1], [Math.cos(a1) * r0, Math.sin(a1) * r0]]);
      const mx = Math.cos(am) * rm, my = Math.sin(am) * rm;
      const v = speed * rr(id + 5, 0.5, 1.6) * (0.5 + i / rings);
      const d = v * Math.pow(t, 1.25);
      const rot = rr(id + 6, -0.5, 0.5) * t, sc = Math.max(0, 1 - t * rr(id + 8, 0.02, 0.07));
      g.save();
      g.translate(cx + mx + Math.cos(am) * d, cy + my + Math.sin(am) * d + (o.grav || 0) * t * t);
      g.rotate(rot); g.scale(sc, sc);
      g.beginPath(); pts.forEach((p, n) => (n ? g.lineTo(p[0] - mx, p[1] - my) : g.moveTo(p[0] - mx, p[1] - my))); g.closePath();
      g.fillStyle = colFn(i, j, id); g.fill();
      g.restore();
    }
  }
}
/* full-frame pane broken into jittered triangles that blow outwards from (ox,oy) */
function paneShards(g, t, seed, ox, oy, colFn, draw /* optional (g)=>content, clipped per shard */) {
  const nx = 8, ny = 5, cw = W / nx, ch = H / ny;
  const P = (i, j) => {
    const e = i === 0 || j === 0 || i === nx || j === ny;
    return [i * cw + (e ? 0 : rr(seed + i * 13.1 + j * 71.7, -0.33, 0.33) * cw), j * ch + (e ? 0 : rr(seed + i * 17.9 + j * 37.3, -0.33, 0.33) * ch)];
  };
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
    const tris = rnd(seed + i * 3.3 + j * 9.1) > 0.5 ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
    tris.forEach((tri, n) => {
      const id = seed + i * 5.71 + j * 11.3 + n * 0.37;
      const mx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, my = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
      let dx = mx - ox, dy = my - oy; const dist = Math.hypot(dx, dy) || 1; dx /= dist; dy /= dist;
      const delay = dist / 900;              // the crack travels outwards
      const tt = Math.max(0, t - delay);
      const v = rr(id + 1, 70, 190), mv = v * Math.pow(tt, 1.3);
      const sc = Math.max(0, (tt > 0 ? 0.96 : 1) - tt * rr(id + 2, 0.05, 0.12));
      if (sc <= 0) return;
      g.save();
      g.translate(mx + dx * mv, my + dy * mv + 6 * tt * tt);
      g.rotate(rr(id + 3, -0.35, 0.35) * tt); g.scale(sc, sc); g.translate(-mx, -my);
      g.beginPath(); g.moveTo(tri[0][0], tri[0][1]); g.lineTo(tri[1][0], tri[1][1]); g.lineTo(tri[2][0], tri[2][1]); g.closePath();
      if (draw) { g.save(); g.clip(); draw(g); g.restore(); }
      else { g.fillStyle = colFn(id); g.fill(); }
      g.restore();
    });
  }
}

/* ---------- camera + post FX ---------- */
function shake(g, k, k0, amp, dur = 5) {
  const t = k - k0; if (t < 0 || t >= dur) return;
  const a = amp * Math.pow(1 - t / dur, 1.5);
  g.translate(W / 2, H / 2);
  g.rotate((rnd(k * 5.7 + k0) - 0.5) * a * 0.0007);
  g.translate(-W / 2 + (rnd(k * 7.3 + k0) - 0.5) * 2 * a, -H / 2 + (rnd(k * 3.1 + k0 + 9) - 0.5) * 2 * a);
}
function zoomAt(g, x, y, s, tx = x, ty = y) { g.translate(tx, ty); g.scale(s, s); g.translate(-x, -y); }
function flash(g, k, k0, col = '#fff', a0 = 0.92) {
  const t = k - k0; if (t < 0 || t > 1) return;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = t === 0 ? a0 : a0 * 0.3; g.fillStyle = col; g.fillRect(0, 0, W, H); g.restore();
}
function invert(g) {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'difference'; g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.restore();
}
function rgbSplit(g, d) {
  BUF_A.setTransform(1, 0, 0, 1, 0, 0); BUF_A.globalCompositeOperation = 'copy'; BUF_A.drawImage(g.canvas, 0, 0, W, H);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'lighter';
  const ad = Math.abs(d);
  for (const [col, dx, dy] of [['#ff0000', -d, d * 0.25], ['#00ff00', 0, 0], ['#0000ff', d, -d * 0.25]]) {
    BUF_B.setTransform(1, 0, 0, 1, 0, 0); BUF_B.globalCompositeOperation = 'copy';
    BUF_B.drawImage(BUF_A.canvas, dx - ad, dy - ad * 0.3, W + 2 * ad, H + ad * 0.6);
    BUF_B.globalCompositeOperation = 'multiply'; BUF_B.fillStyle = col; BUF_B.fillRect(0, 0, W, H);
    g.drawImage(BUF_B.canvas, 0, 0);
  }
  g.restore();
}
/* directional smear for whip-pans */
function smearX(g, dx, n = 10) {
  BUF_A.setTransform(1, 0, 0, 1, 0, 0); BUF_A.globalCompositeOperation = 'copy'; BUF_A.drawImage(g.canvas, 0, 0, W, H);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  for (let i = 1; i <= n; i++) { g.globalAlpha = 1 / (i + 1); g.drawImage(BUF_A.canvas, (i / n) * dx, 0); }
  g.restore();
}
/* tiny mono label */
function label(g, s, x, y, col, size = 18, align = 'left') { T(g, s, x, y, size, { mono: true, fill: col, align, ls: 2 }); }
