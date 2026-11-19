/* AO — character reveal trailer. 13 cuts · 24 fps · 16:9 · 14.0 s
 * render(F) draws global frame F deterministically, so the live player and the MP4 export match. */
(function (G) {
  'use strict';
  const K = G.AOKIT;
  const { W, H, FPS, C, FONT_BIG, FONT_WIDE, FONT_MONO, clamp, lerp, k, E, rnd, rng, impact, shakeSum,
    txt, txtC, measure, rect, circle, ring, poly, band, barcode, ticks, brackets, halftone, speedLines, zoomLines,
    makeShards, makeRectShards, drawShards, smear, rgbSplit, flash, invert,
    POSES, mix, runPose, footDepth, jointWorld, drawAO, drawSneaker, drawFaceCU, drawEyeECU } = K;
  const TAU = Math.PI * 2;
  const sec = F => F / FPS;
  const mono = (c, s, x, y, size = 20, o = {}) => txt(c, s, x, y, size, Object.assign({ font: FONT_MONO, align: 'left', base: 'top', track: 3 }, o));

  // ------------------------------------------------------------------ CUT 01
  function cut01(ctx, f) {
    const sh = shakeSum(f, [[3, 24, 6], [12, 34, 6], [17, 34, 6]]);
    rect(ctx, 0, 0, W, H, C.white);
    ctx.save(); ctx.translate(sh[0], sh[1]);
    halftone(ctx, -20, 560, 980, 560, 22, C.silverL, (u, v) => v * (1 - u) * 1.1);
    const cs = lerp(3.4, 1, E.outExpo(k(f, 0, 3)));
    circle(ctx, 1240, 540, 380 * cs, C.cobalt);
    if (f >= 4) ring(ctx, 1240, 540, 420, 3, C.black);
    const b1 = E.outExpo(k(f, 4, 8)), b2 = E.outExpo(k(f, 6, 10));
    rect(ctx, 0, 176, W * b1, 70, C.black);
    rect(ctx, W * (1 - b2), 846, W * b2, 36, C.black);
    if (f >= 2 && rnd(f * 1.7) > 0.22) {
      ticks(ctx, 70, 60, 560, 40, { color: C.black, h: 18 });
      mono(ctx, 'AO // CHARACTER FILE 001', 70, 92, 20);
    }
    if (f >= 5 && rnd(f * 2.3 + 4) > 0.3) {
      ticks(ctx, 1832, 300, 470, 30, { vert: true, color: C.black, h: 18 });
      mono(ctx, 'REC ● 24FPS 16:9', 1850, 70, 20, { align: 'right' });
    }
    if (f >= 3 && rnd(f * 5.1) > 0.28) barcode(ctx, 1450, 920, 340, 70, 100 + Math.floor(f / 2), C.black, 'AO-0001-ICE');
    if (f >= 12) { const s = lerp(2.0, 1, E.outExpo(k(f, 12, 14))); txtC(ctx, 'A', 600, 540, 660, { font: FONT_WIDE, color: C.black, sx: s, sy: s }); }
    if (f >= 17) { const s = lerp(2.0, 1, E.outExpo(k(f, 17, 19))); txtC(ctx, 'O', 1240, 540, 660, { font: FONT_WIDE, color: C.white, sx: s, sy: s }); }
    if (f >= 12) { rect(ctx, 300, 900, 260 * E.outExpo(k(f, 12, 15)), 8, C.cobalt); mono(ctx, 'A / 01', 300, 920, 22, { color: C.black }); }
    ctx.restore();
    if (f === 12 || f === 17) invert(ctx);
    if (f === 3) flash(ctx, 0.45, C.ice);
  }

  // ------------------------------------------------------------------ CUT 02
  const shards2 = makeShards(7, 960, 540, 470, 16, 3, [C.ice, C.cobalt, C.white, C.silver, C.hair, C.black, C.ice2, C.cobaltL]);
  function cut02(ctx, f, n, F) {
    const scene = c => {
      rect(c, 0, 0, W, H, C.cobalt);
      halftone(c, 0, 0, W, H, 26, C.cobaltD, (u, v) => clamp(Math.hypot(u - 0.5, (v - 0.5) * 0.56) * 1.6));
      const r = lerp(400, 446, f / 14);
      c.save(); c.beginPath(); c.arc(960, 540, r - 66, 0, TAU); c.clip();
      const g = E.outExpo(k(f, 7, 10));
      drawEyeECU(c, 960, 590, (r - 66) * 0.6, [lerp(-0.05, 0.12, g), lerp(0.25, -0.6, g)], 0);
      c.restore();
      ring(c, 960, 540, r - 33, 66, C.white);
      ring(c, 960, 540, r + 10, 4, C.black);
      c.save(); c.translate(960, 540); c.rotate(f * 0.045); c.fillStyle = C.white;
      for (let i = 0; i < 120; i++) { c.save(); c.rotate((i / 120) * TAU); c.fillRect(r + 30, -1.5, i % 10 ? 14 : 34, 3); c.restore(); }
      c.restore();
      mono(c, 'SUBJECT: AO', 90, 90, 26, { color: C.white });
      mono(c, 'IRIS // ICE-BLUE #8FD8FF', 90, 130, 20, { color: C.ice });
      mono(c, 'FOCUS ' + String(84 + f).padStart(3, '0') + '%', 1830, 980, 22, { color: C.white, align: 'right' });
      barcode(c, 90, 900, 280, 64, 22, C.white, 'OPTIC-02');
      brackets(c, 960 - r - 90, 540 - r - 90, (r + 90) * 2, (r + 90) * 2, 60, 6, C.white);
    };
    if (f < 14) scene(ctx);
    else if (f < 16) { rgbSplit(ctx, scene, f === 14 ? 38 : 16); flash(ctx, f === 14 ? 0.4 : 0.12); }
    else {
      rect(ctx, 0, 0, W, H, C.black);
      const u = k(f, 15.5, 23.5);
      zoomLines(ctx, 960, 540, f, 11, { color: C.cobalt, inner: 200 + u * 300, count: 60 });
      drawShards(ctx, shards2, u, { grow: 0.8 });
      if (f === 16) flash(ctx, 0.6);
    }
  }

  // ------------------------------------------------------------------ CUT 03
  function cut03(ctx, f, n, F) {
    const base = 862, s = 74;
    const slideX = ff => lerp(640, 1440, E.outCubic(k(ff, 9, 22)));
    const draw = c => {
      rect(c, 0, 0, W, H, C.black);
      txt(c, 'AO', 960, base, 1020, { font: FONT_WIDE, color: C.white, track: -10 });
      rect(c, 0, base + 8, W, 5, C.cobalt);
      ticks(c, 0, base + 22, W, 96, { color: C.silverD, h: 16, major: 8 });
      mono(c, 'BASELINE 862PX', 40, 40, 20, { color: C.silver });
      mono(c, 'VEL ' + (f < 9 ? 31 + f * 2 : Math.max(0, 49 - (f - 9) * 3)) + ' KM/H', 1880, 40, 20, { color: C.ice, align: 'right' });
      let x, pose, flare = 0.4;
      if (f < 9) { x = lerp(-260, 640, f / 9); pose = runPose(f * 1.3); }
      else { x = slideX(f); pose = mix(runPose(9 * 1.3), POSES.slide, E.outExpo(k(f, 9, 11))); flare = 1; }
      const y = base - footDepth(pose) * s;
      // ice-blue streaks trailing
      const L = f < 9 ? 380 : 220 + 900 * (1 - k(f, 9, 22));
      for (let i = 0; i < 7; i++) {
        const yy = y - 300 + i * 52 + (i % 2) * 10, l = L * (0.6 + 0.4 * rnd(i * 9 + f));
        c.globalAlpha = 0.85; rect(c, x - l - 70, yy, l, 6 + (i % 3) * 7, i % 3 ? C.ice : C.cobaltL); c.globalAlpha = 1;
      }
      speedLines(c, f, 3, { count: 26, color: C.white, alpha: 0.45, len: [300, 900], thick: [2, 5] });
      drawAO(c, x, y, s, pose, { flare, time: sec(F) });
      // shards of the letters kicked up like sparks
      if (f >= 10) {
        const r = rng(77);
        for (let i = 0; i < 46; i++) {
          const sf = 10 + r() * 11, vx = 250 + r() * 900, vy = -(450 + r() * 1100), sz = 8 + r() * 26, rot = r() * 6, col = r() < 0.7 ? C.white : C.ice;
          if (f < sf) continue;
          const dt = (f - sf) / FPS, x0 = slideX(sf) + 120;
          const px = x0 + vx * dt, py = base - 10 + vy * dt + 2600 * dt * dt;
          if (py > base + 40) continue;
          c.save(); c.translate(px, py); c.rotate(rot + dt * 12);
          poly(c, [[-sz, sz * 0.5], [sz * 0.8, sz * 0.3], [0, -sz * 0.7]], col);
          c.restore();
        }
      }
      if (f === 9) flash(c, 0.18, C.white);
    };
    if (f < 21) draw(ctx);
    else {
      const u = E.inCubic(k(f, 20.5, 25.5));
      smear(ctx, c => { c.save(); c.translate(-u * 2300, 0); draw(c); c.restore(); }, -140 - 260 * u, 0, 9);
      speedLines(ctx, f, 31, { count: 50, color: C.white, alpha: 0.6, len: [600, 1600], thick: [2, 10] });
    }
  }

  // ------------------------------------------------------------------ CUT 04
  const P4 = [
    { bg: C.cobalt, tone: '#3a58ff', fig: C.white, pose: 'takeoff', label: 'TAKEOFF' },
    { bg: C.white, tone: '#dfe5ec', fig: C.black, pose: 'tuck', label: 'TUCK' },
    { bg: C.ice, tone: '#79c8f2', fig: C.cobalt, pose: 'land', label: 'LANDING' },
  ];
  function cut04(ctx, f, n, F) {
    rect(ctx, 0, 0, W, H, C.black);
    const gap = 16, pw = (W - gap * 2) / 3;
    const scrollY = F * 60;
    P4.forEach((p, i) => {
      const x0 = i * (pw + gap), a = E.outExpo(k(f, i * 2, i * 2 + 3));
      if (a <= 0) return;
      const hh = H * a, y0 = i % 2 === 0 ? 0 : H - hh;
      ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, pw, hh); ctx.clip();
      rect(ctx, x0, 0, pw, H, p.bg);
      // huge vertical FULL SPEED, one continuous strip behind all three panels
      ctx.save(); ctx.translate(x0 + pw / 2, 0); ctx.rotate(-Math.PI / 2);
      const sc = ((i % 2 ? -1 : 1) * scrollY) % 1900;
      for (let j = -2; j < 3; j++) txtC(ctx, 'FULL SPEED', -sc + j * 1900, 0, 560, { color: p.tone, align: 'left', track: 6 });
      ctx.restore();
      // stroboscopic freeze: 3 stepped echoes
      const st = Math.floor(Math.max(0, f - i * 2 - 2) / 3);
      for (let g = 2; g >= 0; g--) {
        const uu = clamp(Math.max(0, st - g) / 5);
        if (st - g < 0) continue;
        let x, y, R = 0;
        const cx = x0 + pw / 2;
        if (i === 0) { x = cx - 80 + uu * 140; y = 640 - uu * 170; R = -8 * uu; }
        else if (i === 1) { x = cx + uu * 40 - 20; y = 470 - Math.sin(uu * Math.PI) * 70; R = -uu * 220; }
        else { x = cx - 40 + uu * 70; y = 600 + uu * 90; }
        drawAO(ctx, x, y, 66, POSES[p.pose], { mono: p.fig, R, alpha: g === 0 ? 1 : g === 1 ? 0.45 : 0.18 });
      }
      ctx.restore();
      if (a > 0.6) {
        mono(ctx, '0' + (i + 1), x0 + 30, y0 + 30, 44, { color: p.fig, font: FONT_BIG, track: 0 });
        mono(ctx, p.label + ' / FRAME ' + String(st * 3).padStart(3, '0'), x0 + 30, H - 60, 18, { color: p.fig });
        ticks(ctx, x0 + pw - 200, H - 52, 170, 17, { color: p.fig, h: 14 });
      }
    });
    if (f === 0 || f === 2 || f === 4) flash(ctx, 0.25);
  }

  // ------------------------------------------------------------------ CUT 05
  const RING_TXT = [...'NO BRAKES • NO LIMITS • NO BRAKES • NO LIMITS • '];
  function cut05(ctx, f, n, F) {
    if (f < 18) {
      rect(ctx, 0, 0, W, H, C.cobalt);
      halftone(ctx, 0, 0, W, H, 24, C.cobaltL, (u, v) => v * v * 0.95);
      speedLines(ctx, Math.floor(f / 2), 5, { count: 14, color: C.cobaltL, alpha: 0.9, len: [400, 1000], thick: [3, 9] });
      const cx = 960, cy = 560, rx = 720, ry = 200, tilt = -0.2, a0 = 1.2 + f * 0.055;
      const scat = E.outCubic(k(f, 11, 17.5));
      const items = RING_TXT.map((ch, i) => ({ ch, i, a: a0 - (i / RING_TXT.length) * TAU }));
      const drawChar = it => {
        const z = Math.sin(it.a), sxx = Math.sin(it.a);
        if (Math.abs(sxx) < 0.08 || it.ch === ' ') return;
        let x = Math.cos(it.a) * rx, y = Math.sin(it.a) * ry;
        const dx = x * 0.9 + (rnd(it.i) - 0.5) * 900, dy = y * 0.9 - 300 - rnd(it.i + 9) * 600;
        x += dx * scat; y += dy * scat;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(tilt); ctx.translate(x, y);
        ctx.rotate((rnd(it.i + 3) - 0.5) * 6 * scat);
        const sc = lerp(0.6, 1.15, (z + 1) / 2);
        ctx.scale(sxx * sc, sc);
        ctx.globalAlpha = 1 - scat * 0.5;
        txtC(ctx, it.ch, 0, -40, 190, { color: z >= 0 ? C.white : C.ice });
        ctx.restore();
      };
      items.filter(it => Math.sin(it.a) < 0).forEach(drawChar);
      // her: slow-motion mid-air spin through the ring
      const u = f / 17, sp = u * TAU * 0.85;
      let sxv = Math.cos(sp); sxv = Math.sign(sxv || 1) * Math.max(0.2, Math.abs(sxv));
      drawAO(ctx, lerp(700, 1200, u), lerp(660, 470, u) - Math.sin(u * Math.PI) * 60, 90, POSES.spin, { sx: sxv, R: lerp(-15, 22, u), flare: 0.9, time: sec(F) * 0.3 });
      items.filter(it => Math.sin(it.a) >= 0).forEach(drawChar);
      mono(ctx, 'SLOW-MO 25%', 70, 60, 22, { color: C.white });
      mono(ctx, 'AIR TIME ' + (0.42 + f * 0.01).toFixed(2) + 'S', 70, 92, 18, { color: C.ice });
    } else {
      rect(ctx, 0, 0, W, H, C.ice);
      zoomLines(ctx, 960, 470, f, 9, { color: C.white, inner: 470, count: 80 });
      const z = lerp(0.42, 1, E.outExpo(k(f, 18, 21))) * (1 + (f - 18) * 0.008);
      drawFaceCU(ctx, 960, 470, 300 * z, { smirk: 1, time: sec(F), rot: -0.05, look: [0, 0.05] });
      if (f >= 19) {
        brackets(ctx, 540, 90, 840, 820, 70, 9, C.black);
        mono(ctx, 'STATUS: LOCKED IN', 1410, 120, 22, { color: C.black });
        mono(ctx, 'AO', 1410, 152, 60, { color: C.cobalt, font: FONT_WIDE, track: 0 });
        barcode(ctx, 1410, 900, 260, 50, 55, C.black);
      }
      if (f === 18) flash(ctx, 0.85);
    }
  }

  // ------------------------------------------------------------------ CUT 06
  function cut06(ctx, f, n, F) {
    const sh = shakeSum(f, [[8, 22, 5]]);
    rect(ctx, 0, 0, W, H, C.paper);
    ctx.save(); ctx.translate(sh[0], sh[1]);
    ctx.strokeStyle = C.black; ctx.lineWidth = 3; ctx.strokeRect(50, 50, W - 100, H - 100);
    mono(ctx, 'AO — ISSUE N°06', 80, 74, 22, { color: C.black });
    mono(ctx, 'SS/26 · STREET EDITION', W - 80, 74, 22, { color: C.black, align: 'right' });
    mono(ctx, '— 06 —', W / 2, H - 92, 20, { color: C.black, align: 'center' });
    for (let i = 0; i < 6; i++) rect(ctx, 1500, 150 + i * 22, 300 - (i === 5 ? 120 : (i * 37) % 60), 8, C.silver);
    barcode(ctx, 80, 940, 220, 50, 66, C.black);
    // the word compresses like a spring under her hand
    let sy = 1;
    if (f >= 8 && f < 11) sy = lerp(1, 0.74, E.outCubic(k(f, 8, 11)));
    else if (f >= 11) { const d = f - 11; sy = 1 - 0.26 * Math.cos(d * 0.95) * Math.exp(-d * 0.33); }
    const sx = 1 + (1 - sy) * 0.25, base = 900, size = 660;
    const m = measure(ctx, 'JUMP', size, FONT_BIG, 6), mJ = measure(ctx, 'J', size, FONT_BIG);
    const wx = 1020, left = wx - (m.w * sx) / 2;
    band(ctx, 360, 1000, 1760, 230, 130, C.cobalt);
    ctx.save(); ctx.translate(wx, base); ctx.scale(sx, sy); txt(ctx, 'JUMP', 0, 0, size, { color: C.black, track: 6 }); ctx.restore();
    band(ctx, 360, 1000, 1760, 230, 12, C.paper);
    const hx = left + mJ.w * 0.62 * sx, topY = base - m.asc * sy;
    // her
    const s = 76;
    const pose = (ff) => {
      if (ff < 5) return runPose(ff * 1.3);
      if (ff < 8) return mix(runPose(5 * 1.3), POSES.vaultIn, E.outCubic(k(ff, 5, 8)));
      if (ff < 15) { const u = k(ff, 8, 15); return u < 0.5 ? mix(POSES.vaultIn, POSES.vault, u * 2) : mix(POSES.vault, POSES.vaultOut, (u - 0.5) * 2); }
      return mix(POSES.vaultOut, POSES.land, E.outCubic(k(ff, 15, 21)));
    };
    const p = pose(f);
    const R = f < 8 ? 0 : f < 15 ? lerp(-6, 14, k(f, 8, 15)) : 14;
    const hand = J => [J.aF.W[0] + Math.cos(J.aF.wa * Math.PI / 180) * 0.1, J.aF.W[1] + Math.sin(J.aF.wa * Math.PI / 180) * 0.1];
    const vaultRoot = (ff, pp, RR) => { const off = jointWorld(0, 0, s, pp, { R: RR }, hand); return [hx - off[0], topY + 6 - off[1]]; };
    let x, y;
    if (f < 5) { x = lerp(-240, hx - 520, f / 5); y = base - footDepth(p) * s; }
    else if (f < 8) {
      const a = [hx - 520, base - footDepth(p) * s], b = vaultRoot(8, POSES.vaultIn, -6), u = E.outCubic(k(f, 5, 8));
      x = lerp(a[0], b[0], u); y = lerp(a[1], b[1], u) - Math.sin(u * Math.PI) * 40;
    } else if (f < 15) { [x, y] = vaultRoot(f, p, R); }
    else {
      const [x0, y0] = vaultRoot(15, POSES.vaultOut, 14), dt = (f - 15) / FPS;
      x = x0 + 2600 * dt; y = Math.min(base - footDepth(p) * s, y0 - 300 * dt + 3600 * dt * dt);
    }
    speedLines(ctx, f, 6, { count: 12, color: C.silver, alpha: 0.6, y: 300, h: 600 });
    drawAO(ctx, x, y, s, p, { R: f >= 8 ? R : 0, flare: f >= 8 ? 1 : 0.5, time: sec(F) });
    if (f >= 8 && f < 13) { // impact ticks around the planted hand
      ctx.save(); ctx.translate(hx, topY); ctx.fillStyle = C.cobalt;
      for (let i = 0; i < 9; i++) { ctx.save(); ctx.rotate(Math.PI + (i / 8) * Math.PI); ctx.fillRect(40 + (f - 8) * 16, -3, 40, 6); ctx.restore(); }
      ctx.restore();
    }
    ctx.restore();
    if (f === 0) flash(ctx, 0.6);
  }

  // ------------------------------------------------------------------ CUT 07
  const S7 = { x1: -100, y1: 960, x2: 2020, y2: 330 };
  const s7y = x => S7.y1 + ((x - S7.x1) * (S7.y2 - S7.y1)) / (S7.x2 - S7.x1);
  function flipState(u) {
    let p;
    if (u < 0.18) p = mix(POSES.takeoff, POSES.open, u / 0.18);
    else if (u < 0.32) p = mix(POSES.open, POSES.tuck, (u - 0.18) / 0.14);
    else if (u < 0.72) p = POSES.tuck;
    else p = mix(POSES.tuck, POSES.land, (u - 0.72) / 0.28);
    const s = 70, x = lerp(330, 1520, u), y = s7y(x) - footDepth(POSES.stand) * s * 0.92 - Math.sin(u * Math.PI) * 190;
    return { p, x, y, s, R: -360 * u };
  }
  function cut07(ctx, f, n, F) {
    rect(ctx, 0, 0, W, H, C.ice);
    halftone(ctx, 1100, 0, 820, 520, 22, C.iceD, (a, b) => a * (1 - b));
    halftone(ctx, 0, 620, 800, 460, 22, C.white, (a, b) => b * (1 - a));
    const sw = 270, ang = Math.atan2(S7.y2 - S7.y1, S7.x2 - S7.x1);
    const nx = -Math.sin(ang) * sw / 2, ny = Math.cos(ang) * sw / 2;
    const stripe = [[S7.x1 + nx, S7.y1 + ny], [S7.x2 + nx, S7.y2 + ny], [S7.x2 - nx, S7.y2 - ny], [S7.x1 - nx, S7.y1 - ny]];
    poly(ctx, stripe, C.black);
    ctx.save(); ctx.translate(960, 540); ctx.rotate(ang);
    speedLines(ctx, f, 7, { x: -1200, y: -120, w: 2400, h: 240, count: 14, color: C.silverD, alpha: 0.7, thick: [2, 4] });
    ctx.restore();
    const u = E.inOut(k(f, 2, 20));
    // giant outlined FLIP rotating 180° in sync: black outside the stripe, white inside it
    const flipText = col => txtC(ctx, 'FLIP', 960, 520, 720, { color: null, stroke: col, lw: 9, rot: Math.PI * u, track: 8 });
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); stripe.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); ctx.clip('evenodd'); flipText(C.black); ctx.restore();
    ctx.save(); ctx.beginPath(); stripe.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); ctx.clip(); flipText(C.white); ctx.restore();
    // stroboscopic ghosts
    [[0.27, C.cobalt], [0.5, C.white], [0.73, C.silver]].forEach(([ug, col], i) => {
      if (u < ug) return;
      const g = flipState(ug), pop = f - Math.floor(2 + 18 * ug);
      drawAO(ctx, g.x, g.y, g.s, g.p, { dir: -1, R: g.R, mono: col, alpha: 0.88 });
      if (pop >= 0 && pop < 2) ring(ctx, g.x, g.y - 60, 140 + pop * 60, 6, col);
    });
    const st = flipState(u);
    drawAO(ctx, st.x, st.y, st.s, st.p, { dir: -1, R: st.R, flare: 0.9, time: sec(F) });
    mono(ctx, 'ROT ' + String(Math.round(360 * u)).padStart(3, '0') + '°', 70, 60, 34, { color: C.black, track: 4 });
    ticks(ctx, 70, 110, 360, 36, { color: C.black, h: 14, major: 9 });
    rect(ctx, 70, 132, 360 * u, 6, C.cobalt);
    mono(ctx, 'BACKFLIP / 07', W - 70, H - 80, 20, { color: C.black, align: 'right' });
    if (f === 0) flash(ctx, 0.5);
  }

  // ------------------------------------------------------------------ CUT 08
  const WORDS = [
    { w: 'COOL', bg: C.white, fg: C.black, fl: C.cobalt },
    { w: 'FAST', bg: C.black, fg: C.white, fl: C.white },
    { w: 'CLEAN', bg: C.cobalt, fg: C.white, fl: C.white },
    { w: 'BLUE', bg: C.ice, fg: C.cobalt, fl: C.white },
  ];
  function cut08(ctx, f, n, F) {
    const i = Math.min(3, Math.floor(f / 6)), d = f - i * 6, Wd = WORDS[i];
    const sh = impact(f, i * 6, 36, 5);
    rect(ctx, 0, 0, W, H, Wd.bg);
    ctx.save(); ctx.translate(sh[0], sh[1]);
    const s = lerp(1.7, 1, E.outExpo(k(d, 0, 2))) * (1 + d * 0.012), size = Wd.w.length > 4 ? 700 : 840;
    txtC(ctx, Wd.w, 960, 440, size, { color: null, stroke: Wd.fg, lw: 4, sx: s * 1.22, sy: s * 1.22, alpha: 0.3, track: 4 });
    txtC(ctx, Wd.w, 960, 440, size, { color: Wd.fg, sx: s, sy: s, track: 4 });
    mono(ctx, '0' + (i + 1) + '/04', 70, 60, 28, { color: Wd.fg });
    ticks(ctx, 70, 104, 300, 30, { color: Wd.fg, h: 14 });
    barcode(ctx, W - 380, 70, 310, 56, 80 + i, Wd.fg, 'AO-KINETIC-0' + (i + 1));
    ctx.restore();
    // knee slide across the foreground
    const s8 = 120, x = lerp(1760, 360, E.outCubic(f / 24)), pose = POSES.knee, y = 1050 - footDepth(pose) * s8;
    // frost burst from the sneakers
    const r = rng(808);
    for (let sf = 0; sf <= f; sf++) {
      const pos = [jointWorld(lerp(1760, 360, E.outCubic(sf / 24)), y, s8, pose, { dir: -1 }, J => J.lB.A), jointWorld(lerp(1760, 360, E.outCubic(sf / 24)), y, s8, pose, { dir: -1 }, J => J.lF.A)];
      for (let j = 0; j < 9; j++) {
        const src = pos[j % 2], vx = 150 + r() * 900, vy = -(150 + r() * 800), sz = 6 + r() * 16, kind = r(), col = r() < 0.5 ? C.white : C.ice2;
        const age = (f - sf) / FPS;
        if (age > 0.4) continue;
        const px = src[0] + 40 + vx * age, py = src[1] + 20 + vy * age + 1400 * age * age, a = 1 - age / 0.4, z = sz * (0.5 + a * 0.5);
        ctx.save(); ctx.globalAlpha = a; ctx.translate(px, py); ctx.rotate(Math.PI / 4);
        if (kind < 0.6) poly(ctx, [[0, -z], [z * 0.4, 0], [0, z], [-z * 0.4, 0]], col);
        else { rect(ctx, -z, -2, z * 2, 4, col); rect(ctx, -2, -z, 4, z * 2, col); }
        ctx.restore();
      }
    }
    drawAO(ctx, x, y, s8, pose, { dir: -1, flare: 1, time: sec(F) * 1.5 });
    speedLines(ctx, f, 8, { y: 740, h: 340, count: 10, color: i === 0 ? C.silver : C.white, alpha: 0.6 });
    if (d === 0) flash(ctx, 0.75, Wd.fl);
  }

  // ------------------------------------------------------------------ CUT 09
  function cut09(ctx, f, n, F) {
    const fz = Math.min(f, 12);
    rect(ctx, 0, 0, W, H, C.black);
    const T = lerp(0.62, 0.0, E.inOut(k(fz, 0, 11))), F3 = 760, camY = 0.3, zh = 2.6, X0 = 1.25;
    const Xw = yy => X0 + (yy + 1.6) * Math.tan(T);
    const pr = (X, Y, Z) => [960 + (F3 * X) / Z, 600 - (F3 * (Y - camY)) / Z];
    ctx.save(); ctx.translate(960, 540); ctx.rotate(-0.05 + fz * 0.004); ctx.translate(-960, -540);
    ctx.strokeStyle = C.white; ctx.lineCap = 'butt';
    for (let zi = 0; zi <= 26; zi++) { // lines across the wall at constant depth
      const z = 1.6 + zi * 0.6; ctx.globalAlpha = clamp(1.2 - zi / 26); ctx.lineWidth = zi % 5 ? 1.5 : 3;
      ctx.beginPath(); const a = pr(Xw(-1.6), -1.6, z), b = pr(Xw(9), 9, z); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      ctx.beginPath(); const c = pr(-6, -1.6, z); ctx.moveTo(c[0], c[1]); ctx.lineTo(a[0], a[1]); ctx.stroke();
    }
    for (let yi = 0; yi <= 18; yi++) { // lines along the wall at constant height
      const yy = -1.6 + yi * 0.6; ctx.globalAlpha = 0.9; ctx.lineWidth = yi % 5 ? 1.5 : 3;
      ctx.beginPath(); const a = pr(Xw(yy), yy, 1.6), b = pr(Xw(yy), yy, 17.2); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    for (let xi = 0; xi <= 12; xi++) { const xx = -6 + xi * 0.6; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.5; ctx.beginPath(); const a = pr(xx, -1.6, 1.6), b = pr(xx, -1.6, 17.2); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    ctx.globalAlpha = 1;
    // her: run up the wall, kick off, freeze
    const s = 66;
    let p, R, x, y;
    const contact = yy => pr(Xw(yy), yy, zh);
    const wallR = () => { const dx = Math.tan(T), nx = 1, ny = dx, l = Math.hypot(nx, ny); return Math.atan2(-nx / l, ny / l) * 180 / Math.PI; };
    if (fz < 9) {
      const yy = lerp(-1.2, 0.9, fz / 9), c = contact(yy); p = runPose(fz * 1.4); R = wallR();
      const dd = footDepth(p) * s, rr = R * Math.PI / 180; x = c[0] + Math.sin(rr) * dd; y = c[1] - Math.cos(rr) * dd;
    } else {
      const u = E.outCubic(k(fz, 9, 12)), c = contact(0.9), p0 = runPose(9 * 1.4), R0 = wallR();
      const dd = footDepth(p0) * s, rr = R0 * Math.PI / 180;
      x = c[0] + Math.sin(rr) * dd - 360 * u; y = c[1] - Math.cos(rr) * dd - 40 * u;
      p = mix(p0, POSES.hang, u); R = lerp(R0, -12, u);
    }
    ctx.restore();
    const ctr = jointWorld(x, y, s, p, { R }, J => [J.S[0] * 0.55, J.S[1] * 0.55]);
    // ---- target lock
    if (f >= 13) {
      const sc = lerp(1.9, 1, E.outExpo(k(f, 13, 15))), r0 = 290 * sc;
      circle(ctx, ctr[0], ctr[1], r0, C.cobalt);
      ring(ctx, ctr[0], ctr[1], r0 - 30, 2, C.ice);
    }
    speedLines(ctx, fz, 9, { count: 18, color: C.white, alpha: f >= 12 ? 0.25 : 0.5, x: 0, y: 0, w: W, h: H, len: [80, 260], thick: [2, 3] });
    drawAO(ctx, x, y, s, p, { R, flare: 0.9, time: sec(192 + fz) });
    if (f >= 13) {
      const sc = lerp(1.9, 1, E.outExpo(k(f, 13, 15))), r0 = 290 * sc;
      ctx.save(); ctx.translate(ctr[0], ctr[1]); ctx.fillStyle = C.white;
      for (let i = 0; i < 72; i++) { ctx.save(); ctx.rotate((i / 72) * TAU + (f - 13) * 0.01); ctx.fillRect(r0 + 14, -1.5, i % 6 ? 14 : 34, 3); ctx.restore(); }
      rect(ctx, -r0 - 80, -2, 70, 4, C.white); rect(ctx, r0 + 10, -2, 70, 4, C.white);
      rect(ctx, -2, -r0 - 80, 4, 70, C.white); rect(ctx, -2, r0 + 10, 4, 70, C.white);
      ctx.restore();
      brackets(ctx, ctr[0] - r0 - 60, ctr[1] - r0 - 60, (r0 + 60) * 2, (r0 + 60) * 2, 60, 7, C.white);
      const tk = Math.min(f - 13, 6);
      const lx = Math.min(ctr[0] + r0 + 110, W - 420), ly = ctr[1] - 160;
      mono(ctx, 'TARGET LOCK', lx, ly, 34, { color: C.white, font: FONT_BIG, track: 4 });
      mono(ctx, 'ID      AO-01', lx, ly + 60, 20, { color: C.ice });
      mono(ctx, 'ALT     ' + (5.1 + tk * 0.18).toFixed(2) + 'M', lx, ly + 90, 20, { color: C.ice });
      mono(ctx, 'AIR     ' + (0.3 + tk * 0.02).toFixed(2) + 'S', lx, ly + 120, 20, { color: C.ice });
      mono(ctx, 'SPD     ' + (32 + tk) + 'KM/H', lx, ly + 150, 20, { color: C.ice });
      barcode(ctx, lx, ly + 200, 240, 40, 909, C.white);
    }
    mono(ctx, f >= 12 ? '❚❚ FREEZE' : '▶ WALL RUN', 70, 60, 24, { color: f >= 12 ? C.ice : C.white });
    if (f === 12) flash(ctx, 0.7);
    if (f === 13) flash(ctx, 0.3, C.cobalt);
  }

  // ------------------------------------------------------------------ CUT 10
  const PANES = [C.cobalt, C.white, C.ice, C.black, C.cobalt];
  const LETTERS = [['A', C.black, 380], ['O', C.cobalt, 640], ['A', C.white, 1000], ['O', C.white, 1560]];
  const tone = c => (c === C.white ? C.silverL : c === C.black ? '#1b1f2a' : c === C.ice ? C.ice2 : C.cobaltL);
  const PANE_SHARDS = PANES.slice(0, 4).map((c, i) => makeRectShards(100 + i, -60, -60, W + 120, H + 120, 7, 5, [c, c, tone(c)], 960, 560));
  function cut10Scene(ctx, f, F) {
    const i = clamp(Math.floor(f / 5) + 1, 1, 4);
    const bg = PANES[i], [L, lc, ls] = LETTERS[i - 1];
    rect(ctx, 0, 0, W, H, bg);
    const lu = (f - (i - 1) * 5) / 5;
    txtC(ctx, L, 960, 540, ls, { font: FONT_WIDE, color: lc, sx: 0.9 + lu * 0.12, sy: 0.9 + lu * 0.12 });
    zoomLines(ctx, 960, 560, f, 10, { color: tone(bg), inner: 260, count: 50, alpha: 0.9 });
    const s = 26 * Math.pow(1.115, f), R = 112 + f * 1.2, rr = R * Math.PI / 180;
    const hd = [Math.sin(rr), -Math.cos(rr)];
    drawAO(ctx, 960 - hd[0] * 3.1 * s, 580 - hd[1] * 3.1 * s, s, POSES.dive, { R, flare: 1, time: sec(F) });
    for (let j = 0; j < i; j++) {
      const u = (f - j * 5) / 7;
      if (u >= 0 && u < 1.2) drawShards(ctx, PANE_SHARDS[j], u, { grow: 3.2 });
    }
    if (f % 5 === 0 && f < 20) flash(ctx, 0.35);
    mono(ctx, 'PANE 0' + i + '/04', 70, 60, 22, { color: bg === C.white || bg === C.ice ? C.black : C.white });
  }
  function cut10(ctx, f, n, F) {
    if (f < 20) { cut10Scene(ctx, f, F); return; }
    const u = E.inOut(k(f, 19.5, 25.5)), sxp = lerp(-900, 2900, u);
    cut10Scene(ctx, f, F);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, Math.max(0, sxp - 380), H); ctx.clip(); poster(ctx, 0, 0, F); ctx.restore();
    speedLines(ctx, f, 101, { x: sxp - 1400, w: 1400, count: 40, color: C.white, alpha: 0.8, len: [300, 900], thick: [4, 14] });
    ctx.save(); ctx.translate(sxp, 600); ctx.rotate(-0.1); ctx.scale(1180, 1180); ctx.lineJoin = 'round'; drawSneaker(ctx, null, false); ctx.restore();
  }

  // ------------------------------------------------------------------ CUT 11 — posters
  function poster(ctx, i, d, F) {
    const pop = lerp(1.07, 1, E.outExpo(k(d, 0, 2)));
    ctx.save(); ctx.translate(960, 540); ctx.scale(pop, pop); ctx.translate(-960, -540);
    if (i === 0) {
      rect(ctx, -100, -100, W + 200, H + 200, C.cobalt);
      halftone(ctx, 1100, 0, 900, 600, 24, C.cobaltL, (a, b) => a * (1 - b));
      txt(ctx, '01', 60, 820, 900, { color: C.white, align: 'left' });
      band(ctx, 700, 1150, 1500, -80, 90, C.white);
      drawAO(ctx, 1320, 520, 92, POSES.tuck, { R: -140, flare: 1, time: sec(F) });
      barcode(ctx, 80, 900, 300, 70, 1, C.white, 'MID-FLIP');
      txt(ctx, 'MID-FLIP / AO', 1840, 980, 64, { color: C.white, align: 'right' });
    } else if (i === 1) {
      rect(ctx, -100, -100, W + 200, H + 200, C.white);
      halftone(ctx, 0, 0, 900, 500, 22, C.silverL, (a, b) => (1 - a) * (1 - b));
      txt(ctx, '02', 1880, 760, 980, { color: C.black, align: 'right' });
      rect(ctx, 0, 760, W, 120, C.cobalt);
      drawAO(ctx, 700, 760 - footDepth(POSES.slide) * 92, 92, POSES.slide, { flare: 1, time: sec(F) });
      speedLines(ctx, 3, 40, { x: 0, y: 420, w: 500, h: 320, count: 14, color: C.ice, len: [200, 500], thick: [6, 14] });
      txt(ctx, 'SLIDING', 80, 160, 120, { color: C.black, align: 'left' });
      barcode(ctx, 80, 920, 260, 60, 2, C.black, 'AO-02');
    } else if (i === 2) {
      rect(ctx, -100, -100, W + 200, H + 200, C.black);
      circle(ctx, 960, 560, 400, C.cobalt);
      txtC(ctx, '03', 960, 540, 1000, { color: null, stroke: C.ice, lw: 6 });
      halftone(ctx, 0, 760, W, 320, 20, C.iceD, (a, b) => b);
      drawAO(ctx, 960, 900 - footDepth(POSES.land) * 100, 100, POSES.land, { flare: 0.8, time: sec(F) });
      txt(ctx, 'LANDING', 80, 140, 90, { color: C.white, align: 'left' });
      mono(ctx, 'IMPACT 2.4G  ·  03/04', 80, 160, 20, { color: C.ice });
      ticks(ctx, 1500, 120, 340, 34, { color: C.white, h: 16 });
    } else {
      rect(ctx, -100, -100, W + 200, H + 200, C.ice);
      txt(ctx, '04', 1880, 560, 640, { color: C.cobalt, align: 'right' });
      for (let j = 0; j < 5; j++) rect(ctx, 0, 840 + j * 26, W, 10, C.silver);
      txt(ctx, 'A', 70, 470, 420, { font: FONT_WIDE, color: C.black, align: 'left' });
      txt(ctx, 'O', 70, 900, 420, { font: FONT_WIDE, color: C.black, align: 'left' });
      drawAO(ctx, 980, 1000 - footDepth(POSES.pockets) * 110, 110, POSES.pockets, { flare: 0.25, time: sec(F) });
      barcode(ctx, 1500, 920, 320, 70, 4, C.black, 'HANDS IN POCKETS');
    }
    ctx.restore();
  }
  function cut11(ctx, f, n, F) {
    const i = Math.min(3, Math.floor(f / 6));
    poster(ctx, i, f - i * 6, F);
    if (f % 6 === 0 && f > 0) flash(ctx, 0.5);
  }

  // ------------------------------------------------------------------ CUT 12 — hero lockup
  function cut12(ctx, f, n, F) {
    const sh = shakeSum(f, [[5, 30, 7], [6, 14, 5], [40, 20, 5]]);
    rect(ctx, 0, 0, W, H, C.white);
    const push = 1 + E.inOut(k(f, 14, 46)) * 0.1;
    ctx.save(); ctx.translate(960 + sh[0], 560 + sh[1]); ctx.scale(push, push); ctx.translate(-960, -560);
    halftone(ctx, 0, 0, W, H, 26, C.silverL, (a, b) => clamp(Math.hypot(a - 0.5, (b - 0.5) * 0.6) * 1.4 - 0.2));
    // AO assembles behind her
    if (f >= 14) {
      const u = E.outExpo(k(f, 14, 18));
      txtC(ctx, 'A', lerp(-500, 520, u), 500, 820, { font: FONT_WIDE, color: C.black });
      txtC(ctx, 'O', lerp(2400, 1400, u), 500, 820, { font: FONT_WIDE, color: C.black });
    }
    if (f >= 6) circle(ctx, 960, 480, 400 * lerp(2.4, 1, E.outExpo(k(f, 6, 9))), C.cobalt);
    if (f >= 9) rect(ctx, 0, 150, W * E.outExpo(k(f, 9, 13)), 56, C.black);
    if (f >= 11) { const b = E.outExpo(k(f, 11, 15)); rect(ctx, W * (1 - b), 800, W * b, 30, C.black); }
    if (f >= 16) ring(ctx, 960, 480, 440, 3, C.black);
    // her
    const ground = 1000, s = 104;
    let p, y;
    if (f < 5) { p = POSES.land; y = lerp(-700, ground - footDepth(POSES.land) * s, E.inCubic(k(f, 0, 5))); }
    else {
      const u = E.inOut(k(f, 7, 16));
      p = mix(POSES.land, POSES.hero, u);
      y = ground - footDepth(p) * s;
    }
    if (f >= 5 && f < 12) { // landing shockwave + frost
      const u = k(f, 5, 12);
      ctx.save(); ctx.globalAlpha = 1 - u; ctx.strokeStyle = C.ice; ctx.lineWidth = 14 * (1 - u) + 2;
      ctx.beginPath(); ctx.ellipse(960, ground, 120 + u * 900, 20 + u * 120, 0, 0, TAU); ctx.stroke(); ctx.restore();
    }
    const look = f > 26 ? 1 : 0, blink = f >= 34 && f <= 35 ? 1 : 0;
    drawAO(ctx, 960, y, s, p, { flare: f < 12 ? 1 : 0.25, time: sec(F) * 0.6, blink, look: [0.3 * look, 0] });
    // UI
    if (f >= 18) {
      ticks(ctx, 70, 60, 520, 40, { color: C.black, h: 18 });
      mono(ctx, 'CHARACTER 001 — AO', 70, 92, 22, { color: C.black });
      mono(ctx, 'ICE BLUE · COBALT · WHITE · SILVER · BLACK', 70, 124, 16, { color: C.silverD });
      barcode(ctx, 1520, 60, 330, 66, 1212, C.black, 'AO-REVEAL-0001');
    }
    ctx.restore();
    // tagline ticker
    if (f >= 26) {
      const words = ['COOL.', 'FAST.', 'CLEAN.', 'BLUE.'], m = Math.min(4, Math.floor((f - 26) / 3) + 1);
      rect(ctx, 0, H - 92, W, 92, C.black);
      txt(ctx, words.slice(0, m).join('  '), 70, H - 26, 64, { color: C.white, align: 'left', track: 4 });
      mono(ctx, 'NO BRAKES / NO LIMITS', W - 70, H - 60, 22, { color: C.ice, align: 'right' });
    }
    if (f === 5) flash(ctx, 0.5, C.ice);
    if (f === 40) flash(ctx, 0.55, C.ice2);
  }

  // ------------------------------------------------------------------ CUT 13 — end card
  function cut13(ctx, f, n, F) {
    if (f >= 19) {
      rect(ctx, 0, 0, W, H, C.black);
      if (f < 22) { rect(ctx, 0, 538, W * (1 - k(f, 19, 22)), 4, C.ice); }
      return;
    }
    const sh = impact(f, 0, 30, 6);
    rect(ctx, 0, 0, W, H, C.white);
    ctx.save(); ctx.translate(sh[0], sh[1]);
    const cs = lerp(0.2, 1, E.outExpo(k(f, 0, 3)));
    circle(ctx, 960, 470, 330 * cs, C.cobalt);
    txtC(ctx, 'AO', 960, 470, 300 * cs, { font: FONT_WIDE, color: C.white, track: -4 });
    if (f >= 3) {
      const b = E.outExpo(k(f, 3, 7));
      rect(ctx, 960 - 500 * b, 840, 1000 * b, 64, C.black);
      if (f >= 6) txtC(ctx, 'NO BRAKES. NO LIMITS.', 960, 872, 44, { color: C.white, track: 10 });
    }
    if (f >= 5) { ticks(ctx, 660, 950, 600, 60, { color: C.black, h: 16, major: 10 }); }
    if (f >= 8) { barcode(ctx, 80, 920, 260, 60, 1313, C.black, 'AO / 2026'); mono(ctx, 'CHARACTER REVEAL — FILE 001', W - 80, 970, 20, { color: C.black, align: 'right' }); }
    ctx.restore();
    if (f === 0) flash(ctx, 0.9);
  }

  // ------------------------------------------------------------------ timeline
  const CUTS = [
    { s: 0, e: 24, tc: '0.00–1.00s', fn: cut01, title: 'Graphic slam', desc: 'Cobalt circle slams onto white, black bars wipe, UI ticks + barcode flicker, A and O punch in with impact shake.' },
    { s: 24, e: 48, tc: '1.00–2.00s', fn: cut02, title: 'Porthole eye', desc: 'The O becomes a porthole: ECU of her ice-blue eye glancing up; RGB split flash; the circle shatters into flat-colour shards.' },
    { s: 48, e: 74, tc: '2.00–3.10s', fn: cut03, title: 'Baseline slide', desc: 'Black frame, enormous white AO. She sprints in and power-slides along the baseline; speed lines, ice streaks, letter shards. Whip-pan out.' },
    { s: 74, e: 96, tc: '3.10–4.00s', fn: cut04, title: 'Strobe triptych', desc: 'Cobalt / white / ice split-screen; silhouettes in stroboscopic freeze: takeoff, tuck, landing. FULL SPEED scrolls behind.' },
    { s: 96, e: 122, tc: '4.00–5.10s', fn: cut05, title: 'Ring of type', desc: 'Slow-mo spin through a rotating ring reading NO BRAKES NO LIMITS; letters scatter; snap-zoom on her confident face.' },
    { s: 122, e: 144, tc: '5.10–6.00s', fn: cut06, title: 'JUMP vault', desc: 'White editorial card, huge black JUMP with cobalt slash. Palm planted on the J, legs whip across; the word compresses and springs back.' },
    { s: 144, e: 168, tc: '6.00–7.00s', fn: cut07, title: 'FLIP strobe', desc: 'Ice field, black diagonal stripe. Back-flip in three tinted ghost frames while outlined FLIP rotates 180° in sync.' },
    { s: 168, e: 192, tc: '7.00–8.00s', fn: cut08, title: 'Type barrage', desc: 'COOL / FAST / CLEAN / BLUE slam one per beat with shutter flashes and shake; knee slide in the foreground, frost bursting.' },
    { s: 192, e: 216, tc: '8.00–9.00s', fn: cut09, title: 'Grid lock', desc: 'White wireframe grid tilting in 3D; she runs up it, kicks off, freezes mid-air; cobalt circle stamps a target lock with UI data.' },
    { s: 216, e: 242, tc: '9.00–10.10s', fn: cut10, title: 'Pane burst', desc: 'Dive toward camera through flat panes shattering like glass shutters, each revealing a bigger A / O. Sneaker foreground wipe.' },
    { s: 242, e: 266, tc: '10.10–11.10s', fn: cut11, title: 'Poster montage', desc: 'Four full-screen posters 01–04 (mid-flip, sliding, landing, hands-in-pockets) snap past with hard cuts.' },
    { s: 266, e: 312, tc: '11.10–13.00s', fn: cut12, title: 'Hero lockup', desc: 'She drops into a hero landing and rises hands-in-pockets as the circle, bars and AO letters reassemble behind her. Slow push-in.' },
    { s: 312, e: 336, tc: '13.00–14.00s', fn: cut13, title: 'End card', desc: 'Shutter flash to the AO logo card: cobalt circle, NO BRAKES. NO LIMITS., barcode — then cut to black.' },
  ];
  const TOTAL = 336;

  function cutAt(F) { for (let i = 0; i < CUTS.length; i++) if (F < CUTS[i].e) return i; return CUTS.length - 1; }
  function render(ctx, F) {
    F = clamp(Math.floor(F), 0, TOTAL - 1);
    const i = cutAt(F), c = CUTS[i];
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    c.fn(ctx, F - c.s, c.e - c.s, F);
    ctx.restore();
    return i;
  }

  // ------------------------------------------------------------------ audio (synthesised, beat-locked to the cuts)
  function audioEvents() {
    const ev = [], add = (t, type, a = {}) => ev.push(Object.assign({ t, type }, a));
    const slow = t => t >= 4.0 && t < 5.1;
    for (let b = 0; b * 0.5 < 13; b++) { const t = b * 0.5; if (slow(t) && b % 2) continue; add(t, 'kick', { v: 0.9 }); }
    for (let i = 0; i * 0.25 + 0.125 < 13; i++) { const t = i * 0.25 + 0.125; if (slow(t)) continue; add(t, 'hat', { v: i % 2 ? 0.55 : 0.85 }); }
    const pat = [41.2, 82.4, 41.2, 73.4, 41.2, 82.4, 49, 55];
    for (let i = 0; i * 0.25 < 11.1; i++) { const t = i * 0.25; if (slow(t) || t < 1) continue; add(t, 'bass', { f: pat[i % 8], d: 0.22 }); }
    add(4.0, 'bass', { f: 41.2, d: 1.1 });
    CUTS.forEach((c, i) => { if (i) add(c.s / FPS, 'hit', { v: 0.9 }); });
    add(0.125, 'boom'); add(0.5, 'stab', { f: 330 }); add(0.708, 'stab', { f: 392 });
    add(1.4, 'whoosh', { d: 0.25 }); add(1.583, 'glitch'); add(1.667, 'shatter');
    add(2.35, 'whoosh', { d: 0.5 }); add(2.85, 'whoosh', { d: 0.25, up: 1 });
    add(4.0, 'whoosh', { d: 0.9 }); add(4.55, 'shatter', { v: 0.4 }); add(4.85, 'stab', { f: 494 });
    add(5.433, 'boom', { v: 0.6 });
    [7.0, 7.25, 7.5, 7.75].forEach((t, i) => add(t, 'slam', { f: [330, 392, 440, 494][i] }));
    add(8.5, 'glitch'); add(8.54, 'stab', { f: 659 }); add(8.54, 'boom', { v: 0.7 });
    [9.0, 9.208, 9.417, 9.625].forEach(t => add(t, 'shatter', { v: 0.7 }));
    add(9.85, 'whoosh', { d: 0.3 });
    [10.1, 10.35, 10.6, 10.85].forEach(t => add(t, 'stab', { f: 330 }));
    add(10.1, 'riser', { d: 1.0 });
    add(11.1, 'boom', { v: 1 }); add(11.31, 'hit', { v: 1 }); add(11.31, 'pad', { d: 1.7 });
    add(12.77, 'glitch'); add(13.0, 'boom', { v: 1 }); add(13.0, 'stab', { f: 659 }); add(13.79, 'tick');
    return ev.sort((a, b) => a.t - b.t);
  }

  function synth(ac, dest, when0, offset) {
    const master = ac.createGain(); master.gain.value = 0.42;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.12;
    master.connect(comp); const outG = ac.createGain(); outG.gain.value = 0.9; const clip = ac.createWaveShaper(), cv = new Float32Array(2049);
    for (let i = 0; i < cv.length; i++) cv[i] = Math.tanh((i / 1024 - 1) * 1.2) * 0.86; // soft clipper, ceiling ≈ -1.3 dBFS
    clip.curve = cv; comp.connect(outG); outG.connect(clip); clip.connect(dest);
    const r = rng(4242), nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = r() * 2 - 1;
    const env = (g, t, a, v, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
    const osc = (type, f, t, d, v, f2) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d); env(g, t, 0.003, v, d); o.connect(g).connect(master); o.start(t); o.stop(t + d + 0.05); return o; };
    const noise = (t, d, v, type, f, q = 0.7, f2 = null, attack = 0.002) => {
      const s = ac.createBufferSource(); s.buffer = nb; const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t);
      if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + d); fl.Q.value = q;
      const g = ac.createGain(); env(g, t, attack, v, d); s.connect(fl).connect(g).connect(master); s.start(t, (t * 0.37) % 1.5); s.stop(t + d + attack + 0.05);
    };
    const play = {
      kick: (t, e) => osc('sine', 170, t, 0.32, e.v || 1, 40),
      hat: (t, e) => noise(t, 0.045, 0.22 * (e.v || 1), 'highpass', 8000),
      bass: (t, e) => { const o = ac.createOscillator(), fl = ac.createBiquadFilter(), g = ac.createGain(); o.type = 'sawtooth'; o.frequency.value = e.f; fl.type = 'lowpass'; fl.frequency.setValueAtTime(900, t); fl.frequency.exponentialRampToValueAtTime(140, t + e.d); env(g, t, 0.005, 0.32, e.d); o.connect(fl).connect(g).connect(master); o.start(t); o.stop(t + e.d + 0.05); },
      hit: (t, e) => { osc('sine', 130, t, 0.4, e.v || 1, 38); noise(t, 0.28, 0.6, 'bandpass', 1600, 0.6); noise(t, 0.08, 0.4, 'highpass', 5000); },
      boom: (t, e) => { osc('sine', 62, t, 1.3, 0.9 * (e.v || 1), 28); noise(t, 0.6, 0.35 * (e.v || 1), 'lowpass', 600, 0.7, 80); },
      stab: (t, e) => { [1, 1.5, 2].forEach((m, i) => osc(i ? 'square' : 'sawtooth', e.f * m, t, 0.16, 0.07)); },
      slam: (t, e) => { play.hit(t, { v: 1 }); play.stab(t, e); noise(t, 0.12, 0.5, 'highpass', 3000); },
      whoosh: (t, e) => noise(t, e.d, 0.45, 'bandpass', e.up ? 3000 : 400, 1.2, e.up ? 300 : 4500, e.d * 0.7),
      glitch: t => { for (let i = 0; i < 6; i++) osc('square', 200 + ((i * 733) % 1800), t + i * 0.018, 0.015, 0.12); },
      shatter: (t, e) => { const v = e.v || 1; noise(t, 0.5, 0.55 * v, 'highpass', 2500); for (let i = 0; i < 7; i++) osc('sine', 2200 + ((i * 1171) % 3800), t + i * 0.025, 0.18, 0.05 * v); },
      riser: (t, e) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(880, t + e.d); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + e.d - 0.02); g.gain.linearRampToValueAtTime(0.0001, t + e.d); o.connect(g).connect(master); o.start(t); o.stop(t + e.d + 0.02); noise(t, e.d, 0.3, 'bandpass', 500, 2, 6000, e.d * 0.95); },
      pad: (t, e) => { [82.4, 164.8, 196, 246.9, 329.6].forEach((fq, i) => { const o = ac.createOscillator(), fl = ac.createBiquadFilter(), g = ac.createGain(); o.type = 'sawtooth'; o.frequency.value = fq; o.detune.value = (i % 2 ? 7 : -7); fl.type = 'lowpass'; fl.frequency.setValueAtTime(300, t); fl.frequency.exponentialRampToValueAtTime(2600, t + e.d); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06, t + 0.3); g.gain.linearRampToValueAtTime(0.0001, t + e.d); o.connect(fl).connect(g).connect(master); o.start(t); o.stop(t + e.d + 0.05); }); },
      tick: t => osc('square', 1760, t, 0.03, 0.08),
    };
    for (const e of audioEvents()) { if (e.t < offset - 0.001) continue; play[e.type](when0 + (e.t - offset), e); }
    return { stop() { try { master.disconnect(); comp.disconnect(); outG.disconnect(); clip.disconnect(); } catch (_) { /* already stopped */ } } };
  }

  async function renderAudioWav() {
    const sr = 44100, len = Math.ceil((TOTAL / FPS) * sr);
    const oac = new OfflineAudioContext(2, len, sr);
    synth(oac, oac.destination, 0, 0);
    const buf = await oac.startRendering();
    const ch = [buf.getChannelData(0), buf.getChannelData(1)], n = buf.length, out = new DataView(new ArrayBuffer(44 + n * 4));
    const ws = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); ws(8, 'WAVE'); ws(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true);
    out.setUint32(24, sr, true); out.setUint32(28, sr * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true); ws(36, 'data'); out.setUint32(40, n * 4, true);
    for (let i = 0, o = 44; i < n; i++) for (let c = 0; c < 2; c++, o += 2) out.setInt16(o, Math.max(-1, Math.min(1, ch[c][i])) * 32767, true);
    let bin = ''; const bytes = new Uint8Array(out.buffer);
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  G.AOTRAILER = { W, H, FPS, TOTAL, CUTS, render, cutAt, synth, renderAudioWav };
})(window);
