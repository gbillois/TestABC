'use strict';
/* ------------------------------------------------------------------
   AO // CHARACTER REVEAL — the 13 cuts.
   Each cut is cutNN(g, k) where k = frame index inside the cut.
   Timings follow the brief (decimal seconds snapped to 24 fps frames).
------------------------------------------------------------------- */
const BOUNDS = [0, 24, 48, 74, 96, 122, 144, 168, 192, 216, 242, 266, 312, 360];
const CUT_INFO = [
  { tc: '0.00–1.00', title: 'IMPACT', desc: 'Pure graphics. Cobalt circle slams onto white, two black bars wipe, UI ticks + barcode flicker, A then O punch in with impact shake.' },
  { tc: '1.00–2.00', title: 'PORTHOLE', desc: 'The O becomes a porthole: extreme close-up of her ice-blue eye glancing up. RGB-split flash, then the circle shatters into flat-colour shards.' },
  { tc: '2.00–3.10', title: 'POWER-SLIDE', desc: 'Black frame, enormous white AO. She sprints in from frame left and power-slides along the baseline — speed lines, ice streaks, letter shards as sparks. Whip-pan out.' },
  { tc: '3.10–4.00', title: 'TRIPTYCH', desc: 'Cobalt / white / ice-blue panels. Her silhouette in stroboscopic freeze: takeoff, tuck, landing. Vertical FULL SPEED scrolls behind.' },
  { tc: '4.00–5.10', title: 'NO BRAKES', desc: 'She leaps through a rotating ring of type — NO BRAKES NO LIMITS — mid-air spin in slow motion, letters scatter, snap-zoom on her face.' },
  { tc: '5.10–6.00', title: 'JUMP', desc: 'White editorial card, black JUMP, cobalt slash. She vaults over the word, palm on the J; the word compresses like a spring and rebounds.' },
  { tc: '6.00–7.00', title: 'FLIP', desc: 'Ice-blue field, black diagonal stripe. Back-flip in three tinted stroboscopic ghosts; outlined FLIP rotates 180° in sync.' },
  { tc: '7.00–8.00', title: 'BARRAGE', desc: 'COOL / FAST / CLEAN / BLUE slam in one per beat with shutter flashes while she knee-slides across the foreground, frost bursting from her sneakers.' },
  { tc: '8.00–9.00', title: 'TARGET LOCK', desc: 'Black frame, white wireframe grid tilting in 3D. She runs up it like a wall, kicks off, everything freezes; a cobalt circle stamps a target lock around her.' },
  { tc: '9.00–10.10', title: 'SHUTTERS', desc: 'Freeze releases: she dives toward camera through flat-colour panes that shatter one by one, each revealing a bigger letter. Sneaker wipe.' },
  { tc: '10.10–11.10', title: 'POSTERS', desc: 'Rapid-fire poster montage 01–04: mid-flip, sliding, landing, hands-in-pockets. Hard cuts, a different layout each.' },
  { tc: '11.10–13.00', title: 'HERO', desc: 'She drops in, lands on a cobalt disc and rises into her hands-in-pockets stance; spec call-outs tick on around her outfit. (Brief was cut off here — this cut is my proposal.)' },
  { tc: '13.00–15.00', title: 'LOCKUP', desc: 'End card: AO slams in on black, her face in the O porthole, tagline + barcode, shutter flash back to the opening frame. (Proposed — not in the brief.)' },
];

/* ---------- shared helpers ---------- */
const FEET = ['soleN', 'soleF', 'toeN', 'toeF', 'heelN', 'heelF'];
const LEGS = FEET.concat(['kneeN', 'kneeF', 'ankN', 'ankF']);
function grounded(p, ground, keys = FEET) {
  const J = AO.joints(p); let m = -1e9;
  for (const key of keys) m = Math.max(m, J[key][1]);
  return Object.assign({}, p, { y: (p.y || 0) + ground - m });
}
const pose = (base, extra) => Object.assign({}, base, extra);
function disc(g, x, y, r, col) { g.fillStyle = col; g.beginPath(); g.arc(x, y, Math.max(0, r), 0, 7); g.fill(); }
function ringStroke(g, x, y, r, lw, col) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.arc(x, y, Math.max(0, r), 0, 7); g.stroke(); }
function miniLogo(g, x, y, h, col) { logoA(g, x, y, h, col); logoO(g, x + 1.52 * h, y - h / 2, 0.52 * h, col); }
function tri(g, x, y, r, a, col) {
  g.fillStyle = col; g.beginPath();
  for (let i = 0; i < 3; i++) { const an = a + i * 2.094 + (i === 1 ? 0.4 : 0); g.lineTo(x + Math.cos(an) * r * (i ? 1 : 1.5), y + Math.sin(an) * r); }
  g.closePath(); g.fill();
}
function frost(g, x, y, r, a, fill, stroke) {
  g.save(); g.translate(x, y); g.rotate(a);
  g.beginPath(); g.moveTo(0, -r); g.lineTo(r * 0.28, -r * 0.28); g.lineTo(r, 0); g.lineTo(r * 0.28, r * 0.28); g.lineTo(0, r); g.lineTo(-r * 0.28, r * 0.28); g.lineTo(-r, 0); g.lineTo(-r * 0.28, -r * 0.28); g.closePath();
  g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = 3; g.lineJoin = 'miter'; g.stroke(); }
  g.restore();
}
function callout(g, from, to, title, sub, side, col = PAL.black) {
  g.strokeStyle = col; g.lineWidth = 3; g.lineJoin = 'miter';
  const ex = to[0] + (side > 0 ? -70 : 70);
  g.beginPath(); g.moveTo(from[0], from[1]); g.lineTo(ex, to[1]); g.lineTo(to[0], to[1]); g.stroke();
  disc(g, from[0], from[1], 9, col); disc(g, from[0], from[1], 4, PAL.white);
  const tx = to[0] + side * 14, al = side > 0 ? 'left' : 'right';
  T(g, title, tx, to[1] + 2, 44, { fill: col, align: al });
  label(g, sub, tx, to[1] + 30, PAL.cobalt, 17, al);
  g.fillStyle = col; g.fillRect(side > 0 ? tx : tx - 60, to[1] - 48, 60, 5);
}

/* =================== CUT 01 — IMPACT =================== */
function cut01(g, k) {
  const L = lockup(960, 800, 520);
  g.save();
  shake(g, k, 2, 30, 4); shake(g, k, 12, 30, 4); shake(g, k, 17, 38, 5);
  bg(g, PAL.white);
  const fl = n => rnd(k * 1.7 + n) > 0.34;

  // cobalt circle slams in
  const cs = [3.4, 1.75, 0.9, 1.05, 1][Math.min(k, 4)];
  disc(g, L.ox, L.oy, 430 * cs, PAL.cobalt);
  if (k === 2 || k === 3) ringStroke(g, L.ox, L.oy, 430 + (k - 1) * 90, 10 - k * 2, PAL.black);

  // UI ticks
  if (k >= 1) {
    ruler(g, 60, 56, 520, 20, PAL.black);
    ruler(g, 56, 60, 300, 20, PAL.black, true);
    if (fl(1)) label(g, 'AO-001 // CHARACTER REVEAL', 96, 122, PAL.black);
    if (fl(2)) label(g, 'F' + String(k).padStart(3, '0') + '  24FPS  16:9', 96, 150, PAL.black);
    for (const [x, y] of [[W - 80, 80], [80, H - 80], [W - 80, H - 80]]) if (fl(x + y)) cross(g, x, y, 16, PAL.black, 3);
    if (fl(5)) { g.fillStyle = PAL.black; for (let i = 0; i < 6; i++) g.fillRect(1520 + i * 34, 96, 20, 20 * ((i + k) % 3 === 0 ? 1 : 0.25)); }
  }
  // barcode strip flicker
  if (k >= 3 && fl(3)) {
    const bx = 150 + (k % 3) * 26;
    barcode(g, bx, 900, 330, 84, Math.floor(k / 2), PAL.black, 4);
    label(g, '4 902 0' + (10 + k) + ' 00' + k, bx, 1012, PAL.black, 17);
  }
  // two black bars wipe across
  const b1 = eOut(map(k, 5, 10)), b2 = eOut(map(k, 7, 12));
  g.fillStyle = PAL.black;
  if (k >= 5 && k < 12) g.fillRect(lerp(-W, W * 1.05, b1), 150, W * 0.95, 78);
  if (k >= 7 && k < 14) g.fillRect(lerp(W * 1.05, -W, b2), 836, W * 0.95, 40);

  // A, then O
  const pa = punch(k - 12), po = punch(k - 17);
  if (pa) { g.save(); zoomAt(g, L.ax + 0.47 * L.h, L.oy, pa); logoA(g, L.ax, L.base, L.h, PAL.black); g.restore(); }
  if (po) { g.save(); zoomAt(g, L.ox, L.oy, po); logoO(g, L.ox, L.oy, L.R, PAL.black); g.restore(); }
  if (k === 12) radialLines(g, L.ax + 0.47 * L.h, L.oy, 12, 26, 380, 1500, PAL.black);
  if (k === 17) radialLines(g, L.ox, L.oy, 17, 30, 470, 1700, PAL.black);
  g.restore();
}

/* =================== CUT 02 — PORTHOLE =================== */
function cut02(g, k) {
  const L = lockup(960, 800, 520), hole = L.R * O_HOLE;
  if (k < 18) {
    const e = eExpo(map(k, 0, 4)), z = lerp(1, 2.6, e);
    g.save();
    shake(g, k, 2, 18, 3);
    zoomAt(g, L.ox, L.oy, z, lerp(L.ox, 960, e), lerp(L.oy, 540, e));
    bg(g, PAL.white);
    disc(g, L.ox, L.oy, 430, PAL.cobalt);
    logoA(g, L.ax, L.base, L.h, PAL.black);
    // the eye, inside the O
    g.save(); g.beginPath(); g.arc(L.ox, L.oy, hole + 1, 0, 7); g.clip();
    if (k < 2) { g.fillStyle = PAL.cobalt; g.fillRect(L.ox - hole, L.oy - hole, hole * 2, hole * 2); }
    else {
      const open = k < 7 ? eOut(map(k, 2, 5)) : (k === 7 ? 0.15 : 1);
      const up = eOut(map(k, 10, 13));
      AO.eyeCloseup(g, L.ox, L.oy, hole * 1.02, [lerp(0.05, 0.3, up), lerp(0.2, -0.85, up)], open);
    }
    g.restore();
    logoO(g, L.ox, L.oy, L.R, PAL.black);
    g.restore();
    // UI over the porthole
    if (k >= 4) {
      const r = hole * 2.6;
      g.save(); g.translate(960, 540); g.rotate(k * 0.05);
      g.strokeStyle = PAL.white; g.lineWidth = 3;
      for (let i = 0; i < 72; i++) { const a = i / 72 * Math.PI * 2, L2 = i % 6 === 0 ? 26 : 12; g.beginPath(); g.moveTo(Math.cos(a) * (r + 18), Math.sin(a) * (r + 18)); g.lineTo(Math.cos(a) * (r + 18 + L2), Math.sin(a) * (r + 18 + L2)); g.stroke(); }
      g.restore();
      if (rnd(k * 3.3) > 0.25) {
        label(g, 'IRIS // ICE BLUE', 96, 110, PAL.white, 20);
        label(g, '#A9E2FF  LOCK ' + String(Math.min(100, (k - 3) * 9)).padStart(3, '0') + '%', 96, 140, PAL.white, 20);
      }
      barcode(g, 1580, 930, 250, 70, 9, PAL.white, 3);
      cross(g, 96, 980, 16, PAL.white, 3); cross(g, W - 96, 110, 16, PAL.white, 3);
    }
    flash(g, k, 2, '#fff', 0.85);
    if (k === 16) rgbSplit(g, 46);
    if (k === 17) rgbSplit(g, 18);
    flash(g, k, 16, '#fff', 0.45);
  } else {
    // the circle shatters into shards of flat colour
    const t = k - 17;
    g.save(); shake(g, k, 18, 34, 5);
    bg(g, PAL.black);
    radialShards(g, 960, 540, 1180, t, 20, (i, j, id) =>
      i < 2 ? pick(id, [PAL.ice, PAL.white, PAL.ice, PAL.silver]) : i < 3 ? pick(id, [PAL.white, PAL.cobalt, PAL.silver]) : pick(id, [PAL.cobalt, PAL.cobalt, PAL.ice]),
      { rings: 5, sect: 18, speed: 54 });
    g.restore();
    flash(g, k, 18, '#fff', 0.9);
  }
}

/* =================== CUT 03 — POWER-SLIDE =================== */
function cut03(g, k) {
  const L = lockup(960, 930, 760), ground = L.base, s = 5.2;
  const whip = k >= 21 ? eIn(map(k, 20, 25)) : 0;
  const sx = kk => (kk < 8 ? lerp(-240, 560, kk / 8) : lerp(560, 1640, eOut(map(kk, 8, 21))));
  const mk = kk => {
    const run = pose(AO.run(kk * 1.1 + 0.6), { y: 0 });
    const bl = eOut(map(kk, 7, 10));
    let p = AO.lerpPose(run, AO.P.slide, bl);
    p = pose(p, { x: sx(kk), s, rot: -52 * bl, sway: -0.6 });
    return grounded(p, ground);
  };
  g.save();
  shake(g, k, 0, 32, 4); shake(g, k, 8, 18, 5);
  g.translate(-whip * 3000, 0);
  g.fillStyle = PAL.black; g.fillRect(-600, -500, W + 5000, H + 1000);
  // enormous white AO
  g.save(); zoomAt(g, 960, 550, punch(k) || 1);
  logoA(g, L.ax, L.base, L.h, PAL.white); logoO(g, L.ox, L.oy, L.R, PAL.white);
  g.restore();
  g.fillStyle = PAL.silver; g.fillRect(-600, ground, W + 5000, 5);
  ruler(g, 0, ground + 14, W + 3600, 24, PAL.silver, false, 5, 8);
  label(g, 'BASELINE 000', 60, ground + 70, PAL.silver);
  label(g, 'VEL ' + String(Math.round(Math.abs(sx(k + 1) - sx(k)) * 2.4)).padStart(3, '0') + ' KM/H', 60, 80, PAL.white, 20);
  cross(g, W - 90, 90, 16, PAL.white, 3);
  speedLines(g, 31, 16, -200, 120, W + 3600, 760, k * 260, 'rgba(255,255,255,.22)', 200, 900, 5);
  if (whip > 0) speedLines(g, 77, 40, W, 0, 3400, H, k * 400, PAL.white, 300, 1400, 14);

  // ice-blue streaks trailing her
  const p = mk(k), v = Math.max(20, sx(k) - sx(k - 1));
  const J = AO.joints(p);
  for (let i = 0; i < 12; i++) {
    const len = v * rr(i * 2.3, 2.5, 8), yy = J.pelvis[1] + rr(i * 4.1 + (k % 2), -340, 60);
    g.fillStyle = pick(i * 1.7, [PAL.ice, PAL.ice, PAL.white, PAL.cobalt]);
    g.fillRect(J.pelvis[0] - 40 - len - rr(i, 0, 120), yy, len, rr(i * 5.5, 4, 16));
  }
  // letter shards kicked up like sparks
  for (let b = 8; b <= Math.min(k, 20); b++) {
    const age = k - b; if (age > 7) continue;
    const hx = sx(b) + 42 * s;
    for (let j = 0; j < 6; j++) {
      const id = b * 13.3 + j * 3.7;
      const px = hx + rr(id, -26, 34) * age, py = ground - rr(id + 1, 14, 52) * age + 4.2 * age * age;
      tri(g, px, py, rr(id + 2, 10, 34) * (1 - age / 9), id + age * 0.5, pick(id + 3, [PAL.white, PAL.white, PAL.ice, PAL.cobalt]));
    }
  }
  if (k >= 8 && k < 21) { g.fillStyle = PAL.white; g.fillRect(sx(8) - 60, ground - 6, sx(k) - sx(8) + 200, 4); }
  AO.draw(g, p);
  g.restore();
  if (whip > 0) smearX(g, -whip * 520 - 60, 12);
  flash(g, k, 0, '#fff', 0.6);
}

/* =================== CUT 04 — TRIPTYCH =================== */
function cut04(g, k) {
  bg(g, PAL.black);
  const cols = [PAL.cobalt, PAL.white, PAL.ice], sil = [PAL.white, PAL.black, PAL.cobalt];
  const tone = ['#2f5bff', '#e4e9f0', '#d6f1ff'], hit = [3, 8, 13];
  const names = ['01 — TAKEOFF', '02 — TUCK', '03 — LANDING'];
  const size = 600, tw = textW(g, 'FULL SPEED — ', size), cap = capH(g, size);
  g.save(); shake(g, k, 3, 16, 3); shake(g, k, 8, 16, 3); shake(g, k, 13, 22, 4);
  for (let i = 0; i < 3; i++) {
    const ap = k - i * 2; if (ap < 0) continue;
    const slide = (1 - eExpo(clamp((ap + 1) / 3))) * H * (i % 2 ? 1 : -1);
    const x0 = i * 640, x1 = x0 + 640, sk = 70, gp = 9, cx = x0 + 320;
    const t = k - hit[i], strobe = t === 0 || k === 18 + i;
    g.save(); g.translate(0, slide);
    g.beginPath(); g.moveTo(x0 + sk + gp, -30); g.lineTo(x1 + sk - gp, -30); g.lineTo(x1 - sk - gp, H + 30); g.lineTo(x0 - sk + gp, H + 30); g.closePath(); g.clip();
    g.fillStyle = strobe ? sil[i] : cols[i]; g.fillRect(x0 - 100, -40, 840, H + 80);
    // huge vertical FULL SPEED scrolling behind
    g.save(); g.translate(cx, 540); g.rotate(-Math.PI / 2);
    const off = ((k * 130 * (i % 2 ? -1 : 1) + i * 700) % tw + tw) % tw;
    for (let n = -2; n < 2; n++) T(g, 'FULL SPEED — ', n * tw + off - 300, cap / 2, size, { fill: strobe ? cols[i] : tone[i] });
    g.restore();
    // stroboscopic silhouette
    if (t >= 0) {
      const sc = 6.8 * (t === 0 ? 1.08 : 1);
      let base, echo;
      if (i === 0) { base = pose(AO.P.takeoff, { x: cx - 30, y: 610, s: sc, rot: 14 }); echo = n => pose(base, { y: 610 + n * 100, x: cx - 30 - n * 25 }); }
      else if (i === 1) { base = pose(AO.P.tuck, { x: cx + 20, y: 560, s: sc, rot: -28 }); echo = n => pose(base, { rot: -28 - n * 42, x: cx + 20 - n * 56, y: 560 + n * 36 }); }
      else { base = grounded(pose(AO.P.landing, { x: cx - 10, s: sc, rot: 4 }), 970); echo = n => pose(base, { y: base.y - n * 110, x: cx - 10 - n * 30, rot: 4 - n * 14 }); }
      const c = strobe ? cols[i] : sil[i];
      if (t >= 1) { AO.drawTint(g, echo(2), c, 0.16); AO.drawTint(g, echo(1), c, 0.32); }
      AO.drawTint(g, base, c, 1);
    }
    const lc = strobe ? cols[i] : sil[i];
    label(g, names[i], x0 + 120, 1010, lc, 20);
    ruler(g, x0 + 120, 80, 200, 20, lc);
    barcode(g, x1 - 240, 74, 130, 34, i * 9 + 4, lc, 2);
    g.restore();
  }
  g.restore();
  flash(g, k, 0, '#fff', 0.5);
}

/* =================== CUT 05 — NO BRAKES NO LIMITS =================== */
function cut05(g, k) {
  const FRZ = 16, kk = Math.min(k, FRZ), zk = k - 17;
  const mk = q => {
    const u = q / FRZ, e = eOut(u);
    return pose(AO.lerpPose(AO.P.tuck, AO.P.spin, eIO(map(q, 3, 13))), {
      x: lerp(560, 1000, e), y: lerp(840, 540, e), s: lerp(3.6, 5.6, u), rot: -40 - 328 * e, smirk: 1, flare: 1, sway: -0.5,
    });
  };
  const p = mk(kk), J = AO.joints(p);
  const z = zk < 0 ? 1 : [1.7, 3.3, 4.3][Math.min(zk, 2)] + Math.max(0, zk - 2) * 0.09;
  g.save();
  shake(g, k, 17, 26, 4);
  if (zk >= 0) zoomAt(g, J.head[0], J.head[1], z, 960, 560);
  bg(g, PAL.cobalt);
  // ring of typography
  const ang = 0.4 + 2.2 * eOut(map(k, 0, 30)) + k * 0.012;
  const sc = i => { const t = Math.max(0, k - 9 - (i % 4)); return t ? { d: 15 * Math.pow(t, 1.55) * (0.5 + rnd(i * 3.1)), r: rr(i * 7.7, -0.22, 0.22) * t, s: 1 + t * 0.03 } : null; };
  disc(g, 960, 540, 310, '#0a34e6');
  ringStroke(g, 960, 540, 350, 3, PAL.ice);
  g.save(); g.translate(960, 540); g.rotate(-ang * 0.6); g.strokeStyle = PAL.ice; g.lineWidth = 3;
  for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2, L2 = i % 5 === 0 ? 30 : 14; g.beginPath(); g.moveTo(Math.cos(a) * 360, Math.sin(a) * 360); g.lineTo(Math.cos(a) * (360 + L2), Math.sin(a) * (360 + L2)); g.stroke(); }
  g.restore();
  ringText(g, 'NO LIMITS NO BRAKES ', 960, 540, 860, 300, -ang * 0.55, { stroke: PAL.ice, lw: 5 });
  ringText(g, 'NO BRAKES NO LIMITS ', 960, 540, 420, 196, ang, { fill: PAL.white, scatter: sc });
  // slow-motion echoes of the spin
  if (zk < 0 && k >= 2) { AO.drawTint(g, mk(kk - 2.4), PAL.ice, 0.3); AO.drawTint(g, mk(kk - 1.2), PAL.white, 0.4); }
  AO.draw(g, p);
  g.restore();
  if (zk >= 0) {
    radialLines(g, 960, 560, k, zk < 3 ? 70 : 26, zk < 3 ? 430 : 600, 1700, zk < 3 ? PAL.white : 'rgba(255,255,255,.55)');
    brackets(g, 520, 130, 880, 860, 70, PAL.white, 6);
    label(g, 'AO // LOCKED', 540, 1024, PAL.white, 20);
    label(g, 'ZOOM ×' + z.toFixed(1), 1380, 1024, PAL.white, 20, 'right');
  } else {
    label(g, 'SLOW-MO 240FPS', 96, 110, PAL.white, 20);
    ruler(g, 96, 130, 300, 20, PAL.white);
    barcode(g, 1560, 940, 260, 60, 14, PAL.white, 3);
  }
  flash(g, k, 0, '#fff', 0.5);
  flash(g, k, 17, '#fff', 0.85);
}

/* =================== CUT 06 — JUMP =================== */
function cut06(g, k) {
  const WD = 1100, size = fitSize(g, 'JUMP', WD), cap = capH(g, size), base = 970, left = 410;
  const SY = [0.8, 0.6, 0.55, 0.68, 1.16, 1.22, 0.94, 1.04];
  const syAt = q => (q < 4 ? 1 : q - 4 < SY.length ? SY[q - 4] : 1);
  const sy = syAt(k), sxw = 1 + (1 - sy) * 0.16;
  const jw = textW(g, 'J', size);
  const hand = q => [960 + (left + jw * 0.5 - 960) * (1 + (1 - syAt(q)) * 0.16), base - cap * syAt(q) - 6];
  const s = 6;
  const planted = q => AO.pin(pose(AO.P.vault, { s, rot: lerp(92, 236, map(q, 4, 9)), flare: 1 }), 'handN', ...hand(q));
  let p;
  if (k < 4) {
    const a = pose(AO.P.dive, { x: -380, y: 760, s, rot: 62 });
    p = AO.lerpPose(a, planted(4), eOut(k / 4));
  } else if (k <= 9) p = planted(k);
  else {
    const p9 = planted(9), t = k - 9;
    p = pose(AO.lerpPose(p9, AO.P.landing, eIO(map(t, 2, 12))), { x: p9.x + 98 * t, y: p9.y - 14 * t + 4.4 * t * t, rot: 236 + 126 * eOut(map(t, 0, 11)), s, flare: 1 });
  }
  g.save();
  shake(g, k, 4, 26, 4); shake(g, k, 8, 16, 3);
  bg(g, PAL.white);
  // editorial furniture
  miniLogo(g, 96, 128, 54, PAL.black);
  g.fillStyle = PAL.black; g.fillRect(96, 160, W - 192, 5);
  label(g, 'ISSUE 06 — ACTION INDEX', 250, 122, PAL.black, 20);
  label(g, 'P. 006 / 013', W - 96, 122, PAL.black, 20, 'right');
  for (let i = 0; i < 5; i++) { g.fillStyle = PAL.silver; g.fillRect(1500, 220 + i * 22, i === 4 ? 180 : 324, 8); }
  barcode(g, 1500, 350, 324, 60, 6, PAL.black, 3);
  T(g, '06', 96, 420, 220, { fill: null, stroke: PAL.black, lw: 5 });
  // cobalt slash
  const sl = eExpo(map(k, 0, 3));
  slash(g, 60, 1040, lerp(60, 1900, sl), lerp(1040, 300, sl), 96, PAL.cobalt);
  // JUMP — compresses like a spring under her hand
  g.save(); g.translate(960, base); g.scale(sxw, sy);
  T(g, 'JUMP', left - 960, 0, size, { fill: PAL.black });
  g.restore();
  g.fillStyle = PAL.black; g.fillRect(left, base + 18, WD, 8);
  if (k >= 4 && k <= 6) { const h = hand(k); radialLines(g, h[0], h[1], k, 14, 90, 300 + (k - 4) * 80, PAL.cobalt); }
  if (k >= 2) AO.drawTint(g, k < 4 ? AO.lerpPose(pose(AO.P.dive, { x: -380, y: 760, s, rot: 62 }), planted(4), eOut((k - 1) / 4)) : k <= 10 ? planted(Math.max(4, k - 1.3)) : pose(p, { x: p.x - 90, y: p.y + 20, rot: p.rot - 22 }), PAL.ice, 0.5);
  AO.draw(g, p);
  g.restore();
  flash(g, k, 0, '#fff', 0.7);
}

/* =================== CUT 07 — FLIP =================== */
function cut07(g, k) {
  const A = [-200, 440], B = [2120, 1020], th = 170;
  const len = Math.hypot(B[0] - A[0], B[1] - A[1]), d = [(B[0] - A[0]) / len, (B[1] - A[1]) / len], n = [d[1], -d[0]];
  const slope = Math.atan2(d[1], d[0]) / D2R, s = 4.4;
  const prog = q => eIO(map(q, 2, 21));
  const mk = pr => {
    let b;
    if (pr < 0.14) b = AO.lerpPose(AO.P.landing, AO.P.takeoff, pr / 0.14);
    else if (pr < 0.4) b = AO.lerpPose(AO.P.takeoff, AO.P.tuck, eIO((pr - 0.14) / 0.26));
    else if (pr < 0.62) b = AO.P.tuck;
    else if (pr < 0.88) b = AO.lerpPose(AO.P.tuck, AO.P.open, eIO((pr - 0.62) / 0.26));
    else b = AO.lerpPose(AO.P.open, AO.P.landing, (pr - 0.88) / 0.12);
    const al = lerp(0.2, 0.74, pr) * len, hop = Math.sin(Math.PI * pr);
    const off = th / 2 + (27 + 16 * hop) * s + 230 * hop;
    const q = pose(b, { x: A[0] + d[0] * al + n[0] * off, y: A[1] + d[1] * al + n[1] * off, s, facing: -1, rot: slope + 360 * pr, flare: 1 });
    if (pr < 0.02 || pr > 0.98) { // feet on the stripe
      const J = AO.joints(q), f = J.soleN, dist = (f[0] - A[0]) * n[0] + (f[1] - A[1]) * n[1] - th / 2;
      q.x -= n[0] * dist; q.y -= n[1] * dist;
    }
    return q;
  };
  const pr = prog(k), prPrev = prog(k - 1);
  const GH = [[0.2, PAL.cobalt, 'A'], [0.5, PAL.white, 'B'], [0.8, PAL.black, 'C']];
  g.save();
  shake(g, k, 21, 24, 3);
  bg(g, PAL.ice);
  halftone(g, 1200, -40, 800, 520, 34, (u, v) => clamp(u * 1.1 - v * 0.6), '#d6f1ff');
  // FLIP rotates 180° with her
  const fs = fitSize(g, 'FLIP', 1260), fc = capH(g, fs);
  g.save(); g.translate(960, 500); g.rotate(Math.PI * pr);
  T(g, 'FLIP', 0, fc / 2, fs, { align: 'center', fill: null, stroke: PAL.cobalt, lw: 12 });
  g.restore();
  // black diagonal stripe
  slash(g, A[0], A[1], B[0], B[1], th, PAL.black);
  g.save(); g.translate(A[0], A[1]); g.rotate(slope * D2R);
  ruler(g, 0, -th / 2 + 12, len, 30, PAL.white, false, 5, 9);
  label(g, 'FLIP AXIS / ' + slope.toFixed(1) + '°   ROT ' + String(Math.round(360 * pr)).padStart(3, '0') + '°', 760, th / 2 - 22, PAL.white, 20);
  g.restore();
  // three stroboscopic ghosts, each a different palette colour
  for (const [gp, col, nm] of GH) {
    if (pr < gp) continue;
    const q = mk(gp); AO.drawTint(g, q, col, 1);
    const J = AO.joints(q);
    label(g, 'GHOST ' + nm, J.pelvis[0] + 190, J.pelvis[1] - 150, PAL.black, 18);
    cross(g, J.pelvis[0] + 170, J.pelvis[1] - 156, 10, PAL.black, 3);
  }
  AO.draw(g, mk(pr));
  cross(g, 96, 96, 16, PAL.black, 3);
  barcode(g, 1540, 80, 280, 64, 21, PAL.black, 3);
  g.restore();
  for (const [gp] of GH) if (pr >= gp && prPrev < gp) flash(g, 0, 0, '#fff', 0.7);
  flash(g, k, 0, '#fff', 0.6);
}

/* =================== CUT 08 — BARRAGE =================== */
function cut08(g, k) {
  const i = Math.floor(k / 6), j = k % 6, ps = punch(j) || 1;
  g.save();
  shake(g, k, i * 6, 34, 4);
  const centred = (word, width, col, o = {}) => {
    const size = fitSize(g, word, width), cap = capH(g, size);
    g.save(); zoomAt(g, 960, 480, ps);
    T(g, word, 960, 480 + cap / 2, size, Object.assign({ align: 'center', fill: col }, o));
    g.restore(); return [size, cap];
  };
  if (i === 0) {
    bg(g, PAL.black);
    centred('COOL', 1660, PAL.white);
    g.fillStyle = PAL.cobalt; g.fillRect(0, 40, W, 26); g.fillRect(0, 900, W * eExpo((j + 1) / 3), 26);
    label(g, '01/04', 96, 130, PAL.white, 22);
  } else if (i === 1) {
    bg(g, PAL.white);
    speedLines(g, 5, 26, -200, 0, W + 400, 960, k * 300, PAL.black, 200, 900, 10);
    g.save(); g.transform(1, 0, -0.3, 1, 150, 0); g.translate((1 - eExpo((j + 1) / 3)) * 900, 0);
    const size = fitSize(g, 'FAST', 1560), cap = capH(g, size);
    T(g, 'FAST', 960 + 26, 480 + cap / 2 + 20, size, { align: 'center', fill: PAL.ice });
    T(g, 'FAST', 960, 480 + cap / 2, size, { align: 'center', fill: PAL.cobalt });
    g.restore();
    label(g, '02/04', 96, 130, PAL.black, 22);
  } else if (i === 2) {
    bg(g, PAL.cobalt);
    const size = fitSize(g, 'CLEAN', 1500), cap = capH(g, size), gap = cap + 46;
    g.save(); zoomAt(g, 960, 480, ps);
    for (let r = -1; r <= 1; r++) {
      const off = r * (60 - j * 16);
      T(g, 'CLEAN', 960 + off, 480 + cap / 2 + r * gap, size, r === 0 ? { align: 'center', fill: PAL.white } : { align: 'center', fill: null, stroke: PAL.white, lw: 6 });
    }
    g.restore();
    label(g, '03/04', 96, 130, PAL.white, 22);
  } else {
    bg(g, PAL.ice);
    disc(g, 1500, 300, 520 * ps, PAL.white);
    centred('BLUE', 1900, PAL.cobalt);
    g.fillStyle = PAL.black; g.fillRect(0, 70, W, 34);
    barcode(g, 96, 860, 420, 90, 44, PAL.black, 4);
    label(g, '04/04', 96, 160, PAL.black, 22);
  }
  // she knee-slides across the foreground
  const s = 8.6, u = k / 23, px = q => lerp(-420, 2380, Math.pow(clamp(q / 23, -1, 2), 0.92));
  const p = grounded(pose(AO.P.knees, { x: px(k), s, rot: -24, sway: -1, smirk: 1 }), 1068, LEGS);
  const dark = i === 0 || i === 2;
  // frost bursting from her sneakers
  for (let b = Math.max(0, k - 6); b <= k; b++) {
    const age = k - b, ex = px(b) - 34 * s, ey = 1020;
    for (let n = 0; n < 9; n++) {
      const id = b * 17.7 + n * 5.3;
      const x = ex + rr(id, -46, 14) * age + rr(id + 4, -60, 60), y = ey - rr(id + 1, 6, 56) * age + 3.4 * age * age - rr(id + 5, 0, 60);
      frost(g, x, y, rr(id + 2, 12, 46) * (1 - age / 8), id + age * 0.4, pick(id + 3, dark ? [PAL.white, PAL.ice, PAL.white] : [PAL.white, PAL.ice, PAL.cobalt]), dark ? null : PAL.cobalt);
    }
  }
  for (let n = 0; n < 9; n++) { g.fillStyle = dark ? PAL.ice : PAL.cobalt; const len = rr(n * 3.3 + k, 200, 700); g.fillRect(p.x - 46 * s - len, rr(n * 9.1 + (k % 3), 560, 1040), len, rr(n * 2.2, 4, 14)); }
  AO.draw(g, p);
  g.restore();
  flash(g, k, i * 6, i === 1 ? PAL.black : '#fff', 0.6);
}

/* =================== CUT 09 — TARGET LOCK =================== */
function cut09(g, k) {
  const FRZ = 13, kk = Math.min(k, FRZ), CELL = 150;
  const e = eOut(kk / FRZ), al = lerp(10, 64, e) * D2R, yaw = lerp(-6, -26, e) * D2R;
  const proj = (u, v) => {
    const x = u * CELL, y = -v * CELL * Math.sin(al), z = v * CELL * Math.cos(al);
    const x2 = x * Math.cos(yaw) - z * Math.sin(yaw), z2 = x * Math.sin(yaw) + z * Math.cos(yaw);
    const f = 1150 / (z2 + 1500);
    return [900 + x2 * f, 960 + y * f, f];
  };
  const path = q => [lerp(-3.4, -1.0, q), lerp(0.5, 5.4, q)];
  const mk = q10 => {
    const q = clamp(q10 / 10), a = proj(...path(q)), b = proj(...path(q + 0.02));
    const th = Math.atan2(b[1] - a[1], b[0] - a[0]), nrm = [Math.sin(th), -Math.cos(th)];
    const s = 7.6 * a[2];
    let p = pose(AO.run(q10 * 1.15 + 0.3), { y: 0, s, rot: th / D2R });
    p.x = a[0] + nrm[0] * 43 * s; p.y = a[1] + nrm[1] * 43 * s;
    const t = map(q10, 10, 13);
    if (t > 0) p = AO.lerpPose(p, pose(AO.P.hang, { x: 1010, y: 520, s: 5.4, rot: -16, smirk: 1 }), eOut(t));
    return p;
  };
  g.save();
  shake(g, k, 14, 30, 4);
  bg(g, PAL.black);
  // wireframe grid tilting up into a wall
  g.lineCap = 'butt';
  for (let u = -9; u <= 9; u++) {
    g.beginPath();
    for (let v = 0; v <= 14; v += 0.5) { const q = proj(u, v); v ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }
    g.strokeStyle = PAL.white; g.lineWidth = u % 3 === 0 ? 4 : 2; g.stroke();
  }
  for (let v = 0; v <= 14; v++) {
    const a = proj(-9, v), b = proj(9, v);
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.strokeStyle = PAL.white; g.lineWidth = v % 3 === 0 ? 4 : 2; g.stroke();
  }
  for (let u = -9; u <= 9; u += 3) for (let v = 0; v <= 12; v += 3) { const q = proj(u, v); cross(g, q[0], q[1], 16 * q[2], PAL.ice, 4); }

  const p = mk(kk), J = AO.joints(p);
  if (k < FRZ) {
    // run-up streaks + footfall chips on the wall
    for (let b = Math.max(0, k - 4); b < k; b++) { const q = mk(b); AO.drawTint(g, q, PAL.ice, 0.14 + 0.1 * (b - k + 4)); }
    if (k >= 10) { const a = proj(...path(1)); radialLines(g, a[0], a[1], 9, 16, 30, 120 + (k - 10) * 110, PAL.ice); }
  } else {
    // target lock stamps around the frozen pose
    const c = [(J.chest[0] + J.pelvis[0]) / 2, (J.chest[1] + J.pelvis[1]) / 2 + 10], st = k - 14;
    if (st >= 0) {
      const r = 340 * (punch(st) || 1);
      disc(g, c[0], c[1], r, PAL.cobalt);
      ringStroke(g, c[0], c[1], r + 26, 6, PAL.white);
      g.save(); g.translate(c[0], c[1]); g.rotate(k * 0.09); g.strokeStyle = PAL.white; g.lineWidth = 3;
      for (let i = 0; i < 72; i++) { const a = i / 72 * Math.PI * 2, L2 = i % 6 === 0 ? 34 : 14; g.beginPath(); g.moveTo(Math.cos(a) * (r + 44), Math.sin(a) * (r + 44)); g.lineTo(Math.cos(a) * (r + 44 + L2), Math.sin(a) * (r + 44 + L2)); g.stroke(); }
      g.restore();
      g.fillStyle = PAL.white;
      g.fillRect(c[0] - 3000, c[1] - 1.5, 3000 - r - 100, 3); g.fillRect(c[0] + r + 100, c[1] - 1.5, 3000, 3);
      g.fillRect(c[0] - 1.5, c[1] - 3000, 3, 3000 - r - 100); g.fillRect(c[0] - 1.5, c[1] + r + 100, 3, 3000);
    }
    if (st >= 2) { const b = 450 + (st === 2 ? 60 : 0); brackets(g, c[0] - b, c[1] - b, b * 2, b * 2, 80, PAL.white, 8); }
    if (st >= 3) {
      const lines = ['TARGET  AO', 'LOCK    100%', 'ALT     04.20 M', 'VEL     00.00', 'FRAME   ' + (192 + FRZ)];
      const chars = (st - 3) * 9;
      let used = 0;
      lines.forEach((ln, n) => { const show = clamp(chars - used, 0, ln.length); used += ln.length; if (show > 0) label(g, ln.slice(0, show), c[0] + 500, c[1] - 120 + n * 34, n === 1 ? PAL.ice : PAL.white, 22); });
      barcode(g, c[0] + 500, c[1] + 70, 240, 50, 33, PAL.white, 3);
      label(g, '❚❚ FREEZE', 96, 110, PAL.white, 24);
    }
  }
  AO.draw(g, p);
  g.restore();
  flash(g, k, 0, '#fff', 0.5);
  flash(g, k, FRZ, '#fff', 0.9);
}

/* =================== CUT 10 — SHUTTERS =================== */
function cut10(g, k) {
  const S = [2, 8, 14];
  const L3 = lockup(960, 1000, 900);
  const layers = [
    g2 => { bg(g2, PAL.ice); ringStroke(g2, 960, 540, 316, 22, PAL.cobalt); ringStroke(g2, 960, 540, 420, 4, PAL.white); brackets(g2, 500, 80, 920, 920, 90, PAL.white, 8); },
    g2 => { bg(g2, PAL.cobalt); logoA(g2, 120, 900, 720, PAL.white); barcode(g2, 1380, 880, 400, 80, 3, PAL.white, 4); label(g2, 'PANE 01 / A', 1380, 840, PAL.white, 22); },
    g2 => { bg(g2, PAL.white); logoO(g2, 1280, 540, 500, PAL.black); g2.fillStyle = PAL.cobalt; g2.fillRect(0, 930, 640, 40); label(g2, 'PANE 02 / O', 96, 900, PAL.black, 22); },
    g2 => { bg(g2, PAL.black); logoA(g2, L3.ax, L3.base, L3.h, PAL.white); logoO(g2, L3.ox, L3.oy, L3.R, PAL.white); g2.fillStyle = PAL.cobalt; g2.fillRect(0, 1010, W, 30); },
  ];
  let top = 0; for (let n = 0; n < 3; n++) if (k >= S[n]) top = n + 1;
  // she dives at the lens, growing fast
  const s = 2.6 * Math.exp(0.07 * k);
  const tgt = [lerp(900, 1180, k / 20), lerp(470, 720, k / 20)];
  const p = AO.pin(pose(AO.P.dive, { s, rot: 64, flare: 1, smirk: 1, sway: -1 }), 'head', tgt[0], tgt[1]);
  const J = AO.joints(p);
  g.save();
  for (const sk of S) shake(g, k, sk, 34, 4);
  shake(g, k, 20, 30, 5);
  layers[top](g);
  if (top > 0) {
    const t = k - S[top - 1];
    if (t < 9) paneShards(g, t + 0.6, top * 40 + 3, J.handN[0], J.handN[1], null, layers[top - 1]);
  }
  if (k < 2) { ringStroke(g, 960, 540, 316 + k * 260, 40 - k * 14, PAL.white); }
  radialLines(g, tgt[0], tgt[1], k * 3 + 1, 22, 500 + s * 30, 1900, top === 2 ? 'rgba(6,7,11,.5)' : 'rgba(255,255,255,.5)');
  if (k < 21) AO.draw(g, p);
  // foreground wipe with her sneaker
  if (k >= 19) {
    const t = k - 19, ss = [34, 64, 110, 180, 290, 430, 600][t];
    const x = lerp(2500, 760, eOut(t / 6)), y = lerp(380, 620, t / 6);
    g.save(); g.translate(x, y); g.rotate(-0.16 + t * 0.02); g.scale(-ss, ss);
    g.lineJoin = 'round'; g.lineCap = 'round';
    AO.shoe(g, [0, 0], 90);
    g.restore();
  }
  g.restore();
  for (const sk of S) flash(g, k, sk, '#fff', 0.75);
  flash(g, k, 0, '#fff', 0.9);
}

/* =================== CUT 11 — POSTERS =================== */
function cut11(g, k) {
  const i = Math.floor(k / 6), j = k % 6, z = [1.07, 1.015, 1, 1, 1, 1][j], dr = j * 7;
  g.save();
  zoomAt(g, 960, 540, z);
  if (i === 0) {            // 01 — MID-FLIP
    bg(g, PAL.cobalt);
    disc(g, 1250, 520, 470, PAL.white);
    halftone(g, 0, 0, 900, 1080, 40, (u, v) => clamp(1.05 - u - v * 0.3), '#2f5bff');
    slash(g, 1500 - dr, 1200, 2100 - dr, -100, 110, PAL.black);
    T(g, '01', 70 + dr, 1010, 760, { fill: null, stroke: PAL.white, lw: 10 });
    AO.draw(g, pose(AO.P.tuck, { x: 1230, y: 560, s: 8.6, rot: 152, flare: 1 }));
    T(g, 'MID-FLIP', 1850, 150, 110, { fill: PAL.white, align: 'right' });
    label(g, 'AO // ACTION INDEX 01', 1850, 196, PAL.ice, 20, 'right');
    barcode(g, 96, 80, 360, 70, 51, PAL.white, 4);
  } else if (i === 1) {     // 02 — SLIDING
    bg(g, PAL.white);
    g.fillStyle = PAL.black; g.fillRect(0, 700, W, 250);
    T(g, '02', 1900 - dr, 660, 820, { fill: PAL.cobalt, align: 'right' });
    slash(g, -100, 420, 1200, 120, 60, PAL.ice);
    speedLines(g, 8, 18, -200, 380, W + 400, 520, k * 240, PAL.silver, 200, 800, 8);
    const p = grounded(pose(AO.P.slide, { x: 760, s: 8.4, rot: -52, sway: -1 }), 1010);
    AO.draw(g, p);
    T(g, 'SLIDING', 96, 200, 130, { fill: PAL.black });
    label(g, 'AO // ACTION INDEX 02', 100, 244, PAL.cobalt, 20);
    vbarcode(g, 1790, 720, 70, 210, 52, PAL.white, 4);
  } else if (i === 2) {     // 03 — LANDING
    bg(g, PAL.black);
    g.fillStyle = PAL.ice; g.fillRect(620, 0, 700, H);
    halftone(g, 620, 560, 700, 520, 36, (u, v) => clamp(v * 1.1 - 0.15), PAL.white);
    T(g, '03', 60, 600 + dr, 700, { fill: PAL.white });
    slash(g, 1180, 1200 - dr, 2000, 200 - dr, 80, PAL.cobalt);
    const p = grounded(pose(AO.P.landing, { x: 950, s: 8.8, rot: 3, facing: -1 }), 1010);
    g.fillStyle = PAL.cobalt; g.fillRect(380, 1010, 1180, 14);
    AO.draw(g, p);
    T(g, 'LANDING', 1850, 1000, 130, { fill: PAL.white, align: 'right' });
    label(g, 'AO // ACTION INDEX 03', 1850, 860, PAL.ice, 20, 'right');
    ruler(g, 1400, 90, 440, 20, PAL.silver);
    barcode(g, 1500, 130, 340, 60, 53, PAL.silver, 3);
  } else {                  // 04 — HANDS IN POCKETS
    bg(g, PAL.ice);
    disc(g, 960, 470, 400, PAL.white);
    T(g, '04', 960, 900 + dr * 0.5, 1100, { fill: PAL.cobalt, align: 'center' });
    slash(g, -100, 980, 2100, 760, 22, PAL.black);
    const p = grounded(pose(AO.P.pockets, { x: 960, s: 9.4, facing: -1, smirk: 1 }), 1056);
    AO.draw(g, p);
    T(g, 'A', 110, 300, 240, { fill: PAL.black }); T(g, 'O', 1700, 300, 240, { fill: PAL.black });
    label(g, 'AO // ACTION INDEX 04 — HANDS IN POCKETS', 96, 1010, PAL.black, 20);
    barcode(g, 1470, 930, 360, 80, 54, PAL.black, 4);
  }
  g.restore();
  flash(g, k, i * 6, '#fff', 0.55);
}

/* =================== CUT 12 — HERO (proposed) =================== */
function cut12(g, k) {
  const ground = 990, s = 8.5, LAND = 5;
  const land = grounded(pose(AO.P.landing, { x: 960, s, facing: -1, rot: 2 }), ground);
  let p;
  if (k < LAND) {
    const t = eIn((k + 1) / (LAND + 1));
    p = pose(AO.lerpPose(AO.P.fall, AO.P.landing, t * 0.6), { x: 960, y: land.y - (1 - t) * 1500, s, facing: -1, rot: lerp(-14, 2, t), flare: 1 });
  } else {
    const up = eIO(map(k, 10, 23));
    p = AO.lerpPose(pose(AO.P.landing, { flare: lerp(1, 0.4, map(k, LAND, 10)) }), AO.P.pockets, up);
    const bl = k === 31 ? 1 : k === 30 || k === 32 ? 0.6 : 0;
    p = grounded(pose(p, { x: 960, s, facing: -1, rot: 2 * (1 - up), smirk: map(k, 24, 30), blink: bl, sway: -0.3 * (1 - up) }), ground);
  }
  g.save();
  shake(g, k, LAND, 40, 6);
  zoomAt(g, 960, 600, 1 + 0.05 * k / 45);
  bg(g, PAL.white);
  // scrolling outlined columns
  const cs = 300, cw = textW(g, 'AO  ', cs), cc = capH(g, cs);
  for (const [x, dir] of [[150, 1], [1770, -1]]) {
    g.save(); g.translate(x, 540); g.rotate(-Math.PI / 2);
    const off = ((k * 9 * dir) % cw + cw) % cw;
    for (let n = -3; n < 3; n++) T(g, 'AO  ', n * cw + off, cc / 2, cs, { fill: null, stroke: PAL.silver, lw: 4 });
    g.restore();
  }
  disc(g, 960, 520, 440 * ([2.6, 1.3, 0.94, 1.03][k] || 1), PAL.cobalt);
  ringStroke(g, 960, 520, 474, 4, PAL.black);
  g.fillStyle = PAL.black; g.fillRect(330, ground, 1260, 8);
  ruler(g, 330, ground + 18, 1260, 21, PAL.black, false, 5, 8);
  // landing shockwave + frost
  if (k >= LAND && k < LAND + 8) {
    const t = k - LAND;
    g.save(); g.translate(960, ground); g.scale(1, 0.22);
    ringStroke(g, 0, 0, 120 + t * 170, Math.max(2, 46 - t * 6), PAL.black);
    ringStroke(g, 0, 0, 60 + t * 120, Math.max(1, 20 - t * 3), PAL.ice);
    g.restore();
    for (let n = 0; n < 26; n++) {
      const id = n * 7.7, dir = n % 2 ? 1 : -1;
      frost(g, 960 + dir * (60 + rr(id, 30, 110) * (t + 1)), ground - 10 - rr(id + 1, 10, 60) * (t + 1) + 4 * t * t, rr(id + 2, 12, 40) * (1 - t / 9), id + t * 0.3, pick(id + 3, [PAL.white, PAL.ice]), PAL.cobalt);
    }
  }
  if (k < LAND) for (let n = 0; n < 12; n++) { g.fillStyle = pick(n, [PAL.black, PAL.ice, PAL.white]); g.fillRect(960 + rr(n * 3.1, -260, 260), p.y - rr(n * 5.1, 300, 1100), rr(n, 6, 16), rr(n * 2.2, 200, 600)); }
  AO.draw(g, p);
  // spec call-outs around the outfit
  const J = AO.joints(p);
  const CO = [
    [J.headTop, [1400, 170], 'KNIT BEANIE', 'ICE BLUE / RIB CUFF', 1],
    [J.uarmN, [520, 380], 'UTILITY POCKET', 'LEFT SLEEVE / COBALT', -1],
    [J.hood, [1420, 400], 'WINDBREAKER', 'WHITE / HOODED / BLUE DRAWSTRINGS', 1],
    [J.tag, [500, 640], 'DRAWSTRING SHORTS', 'LIGHT BLUE / BARCODE TAG', -1],
    [J.toeN, [1400, 880], 'PLATFORM SNEAKERS', 'WHITE + BLUE / CHUNKY SOLE', 1],
  ];
  CO.forEach((c, n) => {
    const t = k - 24 - n * 3; if (t < 0) return;
    if (t === 0) { disc(g, c[0][0], c[0][1], 26, PAL.black); return; }
    callout(g, c[0], c[1], c[2], c[3], c[4]);
  });
  if (k >= 22) {
    label(g, 'AO — 001 / CHARACTER SHEET', 330, ground + 58, PAL.black, 18);
    barcode(g, 1330, ground + 38, 260, 24, 71, PAL.black, 3);
  }
  g.restore();
  flash(g, k, 0, '#fff', 0.7);
  flash(g, k, LAND, '#fff', 0.5);
}

/* =================== CUT 13 — LOCKUP (proposed) =================== */
function cut13(g, k) {
  if (k < 40) {
    const L = lockup(960, 710, 640), hole = L.R * O_HOLE;
    g.save();
    shake(g, k, 0, 34, 4); shake(g, k, 4, 40, 5);
    bg(g, PAL.black);
    const pa = punch(k), po = punch(k - 4);
    if (pa) { g.save(); zoomAt(g, L.ax + 0.47 * L.h, L.oy, pa); logoA(g, L.ax, L.base, L.h, PAL.white); g.restore(); }
    if (po) {
      g.save(); zoomAt(g, L.ox, L.oy, po);
      // her face in the porthole
      g.save(); g.beginPath(); g.arc(L.ox, L.oy, hole + 1, 0, 7); g.clip();
      g.fillStyle = PAL.ice; g.fillRect(L.ox - hole, L.oy - hole, hole * 2, hole * 2);
      halftone(g, L.ox - hole, L.oy - hole, hole * 2, hole * 2, 22, (u, v) => clamp(u - v * 0.4 - 0.1), PAL.white);
      const up = eOut(map(k, 26, 28)) * (1 - eOut(map(k, 32, 34)));
      const bl = k === 19 ? 1 : k === 18 || k === 20 ? 0.6 : 0;
      const p = AO.pin(pose(AO.P.pockets, { s: 17.5, smirk: map(k, 10, 16), look: [0.3 * up, -0.8 * up], blink: bl }), 'head', L.ox - 8, L.oy + 12);
      AO.draw(g, p);
      g.restore();
      logoO(g, L.ox, L.oy, L.R, PAL.white);
      g.restore();
    }
    if (k === 0) radialLines(g, L.ax + 0.47 * L.h, L.oy, 3, 24, 400, 1600, PAL.white);
    if (k === 4) radialLines(g, L.ox, L.oy, 4, 28, 420, 1700, PAL.white);
    // baseline bar + tagline
    const bw = (L.right - L.left) * eExpo(map(k, 8, 12));
    g.fillStyle = PAL.cobalt; g.fillRect(L.left, L.base + 34, bw, 16);
    const words = ['FULL SPEED', 'NO BRAKES', 'NO LIMITS'];
    words.forEach((w, n) => {
      const t = k - 12 - n * 3; if (t < 0) return;
      const x = L.left + n * ((L.right - L.left) / 3) + 4, pz = punch(t) || 1;
      g.save(); zoomAt(g, x + 120, L.base + 120, pz);
      T(g, w, x, L.base + 146, 84, { fill: t === 0 ? PAL.cobalt : PAL.white });
      g.restore();
      if (n) slash(g, x - 44, L.base + 150, x - 14, L.base + 80, 10, PAL.cobalt);
    });
    if (k >= 20) {
      const fl = rnd(k * 2.9) > 0.2;
      if (fl) barcode(g, L.left, 960, 420, 54, 88, PAL.white, 3);
      label(g, 'AO-001 // CHARACTER REVEAL // 24FPS // 16:9', L.right, 996, PAL.silver, 20, 'right');
      ruler(g, 60, 56, 520, 20, PAL.silver); ruler(g, 56, 60, 300, 20, PAL.silver, true);
      cross(g, W - 80, 80, 16, PAL.silver, 3); cross(g, 80, H - 80, 16, PAL.silver, 3); cross(g, W - 80, H - 80, 16, PAL.silver, 3);
    }
    g.restore();
  } else {
    // shutter back to the opening layout
    const L = lockup(960, 800, 520), t = k - 40;
    g.save();
    shake(g, k, 40, 26, 4);
    zoomAt(g, 960, 540, [1.06, 1.015][t] || 1);
    bg(g, PAL.white);
    disc(g, L.ox, L.oy, 430, PAL.cobalt);
    logoA(g, L.ax, L.base, L.h, PAL.black); logoO(g, L.ox, L.oy, L.R, PAL.black);
    ruler(g, 60, 56, 520, 20, PAL.black); ruler(g, 56, 60, 300, 20, PAL.black, true);
    label(g, 'AO-001 // CHARACTER REVEAL', 96, 122, PAL.black);
    barcode(g, 150, 900, 330, 84, 7, PAL.black, 4);
    for (const [x, y] of [[W - 80, 80], [80, H - 80], [W - 80, H - 80]]) cross(g, x, y, 16, PAL.black, 3);
    g.restore();
  }
  flash(g, k, 0, '#fff', 0.8);
  flash(g, k, 40, '#fff', 0.95);
}

/* ---------- film ---------- */
const CUT_FN = [cut01, cut02, cut03, cut04, cut05, cut06, cut07, cut08, cut09, cut10, cut11, cut12, cut13];
function cutAt(f) { let i = 0; while (i < 12 && f >= BOUNDS[i + 1]) i++; return i; }
function renderFrame(g, f) {
  f = clamp(Math.round(f), 0, TOTAL - 1);
  const i = cutAt(f);
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.beginPath(); g.rect(0, 0, W, H); g.clip();
  g.fillStyle = PAL.black; g.fillRect(0, 0, W, H);
  CUT_FN[i](g, f - BOUNDS[i]);
  g.restore();
  return i;
}
