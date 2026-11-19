'use strict';
/* ------------------------------------------------------------------
   AO — the character. A posable flat-vector rig drawn entirely in code.
   One model, one palette, one set of proportions for the whole film:
   blue chin-length bob + messy bangs, ice-blue eyes, light-blue knit
   beanie, oversized white hooded windbreaker (blue drawstrings, blue
   utility pocket on the LEFT sleeve), white crop top, light-blue
   drawstring shorts with barcode tag, chunky white/blue platforms.

   Units: 1 unit ~ 1% of her height. Local space faces +x, y is down,
   origin at the pelvis. Limb angles are degrees from "straight down",
   positive = swinging forward. rot = clockwise screen rotation.
------------------------------------------------------------------- */
const AO = (() => {
  const C = {
    skin: '#ffe8dc', skinSh: '#f6c9b9', lip: '#b8616a',
    hair: '#1a6dff', hairDk: '#0c43c8', hairHi: '#6fb4ff',
    beanie: '#9bd6ff', beanieLt: '#c2e8ff', beanieDk: '#63b2ea',
    white: '#ffffff', wshade: '#dde7f2', silver: '#b9c1cc',
    blue: '#0b3bff', shorts: '#a5dbff', shortsDk: '#74bdf0',
    eye: '#9fe3ff', eyeMid: '#3aa0ee', eyeDk: '#0c4fd0',
    line: '#0a1433',
  };
  const LW = 0.42;                // outline weight (units)
  const THIGH = 21, SHIN = 20, UARM = 12.5, FARM = 11.5;
  const STAND = 49.4;             // pelvis height above ground, legs straight

  const DEF = {
    x: 0, y: 0, s: 1, rot: 0, facing: 1, spine: 0, head: 0,
    armN: [0, 10], armF: [0, 10], legN: [0, 0], legF: [0, 0],
    flare: 0, sway: 0, look: [0, 0], blink: 0, smirk: 0, hideHands: false,
  };
  const norm = p => Object.assign({}, DEF, p);

  /* ---------------- skeleton ---------------- */
  function solve(p) {
    const sp = p.spine * D2R;
    const up = [Math.sin(sp), -Math.cos(sp)], fw = [Math.cos(sp), Math.sin(sp)];
    const tf = (a, b) => [up[0] * a + fw[0] * b, up[1] * a + fw[1] * b];
    const dir = a => [Math.sin(a * D2R), Math.cos(a * D2R)];
    const J = { tf, pelvis: [0, 0], neck: tf(24, 0.5), chest: tf(15, 0), shN: tf(21.3, -2.6), shF: tf(21.3, 3.4), hipN: [-1.8, 1], hipF: [2, 1] };
    for (const s of ['N', 'F']) {
      const L = p['leg' + s], a = L[0], k = L[1], ank = L[2] == null ? k - a : L[2];
      const d1 = dir(a), d2 = dir(a - k), hip = J['hip' + s];
      const knee = [hip[0] + d1[0] * THIGH, hip[1] + d1[1] * THIGH];
      const ankle = [knee[0] + d2[0] * SHIN, knee[1] + d2[1] * SHIN];
      const fa = a - k + 90 + ank, fd = dir(fa), fn = [-fd[1], fd[0]]; // foot dir + sole normal
      J['knee' + s] = knee; J['ank' + s] = ankle; J['footA' + s] = fa;
      J['toe' + s] = [ankle[0] + fd[0] * 11 + fn[0] * 6, ankle[1] + fd[1] * 11 + fn[1] * 6];
      J['sole' + s] = [ankle[0] + fd[0] * 3 + fn[0] * 7.4, ankle[1] + fd[1] * 3 + fn[1] * 7.4];
      J['heel' + s] = [ankle[0] - fd[0] * 5 + fn[0] * 7.4, ankle[1] - fd[1] * 5 + fn[1] * 7.4];
      const A = p['arm' + s], e1 = dir(A[0]), e2 = dir(A[0] + A[1]), sh = J['sh' + s];
      const elb = [sh[0] + e1[0] * UARM, sh[1] + e1[1] * UARM];
      const wr = [elb[0] + e2[0] * FARM, elb[1] + e2[1] * FARM];
      J['elb' + s] = elb; J['wr' + s] = wr; J['hand' + s] = [wr[0] + e2[0] * 2.6, wr[1] + e2[1] * 2.6];
      J['uarm' + s] = [sh[0] + e1[0] * 6.5, sh[1] + e1[1] * 6.5];
    }
    const ha = (p.spine * 0.7 + p.head) * D2R;
    J.headA = ha;
    const hu = [Math.sin(ha), -Math.cos(ha)], hf = [Math.cos(ha), Math.sin(ha)];
    J.head = [J.neck[0] + hu[0] * 10 + hf[0] * 0.8, J.neck[1] + hu[1] * 10 + hf[1] * 0.8];
    J.headTop = [J.head[0] + hu[0] * 12, J.head[1] + hu[1] * 12];
    J.eye = [J.head[0] + hf[0] * 1.2 - hu[0] * 0.8, J.head[1] + hf[1] * 1.2 - hu[1] * 0.8];
    J.hood = tf(22, -9);
    J.tag = [J.hipN[0] + (J.kneeN[0] - J.hipN[0]) * 0.33, J.hipN[1] + (J.kneeN[1] - J.hipN[1]) * 0.33];
    J.hem = tf(-4, -6);
    return J;
  }
  /* world-space joints (for pinning hands/feet and anchoring graphics) */
  function joints(p0) {
    const p = norm(p0), J = solve(p), r = p.rot * D2R, c = Math.cos(r), s = Math.sin(r), out = {};
    for (const k in J) {
      const v = J[k]; if (!Array.isArray(v)) continue;
      const lx = v[0] * p.facing * p.s, ly = v[1] * p.s;
      out[k] = [p.x + c * lx - s * ly, p.y + s * lx + c * ly];
    }
    return out;
  }
  function pin(p, joint, tx, ty) {
    const j = joints(p)[joint];
    return Object.assign({}, p, { x: (p.x || 0) + tx - j[0], y: (p.y || 0) + ty - j[1] });
  }
  function lerpPose(a0, b0, t) {
    const a = norm(a0), b = norm(b0), o = {};
    for (const k in a) {
      if (typeof a[k] === 'number') o[k] = k === 'facing' ? (t < 0.5 ? a[k] : b[k]) : lerp(a[k], b[k], t);
      else if (Array.isArray(a[k])) {
        const n = Math.max(a[k].length, b[k].length); o[k] = [];
        for (let i = 0; i < n; i++) {
          const dflt = i === 2 ? null : 0;
          let va = a[k][i], vb = b[k][i];
          if (i === 2 && k.startsWith('leg')) { // ankle: undefined means "flat"
            if (va == null) va = a[k][1] - a[k][0];
            if (vb == null) vb = b[k][1] - b[k][0];
          }
          o[k][i] = lerp(va == null ? dflt : va, vb == null ? dflt : vb, t);
        }
      } else o[k] = t < 0.5 ? a[k] : b[k];
    }
    return o;
  }

  /* ---------------- drawing primitives ---------------- */
  let SIL = false; // silhouette pass: skip outlines/details
  function capsule(g, a, ra, b, rb) {
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1e-4, an = Math.atan2(dy, dx);
    const th = Math.acos(clamp((ra - rb) / d, -1, 1));
    g.moveTo(a[0] + Math.cos(an + th) * ra, a[1] + Math.sin(an + th) * ra);
    g.arc(a[0], a[1], ra, an + th, an - th + Math.PI * 2);
    g.arc(b[0], b[1], rb, an - th, an + th);
    g.closePath();
  }
  /* union-outlined part: stroke every sub-shape first, then fill them all */
  function part(g, fill, ...shapes) {
    if (!SIL) {
      g.lineWidth = LW * 2; g.strokeStyle = C.line;
      for (const sh of shapes) { g.beginPath(); sh(g); g.stroke(); }
    }
    g.fillStyle = fill;
    for (const sh of shapes) { g.beginPath(); sh(g); g.fill(); }
  }
  const poly = pts => g => { pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); };
  function line(g, pts, col, w) {
    if (SIL) return;
    g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    g.strokeStyle = col; g.lineWidth = w; g.stroke();
  }

  /* ---------------- sneaker ---------------- */
  function shoe(g, ankle, footA) {
    g.save();
    g.translate(ankle[0], ankle[1]); g.rotate((90 - footA) * D2R);
    const sole = g => {
      g.moveTo(-5.8, 2.4); g.lineTo(10.4, 2.4); g.quadraticCurveTo(12.9, 3.0, 12.6, 5.6);
      g.quadraticCurveTo(12.3, 7.4, 10.2, 7.4); g.lineTo(-4.6, 7.4); g.quadraticCurveTo(-6.5, 7.4, -6.4, 5.4); g.closePath();
    };
    const upper = g => {
      g.moveTo(-5.5, 2.8); g.lineTo(-5.8, -2.4); g.quadraticCurveTo(-5.6, -4.6, -3.3, -4.5); g.lineTo(-0.4, -4.2);
      g.quadraticCurveTo(2.2, -4.0, 3.3, -1.9); g.lineTo(8.6, -0.3); g.quadraticCurveTo(12.0, 0.6, 11.7, 2.8); g.closePath();
    };
    part(g, C.white, upper, sole);
    if (!SIL) {
      // blue panels
      g.save(); g.beginPath(); upper(g); g.clip();
      g.fillStyle = C.blue;
      g.beginPath(); poly([[-6, 3], [-6, -1.7], [-3.0, -1.3], [-2.1, 3]])(g); g.fill();
      g.beginPath(); poly([[0.5, 3], [2.5, -2.4], [4.3, -1.8], [2.7, 3]])(g); g.fill();
      g.fillStyle = C.beanie; g.beginPath(); poly([[8.2, 3], [8.9, -0.6], [13, 0], [13, 3]])(g); g.fill();
      g.fillStyle = C.beanie; g.fillRect(-6, -5, 6, 1.3);
      g.restore();
      g.save(); g.beginPath(); sole(g); g.clip();
      g.fillStyle = C.blue; g.fillRect(-7, 4.5, 21, 1.15);
      g.fillStyle = C.wshade; g.fillRect(-7, 6.7, 21, 1);
      g.restore();
      line(g, [[-5.6, 2.6], [11.7, 2.6]], C.line, LW * 0.8);
      for (let i = 0; i < 3; i++) line(g, [[3.9 + i * 1.5, -1.9 + i * 0.45], [3.3 + i * 1.5, -0.2 + i * 0.45]], C.silver, 0.35);
    }
    g.restore();
  }

  /* ---------------- limbs ---------------- */
  function leg(g, J, s, near) {
    const hip = J['hip' + s], knee = J['knee' + s], ank = J['ank' + s];
    part(g, near ? C.skin : C.skinSh, g => capsule(g, hip, 4.5, knee, 3.2), g => capsule(g, knee, 3.1, ank, 2.1));
    shoe(g, ank, J['footA' + s]);
    // shorts leg
    const m = [lerp(hip[0], knee[0], 0.4), lerp(hip[1], knee[1], 0.4)];
    part(g, near ? C.shorts : C.shortsDk, g => capsule(g, hip, near ? 5.6 : 5.0, m, near ? 5.3 : 4.9));
    if (near && !SIL) {
      // hem line + barcode tag
      const a = Math.atan2(knee[1] - hip[1], knee[0] - hip[0]);
      g.save(); g.translate(m[0], m[1]); g.rotate(a);
      line(g, [[3.3, -5], [3.3, 5]], C.shortsDk, 0.35);
      g.fillStyle = C.white; g.strokeStyle = C.line; g.lineWidth = 0.3;
      g.fillRect(-3.6, -3.4, 4.2, 2.8); g.strokeRect(-3.6, -3.4, 4.2, 2.8);
      g.fillStyle = C.line;
      [0, 0.5, 1.2, 1.6, 2.3, 2.9, 3.3].forEach((x, i) => g.fillRect(-3.3 + x, -3.0, i % 3 ? 0.25 : 0.4, 2.0));
      g.restore();
    }
  }
  function arm(g, J, s, near, pocket, hideHand) {
    const sh = J['sh' + s], el = J['elb' + s], wr = J['wr' + s], hd = J['hand' + s];
    if (!hideHand) part(g, near ? C.skin : C.skinSh, g => { g.moveTo(hd[0] + 2.3, hd[1]); g.arc(hd[0], hd[1], 2.3, 0, 7); });
    part(g, near ? C.white : C.wshade, g => capsule(g, sh, 4.5, el, 4.1), g => capsule(g, el, 4.1, wr, 3.5));
    if (SIL) return;
    // cuff
    const a2 = Math.atan2(wr[1] - el[1], wr[0] - el[0]);
    g.save(); g.translate(wr[0], wr[1]); g.rotate(a2);
    line(g, [[-1.6, -3.4], [-1.6, 3.4]], C.silver, 0.4);
    g.restore();
    if (pocket) {
      const a1 = Math.atan2(el[1] - sh[1], el[0] - sh[0]);
      g.save(); g.translate(sh[0], sh[1]); g.rotate(a1);
      g.fillStyle = C.blue; g.strokeStyle = C.line; g.lineWidth = 0.35;
      g.beginPath(); g.roundRect(3.2, -2.9, 6.6, 5.8, 0.7); g.fill(); g.stroke();
      line(g, [[5.3, -2.9], [5.3, 2.9]], C.line, 0.3);
      g.fillStyle = C.white; g.beginPath(); g.arc(4.2, 0, 0.5, 0, 7); g.fill();
      g.restore();
    }
  }

  /* ---------------- head ---------------- */
  function eye(g, cx, cy, w, h, od, look, open, far) {
    const hw = w / 2, I = [cx - od * hw, cy + 0.16 * h], O = [cx + od * hw, cy - 0.16 * h];
    const upC = [cx - od * 0.05 * w, cy - (0.78 * open - 0.1) * h], loC = [cx + od * 0.05 * w, cy + (0.62 * open - 0.05) * h];
    const shape = () => { g.beginPath(); g.moveTo(I[0], I[1]); g.quadraticCurveTo(upC[0], upC[1], O[0], O[1]); g.quadraticCurveTo(loC[0], loC[1], I[0], I[1]); g.closePath(); };
    if (open > 0.12) {
      g.save(); shape(); g.fillStyle = '#fff'; g.fill(); g.clip();
      const ix = cx + look[0] * w * 0.16 + (far ? 0.15 : 0.1), iy = cy - 0.02 * h + look[1] * h * 0.16;
      const rx = w * (far ? 0.36 : 0.31), ry = h * 0.56;
      g.fillStyle = C.eyeDk; g.beginPath(); g.ellipse(ix, iy, rx, ry, 0, 0, 7); g.fill();
      g.fillStyle = C.eyeMid; g.beginPath(); g.ellipse(ix, iy + ry * 0.06, rx * 0.84, ry * 0.88, 0, 0, 7); g.fill();
      g.fillStyle = C.eye; g.beginPath(); g.ellipse(ix, iy + ry * 0.3, rx * 0.74, ry * 0.64, 0, 0, 7); g.fill();
      g.fillStyle = '#dff6ff'; g.beginPath(); g.ellipse(ix, iy + ry * 0.56, rx * 0.5, ry * 0.3, 0, 0, 7); g.fill();
      g.fillStyle = C.line; g.beginPath(); g.ellipse(ix, iy + ry * 0.02, rx * 0.34, ry * 0.38, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(12,40,110,.16)'; g.fillRect(cx - w, cy - h, w * 2, h * 0.6); // lid shadow
      g.fillStyle = '#fff'; g.beginPath(); g.arc(ix - rx * 0.42, iy - ry * 0.36, rx * 0.3, 0, 7); g.fill();
      g.beginPath(); g.arc(ix + rx * 0.4, iy + ry * 0.5, rx * 0.14, 0, 7); g.fill();
      g.restore();
    }
    // lashes
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(I[0], I[1]); g.quadraticCurveTo(upC[0], upC[1], O[0], O[1]);
    g.lineTo(O[0] + od * (far ? 0.2 : 0.75), O[1] - (far ? 0.3 : 0.55) * open);
    g.strokeStyle = C.line; g.lineWidth = 0.62; g.stroke();
    if (open > 0.12) {
      const t = 0.5, q1 = [lerp(O[0], loC[0], t), lerp(O[1], loC[1], t)], q2 = [lerp(loC[0], I[0], t), lerp(loC[1], I[1], t)];
      g.beginPath(); g.moveTo(O[0], O[1]); g.quadraticCurveTo(q1[0], q1[1], lerp(q1[0], q2[0], t), lerp(q1[1], q2[1], t));
      g.lineWidth = 0.22; g.stroke();
    }
  }
  function head(g, p) {
    const open = 1 - p.blink;
    // back of the bob + far side
    part(g, C.hairDk,
      g => { g.moveTo(-2, -9.5); g.bezierCurveTo(-8.6, -9.5, -10.6, -4, -10.3, 1); g.bezierCurveTo(-10.3, 4.5, -9.9, 6.5, -8.7, 9.0); g.lineTo(-7.2, 7.5); g.lineTo(-6.0, 9.4); g.lineTo(-4.4, 7.7); g.lineTo(-3.2, 9.1); g.lineTo(-1.8, 7.0); g.lineTo(-1.5, 2); g.lineTo(4, -8); g.closePath(); },
      g => { g.moveTo(6, -7.5); g.quadraticCurveTo(9.4, -3, 8.6, 3.6); g.lineTo(7.8, 7.6); g.lineTo(7.0, 4.6); g.lineTo(6.6, 0); g.closePath(); });
    // face
    part(g, C.skin, g => {
      g.moveTo(-6.6, -7.5); g.lineTo(-6.6, 0.5); g.bezierCurveTo(-6.5, 4.2, -3.6, 7.6, 1.2, 9.4);
      g.bezierCurveTo(2.6, 9.9, 3.6, 9.5, 4.4, 8.4); g.bezierCurveTo(6.2, 6.2, 7.2, 3.6, 7.5, 0.5); g.lineTo(7.4, -7.5); g.closePath();
    });
    if (!SIL) {
      eye(g, -1.3, 1.1, 4.7, 4.0, -1, p.look, open, false);
      eye(g, 4.95, 1.0, 3.1, 3.8, 1, p.look, open, true);
      line(g, [[3.75, 4.3], [4.25, 5.1]], '#d99582', 0.32);
      g.beginPath();
      g.moveTo(2.0, 6.7 - p.smirk * 0.4); g.quadraticCurveTo(3.2, 6.82 + p.smirk * 0.12, 4.3, 6.62);
      g.strokeStyle = C.lip; g.lineWidth = 0.3; g.lineCap = 'round'; g.stroke();
    }
    // side lock + messy bangs
    part(g, C.hair,
      g => { g.moveTo(-8.8, -6); g.lineTo(-4.6, -6.6); g.bezierCurveTo(-4.3, -2, -4.9, 3, -5.6, 8.1); g.lineTo(-6.6, 6.4); g.lineTo(-7.6, 8.6); g.lineTo(-8.4, 6.7); g.lineTo(-9.5, 8.2); g.bezierCurveTo(-10.6, 3, -10.5, -2, -8.8, -6); g.closePath(); },
      g => {
        g.moveTo(-7.5, -7.4);
        [[-6.2, -0.4], [-4.9, -3.2], [-3.7, 0.5], [-2.1, -3.0], [-0.7, -0.2], [0.9, -3.4], [2.2, -0.7], [3.3, -3.6], [4.5, -1.1], [5.6, -3.8], [6.9, -1.0], [8.0, -4.5], [8.4, -7.6]].forEach(q => g.lineTo(q[0], q[1]));
        g.closePath();
      });
    if (!SIL) {
      line(g, [[-6.0, -4.6], [-4.9, -5.4], [-3.6, -4.3], [-2.2, -5.5], [-0.7, -4.4], [0.8, -5.6], [2.2, -4.5], [3.3, -5.6], [4.5, -4.7], [5.6, -5.7]], C.hairHi, 0.5);
      line(g, [[-8.3, -1], [-7.7, 3.6]], C.hairHi, 0.45);
      // brows read through the fringe
      line(g, [[-3.9, -2.75], [0.9, -2.25]], C.line, 0.3);
      line(g, [[3.7, -2.3], [6.4, -2.85]], C.line, 0.3);
    }
    // knit beanie
    part(g, C.beanie, g => { g.moveTo(-9.4, -5.2); g.bezierCurveTo(-10.4, -11.6, -5.6, -15.3, -0.9, -15.1); g.bezierCurveTo(4.8, -14.9, 9.4, -11.2, 8.9, -6.4); g.quadraticCurveTo(-0.5, -10, -9.4, -5.8); g.closePath(); });
    if (!SIL) {
      for (let i = 0; i < 6; i++) {
        const x = -7 + i * 2.9;
        g.beginPath(); g.moveTo(x, -8.5); g.quadraticCurveTo(lerp(x, -1, 0.35), -12.5, lerp(x, -1, 0.82), -14.6);
        g.strokeStyle = C.beanieDk; g.lineWidth = 0.28; g.stroke();
      }
    }
    const cuff = g => { g.moveTo(-9.8, -4.3); g.quadraticCurveTo(-0.5, -8.4, 9.1, -5.0); g.lineTo(9.2, -8.5); g.quadraticCurveTo(-0.5, -12.0, -9.9, -7.9); g.closePath(); };
    part(g, C.beanieLt, cuff);
    if (!SIL) {
      g.save(); g.beginPath(); cuff(g); g.clip();
      for (let i = 0; i < 17; i++) { const x = -9.4 + i * 1.15; line(g, [[x, -3], [x + 0.25, -12]], C.beanieDk, 0.26); }
      g.restore();
      // tiny woven label
      g.fillStyle = C.white; g.strokeStyle = C.line; g.lineWidth = 0.22;
      g.beginPath(); g.rect(-7.9, -7.6, 2.1, 1.5); g.fill(); g.stroke();
    }
  }

  /* ---------------- full figure ---------------- */
  function draw(g, p0) {
    const p = norm(p0), J = solve(p), tf = J.tf, f = p.flare;
    g.save();
    g.translate(p.x, p.y); g.rotate(p.rot * D2R); g.scale(p.facing * p.s, p.s);
    g.lineJoin = 'round'; g.lineCap = 'round';
    const leftNear = p.facing < 0; // her left side faces us when she faces screen-left

    arm(g, J, 'F', false, !leftNear, p.hideHands);
    // far front panel of the open jacket
    part(g, C.wshade, poly([tf(24, 4.2), tf(13, 7.2), tf(-5.5, 7.6 + f * 3), tf(-6, 3), tf(12, 1)]));
    leg(g, J, 'F', false);
    // torso + shorts
    part(g, C.skin, g => capsule(g, tf(1, 0), 5.2, tf(9, 0.2), 4.5), g => capsule(g, tf(9, 0.2), 4.5, tf(17, 0.3), 5.5));
    if (!SIL) line(g, [tf(8.2, 3.6), tf(9.6, 3.7)], '#d99582', 0.3);
    part(g, C.shorts, g => capsule(g, tf(-0.5, 0), 5.9, tf(3.4, 0), 5.6));
    leg(g, J, 'N', true);
    if (!SIL) {
      line(g, [tf(5.6, -5.2), tf(5.6, 5.3)], C.shortsDk, 0.4);
      const d0 = tf(4.6, 4.6), d1 = tf(4.4, 5.4);
      line(g, [d0, [d0[0] + p.sway * 2 + 0.6, d0[1] + 5]], C.white, 0.55);
      line(g, [d1, [d1[0] + p.sway * 2 + 1.6, d1[1] + 4.2]], C.white, 0.55);
    }
    // crop top
    part(g, C.white, g => {
      const a = tf(12.6, -5.7), b = tf(12.2, 6.1), c = tf(20.5, 6.0), d = tf(23.6, 2.6), e = tf(23.6, -2.4), h = tf(20.5, -5.6);
      g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.quadraticCurveTo(...tf(23.4, 5.6), d[0], d[1]); g.lineTo(e[0], e[1]); g.quadraticCurveTo(...tf(23.4, -5.4), h[0], h[1]); g.closePath();
    });
    // neck
    part(g, C.skinSh, g => capsule(g, tf(22.4, 0.5), 2.5, tf(27, 1.0), 2.3));
    // hood resting on the back
    part(g, C.wshade, g => {
      const a = tf(26.8, -1.6), b = tf(18.6, -10.4), c = tf(21.2, -0.8);
      g.moveTo(a[0], a[1]); g.bezierCurveTo(...tf(28.2, -8.8), ...tf(23.2, -14.2), b[0], b[1]); g.bezierCurveTo(...tf(17.2, -6), ...tf(19, -3), c[0], c[1]); g.closePath();
    });
    // windbreaker, near panel (worn open)
    const hemB = tf(-5.5 + f * 6, -9.6 - f * 14), hemF = tf(-6.5 + f * 2, 1.4 - f * 5);
    part(g, C.white, g => {
      const a = tf(25.4, -2.2), b = tf(14, -10.2 - f * 1.5), c = tf(16, 1.7), d = tf(24.8, 3.6);
      g.moveTo(a[0], a[1]); g.quadraticCurveTo(...tf(23.6, -9.8), b[0], b[1]); g.quadraticCurveTo(...tf(4, -11.2 - f * 6), hemB[0], hemB[1]);
      g.lineTo(hemF[0], hemF[1]); g.quadraticCurveTo(...tf(6, 2.8 - f * 2), c[0], c[1]); g.lineTo(d[0], d[1]); g.closePath();
    });
    if (!SIL) {
      // hem band, zip edge, pocket welt
      const hb2 = tf(-3.3 + f * 6, -9.9 - f * 13), hf2 = tf(-4.3 + f * 2, 1.6 - f * 5);
      line(g, [hb2, hf2], C.silver, 0.35);
      g.beginPath(); g.moveTo(...tf(24.2, 2.9)); g.lineTo(...tf(16, 1.0)); g.quadraticCurveTo(...tf(6, 2.1 - f * 2), ...tf(-5.6 + f * 2, 0.7 - f * 5));
      g.strokeStyle = C.silver; g.lineWidth = 0.4; g.stroke();
      line(g, [tf(5.5, -5.4 - f * 3), tf(1.4, -2.2 - f * 3)], C.silver, 0.4);
      // blue drawstrings
      const s0 = tf(24, 3.0), s1 = tf(23.4, 5.0);
      line(g, [s0, [s0[0] + 0.8 + p.sway * 3, s0[1] + 8.5]], C.blue, 0.7);
      line(g, [s1, [s1[0] + 1.6 + p.sway * 3, s1[1] + 7.2]], C.blue, 0.7);
      g.fillStyle = C.white; g.strokeStyle = C.line; g.lineWidth = 0.25;
      for (const q of [[s0[0] + 0.8 + p.sway * 3, s0[1] + 8.5], [s1[0] + 1.6 + p.sway * 3, s1[1] + 7.2]]) { g.beginPath(); g.rect(q[0] - 0.45, q[1] - 0.2, 0.9, 1.6); g.fill(); g.stroke(); }
    }
    // head (a raised near arm passes behind it)
    const raised = Math.abs(p.armN[0]) > 112;
    if (raised) arm(g, J, 'N', true, leftNear, p.hideHands);
    g.save();
    g.translate(J.head[0], J.head[1]); g.rotate(J.headA); g.scale(0.8, 0.8);
    head(g, p);
    g.restore();
    if (!raised) arm(g, J, 'N', true, leftNear, p.hideHands);
    g.restore();
  }

  /* flat-tint silhouette (stroboscopic ghosts, triptych) */
  function drawTint(g, p, col, alpha = 1) {
    const b = BUF_T;
    b.setTransform(1, 0, 0, 1, 0, 0); b.globalCompositeOperation = 'source-over'; b.clearRect(0, 0, W, H);
    b.setTransform(g.getTransform());
    SIL = true; draw(b, p); SIL = false;
    b.setTransform(1, 0, 0, 1, 0, 0); b.globalCompositeOperation = 'source-in'; b.fillStyle = col; b.fillRect(0, 0, W, H);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = alpha; g.drawImage(b.canvas, 0, 0); g.restore();
  }

  /* ---------------- extreme close-up eye (porthole shot) ---------------- */
  function eyeCloseup(g, cx, cy, R, look, open) {
    const u = R / 100;
    g.save(); g.translate(cx, cy); g.scale(u, u);
    g.fillStyle = C.skin; g.fillRect(-110, -110, 220, 220);
    g.fillStyle = C.skinSh; g.fillRect(-110, -110, 220, 62);          // fringe shadow
    g.beginPath(); g.ellipse(70, 96, 70, 30, -0.2, 0, 7); g.fill();      // cheek plane
    // eye geometry (near eye: outer corner on the left)
    const I = [78, 24], O = [-80, -4], upC = [-8, -8 - 66 * open], loC = [6, 14 + 50 * open];
    g.lineJoin = 'round'; g.lineCap = 'round';
    if (open > 0.1) {
      g.save();
      g.beginPath(); g.moveTo(I[0], I[1]); g.quadraticCurveTo(upC[0], upC[1], O[0], O[1]); g.quadraticCurveTo(loC[0], loC[1], I[0], I[1]); g.closePath();
      g.fillStyle = '#fff'; g.fill(); g.clip();
      const ix = -2 + look[0] * 26, iy = 12 + look[1] * 22, r = 43;
      g.fillStyle = C.line; g.beginPath(); g.arc(ix, iy, r + 3, 0, 7); g.fill();
      g.fillStyle = C.eyeDk; g.beginPath(); g.arc(ix, iy, r, 0, 7); g.fill();
      g.fillStyle = C.eyeMid; g.beginPath(); g.ellipse(ix, iy + 8, r * 0.86, r * 0.78, 0, 0, 7); g.fill();
      g.fillStyle = C.eye; g.beginPath(); g.ellipse(ix, iy + 18, r * 0.68, r * 0.5, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.4;
      for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2 + 0.1, r0 = r * 0.5, r1 = r * rr(i, 0.72, 0.93); g.beginPath(); g.moveTo(ix + Math.cos(a) * r0, iy + Math.sin(a) * r0); g.lineTo(ix + Math.cos(a) * r1, iy + Math.sin(a) * r1); g.stroke(); }
      g.strokeStyle = C.eyeDk; g.lineWidth = 2.2; g.beginPath(); g.arc(ix, iy, r * 0.6, 0, 7); g.stroke();
      g.fillStyle = C.line; g.beginPath(); g.arc(ix, iy, 16, 0, 7); g.fill();
      g.fillStyle = 'rgba(12,40,110,.2)'; g.fillRect(-120, -120, 240, 112); // upper-lid shadow
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(ix - 17, iy - 17, 12, 9, -0.5, 0, 7); g.fill();
      g.beginPath(); g.arc(ix + 19, iy + 21, 5, 0, 7); g.fill();
      g.restore();
    }
    // crease
    g.beginPath(); g.moveTo(60, 2); g.quadraticCurveTo(-10, -30 - 62 * open, -86, -22);
    g.strokeStyle = '#e3a696'; g.lineWidth = 2.4; g.stroke();
    // upper lash line + wings
    g.beginPath(); g.moveTo(I[0], I[1]); g.quadraticCurveTo(upC[0], upC[1], O[0], O[1]);
    g.strokeStyle = C.line; g.lineWidth = 10; g.stroke();
    g.fillStyle = C.line;
    for (const [dx, dy, len] of [[0, 0, 30], [10, -9, 22], [22, -16, 16]]) {
      g.beginPath(); g.moveTo(O[0] + dx + 8, O[1] + dy - 2); g.lineTo(O[0] + dx - len, O[1] + dy - 14 - len * 0.35); g.lineTo(O[0] + dx + 2, O[1] + dy + 7); g.closePath(); g.fill();
    }
    // lower lash
    if (open > 0.1) {
      const t = 0.6, q1 = [lerp(O[0], loC[0], t), lerp(O[1], loC[1], t)], q2 = [lerp(loC[0], I[0], t), lerp(loC[1], I[1], t)];
      g.beginPath(); g.moveTo(O[0], O[1]); g.quadraticCurveTo(q1[0], q1[1], lerp(q1[0], q2[0], t), lerp(q1[1], q2[1], t));
      g.lineWidth = 3; g.stroke();
    }
    // brow under the fringe
    g.beginPath(); g.moveTo(-84, -70); g.quadraticCurveTo(-20, -86, 70, -58); g.lineTo(70, -50); g.quadraticCurveTo(-20, -74, -84, -62); g.closePath();
    g.fillStyle = C.hairDk; g.fill();
    // messy bangs sweeping across the top
    g.fillStyle = C.hair; g.strokeStyle = C.line; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-130, -130);
    [[-112, -18], [-86, -66], [-62, 6], [-30, -60], [-6, -22], [22, -72], [48, -34], [70, -78], [96, -40], [130, -90], [130, -130]].forEach(q => g.lineTo(q[0], q[1]));
    g.closePath(); g.fill(); g.stroke();
    g.beginPath(); [[-108, -78], [-86, -96], [-58, -70], [-30, -98], [-2, -74], [24, -100], [50, -80], [72, -104], [100, -84]].forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])));
    g.strokeStyle = C.hairHi; g.lineWidth = 7; g.stroke();
    g.restore();
  }

  /* ---------------- pose library ---------------- */
  const P = {
    stand:   { spine: 2, head: 0, armN: [4, 12], armF: [-6, 14], legN: [-5, 3], legF: [8, 6] },
    pockets: { spine: -3, head: 2, armN: [-16, 44], armF: [-6, 30], legN: [-6, 2], legF: [7, 4], hideHands: true },
    takeoff: { spine: 8, head: -14, armN: [165, 12], armF: [185, 14], legN: [-14, 8, 48], legF: [6, 16, 50] },
    tuck:    { spine: 34, head: 26, armN: [72, 62], armF: [60, 70], legN: [112, 128, 30], legF: [102, 122, 30] },
    landing: { spine: 28, head: -24, armN: [26, 6], armF: [-52, 34], legN: [84, 122], legF: [52, 128, 30], flare: 0.6 },
    slide:   { spine: 22, head: 22, armN: [-64, 22], armF: [58, 46], legN: [34, 6, 4], legF: [80, 112, 20], flare: 0.8 },
    spin:    { spine: -10, head: -6, armN: [128, 24], armF: [-70, 34], legN: [34, 74, 30], legF: [-24, 30, 40], flare: 0.7 },
    vault:   { spine: -6, head: -22, armN: [176, 4], armF: [96, 24], legN: [38, 12, 40], legF: [-34, 58, 40], flare: 0.5 },
    knees:   { spine: -6, head: 8, armN: [-74, 18], armF: [-108, 26], legN: [38, 146, -62], legF: [52, 150, -62], flare: 1 },
    hang:    { spine: -8, head: -4, armN: [-118, 24], armF: [104, 30], legN: [84, 104, 30], legF: [-26, 16, 44], flare: 0.9 },
    dive:    { spine: 6, head: -34, armN: [172, 6], armF: [150, 18], legN: [-16, 12, 52], legF: [12, 56, 52], flare: 0.9 },
    fall:    { spine: -4, head: 10, armN: [140, 30], armF: [-120, 40], legN: [30, 60, 30], legF: [-10, 40, 40], flare: 1 },
    open:    { spine: -14, head: -16, armN: [150, 16], armF: [-150, 20], legN: [-22, 14, 46], legF: [18, 34, 46], flare: 0.8 },
  };
  function run(ph) { // ph in radians, full cycle = 2π
    const s = Math.sin(ph), kn = a => 22 + 82 * Math.pow(Math.max(0, Math.cos(a + 0.35)), 1.5);
    return {
      spine: 16, head: -10, flare: 0.7,
      legN: [10 + 46 * s, kn(ph), 10], legF: [10 - 46 * s, kn(ph + Math.PI), 10],
      armN: [-6 - 52 * s, 86], armF: [-6 + 52 * s, 86],
      y: -2.2 * Math.abs(Math.cos(ph)),
    };
  }

  return { C, STAND, draw, drawTint, joints, pin, lerpPose, eyeCloseup, shoe, P, run, norm };
})();
