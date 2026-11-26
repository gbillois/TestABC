// L'architecture : salles et pavillons à toits courbes (coins relevés, tuiles rondes, faîtages ornés), consoles (dougong)
// sous les avant-toits, poutres peintes, portes à croisillons, socles de pierre à balustrades, lanternes, bannières,
// portail, pagode, ponts. Tout est rangé par matière et fusionné : peu d'objets à dessiner.
import * as THREE from "three";
import { rng, clamp, lerp, sm, TAU, V, patch, tubeGeo, fusion, xf, M4, fillAttr, texCanvas, couleur } from "./commun.js";
import { H, PLAT_Y, platD, LAC, WY, PLAT, ILE, COLLINE } from "./monde.js";
import { PICS, centrePic, rayonPic } from "./roche.js";

const BOITE = new THREE.BoxGeometry(1, 1, 1), CYL = new THREE.CylinderGeometry(1, 1, 1, 14, 1), CYL6 = new THREE.CylinderGeometry(1, 1, 1, 6, 1), BOULE = new THREE.SphereGeometry(1, 16, 12);
export const COLLIS = [];          // boîtes pour les collisions du dragon : { x, z, hw, hd, a, y0, y1 }
export const LANTERNES = [];       // les 6 grandes lanternes à rallumer
export const LAMPIONS = [];        // petits lampions allumés (pour le halo)
export const CASCADES = [];        // départs des cascades : { p, n, larg }
export const BANNIERES = [];

// ---------- matières ----------
function matieres() {
  const tPoutre = texCanvas(512, 64, (x, w, h) => {        // poutre peinte : bandes bleu-vert, motifs en goutte, liserés d'or
    x.fillStyle = "#1d4a4c"; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) { const cx = (i + 0.5) * w / 4; x.fillStyle = "#245f3a"; x.beginPath(); x.ellipse(cx, h / 2, w / 10, h * 0.36, 0, 0, TAU); x.fill();
      x.strokeStyle = "#e7c060"; x.lineWidth = 3; x.stroke(); x.fillStyle = "#b8322a"; x.beginPath(); x.ellipse(cx, h / 2, w / 26, h * 0.18, 0, 0, TAU); x.fill(); }
    x.fillStyle = "#e7c060"; x.fillRect(0, 2, w, 3); x.fillRect(0, h - 5, w, 3);
    for (let i = 0; i < 9; i++) { x.fillStyle = "#2f7a8a"; x.fillRect(i * w / 8 - 6, 6, 12, h - 12); }
  });
  const tPorte = texCanvas(256, 512, (x, w, h) => {         // porte à croisillons : cadre rouge, treillis d'or, papier clair derrière
    x.fillStyle = "#e8d6b0"; x.fillRect(0, 0, w, h);
    x.strokeStyle = "#7a1810"; x.lineWidth = 7;
    for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(20, 30 + i * 36); x.lineTo(w - 20, 30 + i * 36 + 18); x.stroke(); x.beginPath(); x.moveTo(20, 30 + i * 36 + 18); x.lineTo(w - 20, 30 + i * 36); x.stroke(); }
    x.strokeStyle = "#d9a441"; x.lineWidth = 2.5; for (let i = 1; i < 6; i++) { x.beginPath(); x.moveTo(i * w / 6, 24); x.lineTo(i * w / 6, 330); x.stroke(); }
    x.fillStyle = "#8e1d14"; x.fillRect(0, 0, w, 20); x.fillRect(0, 330, w, 22); x.fillRect(0, h - 20, w, 20); x.fillRect(0, 0, 18, h); x.fillRect(w - 18, 0, 18, h);
    x.fillStyle = "#9e2318"; x.fillRect(18, 352, w - 36, h - 372); x.strokeStyle = "#d9a441"; x.lineWidth = 4; x.strokeRect(34, 370, w - 68, h - 410);
  });
  tPorte.wrapS = tPorte.wrapT = THREE.ClampToEdgeWrapping;
  const tPlaque = texCanvas(512, 256, (x, w, h) => {
    x.fillStyle = "#14234a"; x.fillRect(0, 0, w, h); x.strokeStyle = "#e3b04b"; x.lineWidth = 16; x.strokeRect(10, 10, w - 20, h - 20); x.lineWidth = 4; x.strokeRect(30, 30, w - 60, h - 60);
    x.fillStyle = "#f0c860"; x.font = "bold 150px 'Ma Shan Zheng', 'Songti SC', 'Noto Serif SC', serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("龍 峰", w / 2, h / 2 + 8);
  }, true, false);
  const std = (o, cle, fn) => { const m = new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true }, o)); if (fn) patch(m, fn, cle); return m; };
  const M = {
    laque: std({ roughness: 0.42, metalness: 0.02 }, "laque", s => s.f("#include <color_fragment>", `#include <color_fragment>
      diffuseColor.rgb *= 0.86 + 0.22 * vnoise(vFogW.xz * 3.0 + vFogW.y * 0.7) - 0.12 * smoothstep(0.6, 0.9, vnoise(vFogW.xy * 0.8));`)),
    pierre: std({ roughness: 0.9 }, "pierre", s => s.f("#include <color_fragment>", `#include <color_fragment>
      { vec3 p = vFogW; float n = vnoise(p.xz * 1.7 + p.y * 0.9) * 0.6 + vnoise(p.xy * 5.0 + p.z) * 0.4; diffuseColor.rgb *= 0.78 + 0.34 * n;
        vec2 q = vec2(p.x + p.z, p.y) / vec2(1.2, 0.45); q.x += floor(q.y) * 0.5; vec2 f = fract(q); diffuseColor.rgb *= mix(0.6, 1.0, smoothstep(0.0, 0.04, min(min(f.x, 1.0 - f.x) * 1.2, min(f.y, 1.0 - f.y) * 0.45)));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.18, 0.22, 0.10), smoothstep(0.65, 0.85, vnoise(p.xz * 0.9)) * 0.35 * smoothstep(1.5, 0.0, p.y - ${PLAT_Y.toFixed(1)})); }`)),
    tuile: std({ roughness: 0.38, metalness: 0.15 }, "tuile", s => {
      s.vHead("attribute vec2 aPente; varying vec2 vPente; varying vec3 vWP;");
      s.v("#include <begin_vertex>", "#include <begin_vertex>\nvPente = aPente; vWP = (modelMatrix * vec4(position, 1.0)).xyz;");
      s.fHead("varying vec2 vPente; varying vec3 vWP; float tCan, tRang;");
      s.f("#include <color_fragment>", `#include <color_fragment>
        { vec2 sd = normalize(vPente + 1e-5), ac = vec2(-sd.y, sd.x); float a = dot(vWP.xz, ac) / 0.34, b = dot(vWP.xz, sd) / 0.42;
          float fw = fwidth(a); float lod = 1.0 - smoothstep(0.35, 0.9, fw);
          float ca = fract(a); tCan = sin(ca * 6.2832); tRang = fract(b + 0.5 * step(0.5, fract(a * 0.5)));
          float rond = step(0.5, fract(a * 0.5 + 0.25));
          diffuseColor.rgb *= mix(1.0, mix(0.55, 1.15, smoothstep(-0.6, 0.8, tCan)) * mix(0.75, 1.0, smoothstep(0.0, 0.12, tRang)), lod);
          diffuseColor.rgb *= 0.9 + 0.2 * hash21(floor(vec2(a, b))); }`);
      s.f("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
        { vec2 sd = normalize(vPente + 1e-5), ac = vec2(-sd.y, sd.x); float lod = 1.0 - smoothstep(0.35, 0.9, fwidth(dot(vWP.xz, ac) / 0.34));
          vec3 da = vec3(ac.x, 0.0, ac.y) * cos(fract(dot(vWP.xz, ac) / 0.34) * 6.2832) * 0.9 + vec3(sd.x, 0.0, sd.y) * (smoothstep(0.0, 0.1, tRang) - 1.0) * 0.8;
          normal = normalize(normal + (viewMatrix * vec4(da, 0.0)).xyz * lod); }`);
    }),
    mur: std({ roughness: 0.85 }, "mur", s => s.f("#include <color_fragment>", `#include <color_fragment>
      diffuseColor.rgb *= 0.9 + 0.12 * vnoise(vFogW.xy * 1.3 + vFogW.z) - 0.15 * smoothstep(0.5, 0.95, vnoise(vec2(vFogW.x + vFogW.z, vFogW.y * 0.2) * 0.7));`)),
    or: std({ roughness: 0.3, metalness: 0.8 }),
    poutre: std({ roughness: 0.5, map: tPoutre }),
    porte: std({ roughness: 0.6, map: tPorte, emissive: new THREE.Color(0.35, 0.18, 0.07), emissiveMap: tPorte, emissiveIntensity: 0.25 }),
    plaque: new THREE.MeshStandardMaterial({ map: tPlaque, roughness: 0.4, metalness: 0.2 }),
    lampion: new THREE.MeshStandardMaterial({ color: 0xc8341f, emissive: new THREE.Color(1.0, 0.33, 0.1), emissiveIntensity: 2.6, roughness: 0.6, vertexColors: true }),
    bois: std({ roughness: 0.8 }),
    tissu: std({ roughness: 0.75, side: THREE.DoubleSide }, "tissu", s => {
      s.vHead("uniform float uTime; attribute float aFlot;");
      s.v("#include <begin_vertex>", "#include <begin_vertex>\n{ float w = aFlot; transformed.x += sin(uTime * 3.1 + position.y * 1.7 + position.x * 0.9) * 0.25 * w; transformed.z += sin(uTime * 2.3 + position.y * 2.3) * 0.35 * w; }");
    }),
  };
  M.poutre.map.wrapT = THREE.ClampToEdgeWrapping;
  return M;
}

// ---------- assemblage ----------
const PIECES = new Map();
function ajoute(cle, geo, m, col = [1, 1, 1], extra) {
  const g = xf(geo, m, col); if (window.__DEBUG) g.userData.src = new Error().stack.split('\n')[2];
  if (cle === "tuile") { if (!g.attributes.aPente) fillAttr(g, "aPente", 2, extra || [0, 1]); }
  if (cle === "tissu") fillAttr(g, "aFlot", 1, [0]);
  if (!PIECES.has(cle)) PIECES.set(cle, []); PIECES.get(cle).push(g);
}
const ROUGE = [0.50, 0.035, 0.025], ROUGE2 = [0.38, 0.03, 0.02], OR = [0.85, 0.58, 0.22], PIERRE = [0.55, 0.53, 0.49], TUILE = [0.10, 0.095, 0.09], CREME = [0.80, 0.74, 0.62], VERT = [0.10, 0.28, 0.26];
const boite = (cle, x, y, z, ry, sx, sy, sz, col, rx = 0, rz = 0) => ajoute(cle, BOITE, M4(x, y, z, rx, ry, rz, sx, sy, sz), col);
const cyl = (cle, x, y, z, r, h, col, g = CYL) => ajoute(cle, g, M4(x, y + h / 2, z, 0, 0, 0, r, h, r), col);

// toit courbe : grille sur le plan (rectangle w x d, ou polygone à nf côtés de rayon w), pente creusée, coins relevés
function toitGeo(o) {
  const N = o.N || 26, pos = [], pente = [], idx = [];
  const W = o.w / 2 + o.deb, D = o.d / 2 + o.deb, fa = Math.max(0, (o.w - o.d) / 2) * (o.faitage ?? 1);
  const haut = (x, z) => {
    let m, corner;
    if (o.nf) { const a = Math.atan2(z, x), sec = TAU / o.nf, a0 = Math.round(a / sec) * sec, rr = Math.hypot(x, z) * Math.cos(a - a0) / (o.w + o.deb); m = Math.min(1, rr); corner = Math.pow(Math.abs(Math.sin((a - a0) / sec * Math.PI)) * 0 + Math.pow(Math.abs((a - a0) / (sec / 2)), 2), 2); }
    else { const ax = Math.max(0, Math.abs(x) - fa) / D, az = Math.abs(z) / D; m = Math.min(1, Math.max(ax, az)); const u = Math.min(Math.abs(x) / W, 1), v = Math.min(Math.abs(z) / D, 1); corner = Math.pow(Math.min(u, v), 3); }
    return o.hr * Math.pow(1 - m, o.creux ?? 1.65) + o.lev * corner * Math.pow(m, 4);
  };
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    let x, z;
    if (o.nf) { const a = i / N * TAU, rr = j / N; const sec = TAU / o.nf, a0 = Math.round(a / sec) * sec, R = (o.w + o.deb) / Math.cos(a - a0); x = Math.cos(a) * R * rr; z = Math.sin(a) * R * rr; }
    else { x = (i / N * 2 - 1) * W; z = (j / N * 2 - 1) * D; }
    const y = haut(x, z); pos.push(x, y, z);
    const e = 0.05, gx = haut(x + e, z) - haut(x - e, z), gz = haut(x, z + e) - haut(x, z - e), l = Math.hypot(gx, gz) || 1; pente.push(-gx / l, -gz / l);
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("aPente", new THREE.Float32BufferAttribute(pente, 2));
  g.setIndex(idx); g.computeVertexNormals(); fillAttr(g, "uv", 2, [0, 0]);
  return { g, haut, W, D, fa };
}
// pose un toit complet (dessus, dessous, rive, faîtage, arêtiers, ornements, chevrons, consoles)
function toit(x, y, z, ry, o, kit = {}) {
  if (window.__DEBUG) { const T0 = toitGeo(o); const a = T0.g.attributes.position.array; let bad = !Number.isFinite(x + y + z + ry); for (let k = 0; k < a.length && !bad; k++) if (!Number.isFinite(a[k])) bad = true; if (bad) console.warn('NaN toit', JSON.stringify([x, y, z, ry, o])); }
  const T = toitGeo(o), m = M4(x, y, z, 0, ry, 0);
  const g = T.g.clone(); g.applyMatrix4(m); const pente = g.attributes.aPente; // la pente tourne avec le toit
  const c = Math.cos(ry), s = Math.sin(ry); for (let i = 0; i < pente.count; i++) { const px = pente.getX(i), pz = pente.getY(i); pente.setXY(i, px * c + pz * s, -px * s + pz * c); }
  ajoute("tuile", g, null, o.couleur || TUILE);
  const dessous = T.g.clone(); dessous.applyMatrix4(M4(x, y - 0.32, z, 0, ry, 0)); dessous.index.array.reverse(); dessous.computeVertexNormals(); dessous.deleteAttribute("aPente"); ajoute("bois", dessous, null, [0.22, 0.10, 0.07]);
  // rive : bande le long du bord
  const bord = [], NB = 160;
  for (let i = 0; i <= NB; i++) { let px, pz; const t = i / NB;
    if (o.nf) { const a = t * TAU, sec = TAU / o.nf, a0 = Math.round(a / sec) * sec, R = (o.w + o.deb) / Math.cos(a - a0); px = Math.cos(a) * R; pz = Math.sin(a) * R; }
    else { const P = 2 * (T.W + T.D) * 2, d = t * P, W2 = T.W * 2, D2 = T.D * 2; if (d < W2) { px = -T.W + d; pz = -T.D; } else if (d < W2 + D2) { px = T.W; pz = -T.D + d - W2; } else if (d < 2 * W2 + D2) { px = T.W - (d - W2 - D2); pz = T.D; } else { px = -T.W; pz = T.D - (d - 2 * W2 - D2); } }
    bord.push(V(px, T.haut(px, pz) - 0.12, pz).applyMatrix4(m)); }
  ajoute("bois", tubeGeo(bord, 0.2, 4), null, [0.20, 0.08, 0.05]);
  // faîtage et ornements
  if (!o.nf) {
    const lf = T.fa * 2 + 0.6, yF = y + o.hr + 0.25;
    ajoute("tuile", BOITE, M4(x, yF, z, 0, ry, 0, lf, 0.6, 0.55), [0.14, 0.12, 0.11], [1, 0]);
    boite("or", x, yF + 0.36, z, ry, lf, 0.08, 0.3, OR);
    for (const sx of [-1, 1]) {      // queues de poisson (chiwen) au bout du faîtage
      const bx = x + c * sx * lf / 2, bz = z - s * sx * lf / 2, pts = [];
      for (let k = 0; k <= 12; k++) { const t = k / 12, a = t * 4.2; pts.push(V(-sx * (0.3 * Math.sin(a) * t) * 1.2, 0.2 + t * 1.6 + 0.35 * Math.sin(a), 0).applyMatrix4(M4(bx, yF, bz, 0, ry, 0))); }
      ajoute("tuile", tubeGeo(pts, t => 0.32 * (1 - t * 0.6), 6), null, [0.15, 0.13, 0.12], [0, 1]);
      ajoute("or", BOULE, M4(pts[12].x, pts[12].y, pts[12].z, 0, 0, 0, 0.2), OR);
    }
    // arêtiers : du bout du faîtage aux coins, en suivant le toit
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const pts = []; for (let k = 0; k <= 16; k++) { const t = k / 16, px = sx * lerp(T.fa, T.W, t), pz = sz * lerp(0, T.D, t); pts.push(V(px, T.haut(px, pz) + 0.22, pz).applyMatrix4(m)); }
      ajoute("tuile", tubeGeo(pts, t => 0.24 * (1 - 0.3 * t), 5), null, [0.14, 0.12, 0.11], [0, 1]);
      const e = pts[16]; ajoute("or", BOULE, M4(e.x, e.y + 0.15, e.z, 0, 0, 0, 0.18), OR);
      // petites figures sur l'arêtier
      for (let f = 0; f < 3; f++) { const q = pts[12 - f * 1]; ajoute("tuile", BOITE, M4(q.x, q.y + 0.22, q.z, 0, ry + Math.atan2(sz, sx), 0, 0.16, 0.36, 0.22), [0.16, 0.14, 0.13], [0, 1]); }
    }
  } else {
    // pointe du pavillon
    const yT = y + o.hr; ajoute("tuile", CYL, M4(x, yT + 0.3, z, 0, 0, 0, 0.45, 0.6, 0.45), [0.14, 0.12, 0.11], [0, 1]);
    for (let k = 0; k < 4; k++) ajoute("or", BOULE, M4(x, yT + 0.8 + k * 0.45, z, 0, 0, 0, 0.42 - k * 0.07, 0.2, 0.42 - k * 0.07), OR);
    ajoute("or", CYL, M4(x, yT + 2.2, z, 0, 0, 0, 0.06, 1.6, 0.06), OR);
    for (let k = 0; k < o.nf; k++) { const a = (k + 0.5) / o.nf * TAU, R = (o.w + o.deb) / Math.cos(Math.PI / o.nf), pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14, px = Math.cos(a) * R * t, pz = Math.sin(a) * R * t; pts.push(V(px, T.haut(px, pz) + 0.2, pz).applyMatrix4(m)); }
      ajoute("tuile", tubeGeo(pts, 0.2, 5), null, [0.14, 0.12, 0.11], [0, 1]); const e = pts[14]; ajoute("or", BOULE, M4(e.x, e.y + 0.12, e.z, 0, 0, 0, 0.16), OR);
      if (kit.lampions !== false) lampion(e.x - Math.cos(a + ry) * 0.6 * 0, e.y - 1.6, e.z, 0.75); }
  }
  // consoles (dougong) et chevrons sous l'avant-toit
  if (kit.consoles !== false) {
    const per = o.nf ? 2 * Math.PI * o.w : 2 * (o.w + o.d), n = Math.round(per / 1.6);
    for (let i = 0; i < n; i++) {
      let px, pz, ang; const t = i / n;
      if (o.nf) { const a = t * TAU, sec = TAU / o.nf, a0 = Math.round(a / sec) * sec, R = o.w * 0.98 / Math.cos(a - a0); px = Math.cos(a) * R; pz = Math.sin(a) * R; ang = -a0 + Math.PI / 2; }
      else { const d = t * per; if (d < o.w) { px = -o.w / 2 + d; pz = -o.d / 2; ang = 0; } else if (d < o.w + o.d) { px = o.w / 2; pz = -o.d / 2 + d - o.w; ang = Math.PI / 2; } else if (d < 2 * o.w + o.d) { px = o.w / 2 - (d - o.w - o.d); pz = o.d / 2; ang = Math.PI; } else { px = -o.w / 2; pz = o.d / 2 - (d - 2 * o.w - o.d); ang = -Math.PI / 2; } }
      const p = V(px, 0, pz).applyMatrix4(m), a = ry + ang;
      for (let k = 0; k < 3; k++) { const sc = 0.5 + k * 0.28; ajoute("laque", BOITE, M4(p.x, y - 0.95 + k * 0.28, p.z, 0, a, 0, sc, 0.22, 0.42 + k * 0.25), k % 2 ? VERT : ROUGE); }
      ajoute("or", BOITE, M4(p.x, y - 1.2, p.z, 0, a, 0, 0.36, 0.14, 0.36), OR);
    }
    // chevrons : petites bûches qui dépassent sous la rive
    const nc = Math.round(per / 0.55);
    for (let i = 0; i < nc; i++) { const t = (i + 0.5) / nc; let px, pz, ox, oz;
      if (o.nf) { const a = t * TAU, sec = TAU / o.nf, a0 = Math.round(a / sec) * sec, R = (o.w + o.deb * 0.75) / Math.cos(a - a0); px = Math.cos(a) * R; pz = Math.sin(a) * R; ox = Math.cos(a0); oz = Math.sin(a0); }
      else { const d = t * per; if (d < o.w) { px = -o.w / 2 + d; pz = -o.d / 2 - o.deb * 0.6; ox = 0; oz = -1; } else if (d < o.w + o.d) { px = o.w / 2 + o.deb * 0.6; pz = -o.d / 2 + d - o.w; ox = 1; oz = 0; } else if (d < 2 * o.w + o.d) { px = o.w / 2 - (d - o.w - o.d); pz = o.d / 2 + o.deb * 0.6; ox = 0; oz = 1; } else { px = -o.w / 2 - o.deb * 0.6; pz = o.d / 2 - (d - 2 * o.w - o.d); ox = -1; oz = 0; } }
      const p = V(px, T.haut(px, pz) - 0.42, pz).applyMatrix4(m), wx = ox * c + oz * s, wz = -ox * s + oz * c;
      ajoute("bois", CYL6, M4(p.x, p.y, p.z, Math.PI / 2 - 0.35, Math.atan2(wx, wz), 0, 0.09, o.deb * 0.9, 0.09), [0.30, 0.12, 0.06]); }
  }
  return T;
}

function lampion(x, y, z, s = 1) {
  ajoute("lampion", BOULE, M4(x, y, z, 0, 0, 0, 0.42 * s, 0.52 * s, 0.42 * s), [1, 1, 1]);
  cyl("or", x, y + 0.48 * s, z, 0.22 * s, 0.12 * s, OR); cyl("or", x, y - 0.6 * s, z, 0.22 * s, 0.12 * s, OR);
  cyl("bois", x, y + 0.6 * s, z, 0.025, 0.7 * s, [0.2, 0.1, 0.05], CYL6);
  ajoute("lampion", CYL6, M4(x, y - 0.95 * s, z, 0, 0, 0, 0.06 * s, 0.5 * s, 0.06 * s), [1, 0.9, 0.5]);
  LAMPIONS.push(V(x, y, z));
}
function banniere(x, y, z, ry, h = 6) {
  cyl("laque", x, y, z, 0.1, h + 1, ROUGE2); ajoute("or", BOULE, M4(x, y + h + 1.1, z, 0, 0, 0, 0.18), OR);
  const g = new THREE.PlaneGeometry(1.3, 3.2, 4, 12); const p = g.attributes.position, f = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) { const u = (p.getX(i) + 0.65) / 1.3, v = (p.getY(i) + 1.6) / 3.2; p.setX(i, p.getX(i) * (0.35 + 0.65 * v)); f[i] = u * (1 - v * 0.3); }
  g.translate(0.75, 0, 0); g.setAttribute("aFlot", new THREE.BufferAttribute(f, 1));
  const gg = xf(g, M4(x, y + h - 1.8, z, 0, ry, 0), [0.95, 0.68, 0.12]); gg.setAttribute("aFlot", new THREE.BufferAttribute(f, 1));
  if (!PIECES.has("tissu")) PIECES.set("tissu", []); PIECES.get("tissu").push(gg);
}

// socle de pierre à gradins, avec escalier et balustrade
function socle(x, y, z, ry, w, d, h, o = {}) {
  const c = Math.cos(ry), s = Math.sin(ry), P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  boite("pierre", x, y + h / 2 - 3, z, ry, w, h + 6, d, PIERRE);
  boite("pierre", x, y + h - 0.12, z, ry, w + 0.4, 0.25, d + 0.4, [0.62, 0.6, 0.56]);
  // escalier devant (+z local)
  const ns = Math.max(3, Math.round(h / 0.3)), sw = o.esc ?? Math.min(w * 0.4, 8);
  for (let i = 0; i < ns; i++) { const t = i / ns, [px, pz] = P(0, d / 2 + (ns - i) * 0.42 - 0.2); boite("pierre", px, y + h * t + h / ns / 2 - 0.02, pz, ry, sw, h / ns, 0.44, PIERRE); }
  for (const sx of [-1, 1]) { const [px, pz] = P(sx * (sw / 2 + 0.3), d / 2 + ns * 0.21); boite("pierre", px, y + h * 0.5, pz, ry, 0.5, h + 0.4, ns * 0.42, [0.6, 0.58, 0.54], Math.atan2(h, ns * 0.42) * 0, 0); }
  // balustrade blanche le long des bords (sauf l'escalier)
  if (o.balustre !== false) {
    const bord = (lx0, lz0, lx1, lz1) => { const L = Math.hypot(lx1 - lx0, lz1 - lz0), n = Math.max(1, Math.round(L / 1.6));
      for (let i = 0; i <= n; i++) { const t = i / n, [px, pz] = P(lerp(lx0, lx1, t), lerp(lz0, lz1, t)); boite("pierre", px, y + h + 0.55, pz, ry, 0.22, 1.1, 0.22, [0.82, 0.8, 0.76]); boite("pierre", px, y + h + 1.15, pz, ry, 0.3, 0.12, 0.3, [0.82, 0.8, 0.76]); }
      const [mx, mz] = P((lx0 + lx1) / 2, (lz0 + lz1) / 2); boite("pierre", mx, y + h + 0.9, mz, ry + Math.atan2(lx1 - lx0, lz1 - lz0) + Math.PI / 2, L, 0.14, 0.14, [0.82, 0.8, 0.76]); boite("pierre", mx, y + h + 0.3, mz, ry + Math.atan2(lx1 - lx0, lz1 - lz0) + Math.PI / 2, L, 0.12, 0.12, [0.82, 0.8, 0.76]); };
    const w2 = w / 2 - 0.2, d2 = d / 2 - 0.2;
    bord(-w2, -d2, w2, -d2); bord(-w2, -d2, -w2, d2); bord(w2, -d2, w2, d2); bord(-w2, d2, -sw / 2 - 0.4, d2); bord(sw / 2 + 0.4, d2, w2, d2);
  }
  COLLIS.push({ x, z, hw: w / 2, hd: d / 2, a: ry, y0: y - 6, y1: y + h });
  return y + h;
}
// une salle : colonnes, murs à portes, poutres peintes, consoles, un ou deux toits
function salle(x, z, ry, o) {
  const w = o.w, d = o.d, h = o.h ?? 6, base = o.y ?? H(x, z);
  const y0 = o.socle === false ? base : socle(x, base, z, ry, w + 5, d + 5, o.hs ?? 1.6, o);
  const c = Math.cos(ry), s = Math.sin(ry), P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const nx = o.nx ?? Math.max(2, Math.round(w / 4.5) + 1), nz = o.nz ?? Math.max(2, Math.round(d / 4.5) + 1);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    if (i > 0 && i < nx - 1 && j > 0 && j < nz - 1) continue;
    const [px, pz] = P(-w / 2 + w * i / (nx - 1), -d / 2 + d * j / (nz - 1));
    cyl("laque", px, y0, pz, 0.36, h, ROUGE); cyl("pierre", px, y0, pz, 0.6, 0.35, [0.7, 0.68, 0.64], CYL6);
  }
  // murs pleins (fond et côtés) + façade de portes
  if (o.murs !== false) {
    const inset = 0.15;
    for (const [lx, lz, L, a] of [[0, -d / 2 + inset, w, 0], [-w / 2 + inset, 0, d, Math.PI / 2], [w / 2 - inset, 0, d, Math.PI / 2]]) { const [px, pz] = P(lx, lz); boite("mur", px, y0 + (h - 1.2) / 2, pz, ry + a, L, h - 1.2, 0.4, [0.62, 0.17, 0.12]); boite("mur", px, y0 + 0.4, pz, ry + a, L + 0.05, 0.8, 0.5, [0.55, 0.52, 0.48]); }
    // portes sur la façade (+z)
    for (let i = 0; i < nx - 1; i++) { const lx = -w / 2 + w * (i + 0.5) / (nx - 1), bw = w / (nx - 1) - 0.8, [px, pz] = P(lx, d / 2 - inset);
      ajoute("porte", new THREE.PlaneGeometry(1, 1), M4(px, y0 + (h - 1.2) / 2, pz, 0, ry, 0, bw, h - 1.2, 1), [1, 1, 1]); }
    COLLIS.push({ x, z, hw: w / 2, hd: d / 2, a: ry, y0: y0 - 2, y1: y0 + h + (o.hr ?? 3) + 2 });
  }
  // poutres peintes et bandeau d'or
  for (const [lx, lz, L, a] of [[0, -d / 2, w, 0], [0, d / 2, w, 0], [-w / 2, 0, d, Math.PI / 2], [w / 2, 0, d, Math.PI / 2]]) {
    const [px, pz] = P(lx, lz);
    ajoute("poutre", BOITE, M4(px, y0 + h - 0.45, pz, 0, ry + a, 0, L + 0.8, 0.75, 0.5));
    boite("laque", px, y0 + h - 1.0, pz, ry + a, L + 0.6, 0.3, 0.42, ROUGE2);
    boite("or", px, y0 + h - 0.06, pz, ry + a, L + 0.9, 0.1, 0.55, OR);
    // treillis décoratif entre les colonnes (sous la poutre)
    if (o.treillis !== false) boite("laque", px, y0 + h - 1.35, pz, ry + a, L * 0.98, 0.08, 0.12, OR);
  }
  // toits
  const toits = o.toits ?? 1; let ty = y0 + h + 1.25, tw = w, td = d;
  for (let k = 0; k < toits; k++) {
    const der = k === toits - 1;
    toit(x, ty, z, ry, { w: tw, d: td, deb: o.deb ?? 2.6, hr: der ? (o.hr ?? Math.min(tw, td) * 0.42) : 1.2, lev: o.lev ?? 1.5, creux: der ? 1.65 : 1.2, faitage: der ? 1 : 0.0, couleur: o.coul });
    if (!der) { const h2 = 2.6; tw *= 0.78; td *= 0.78; ty += 1.6;
      for (const [lx, lz, L, a] of [[0, -td / 2, tw, 0], [0, td / 2, tw, 0], [-tw / 2, 0, td, Math.PI / 2], [tw / 2, 0, td, Math.PI / 2]]) { const [px, pz] = P(lx, lz); boite("mur", px, ty + h2 / 2, pz, ry + a, L, h2, 0.35, [0.62, 0.17, 0.12]); ajoute("poutre", BOITE, M4(px, ty + h2 - 0.3, pz, 0, ry + a, 0, L + 0.6, 0.55, 0.45)); }
      ty += h2 + 1.2; }
  }
  // lampions aux angles
  if (o.lampions !== false) for (const [lx, lz] of [[-w / 2 - 1.2, d / 2 + 1.2], [w / 2 + 1.2, d / 2 + 1.2], [-w / 2 - 1.2, -d / 2 - 1.2], [w / 2 + 1.2, -d / 2 - 1.2]]) { const [px, pz] = P(lx, lz); lampion(px, y0 + h - 1.6, pz, 0.9); }
  return { y0, haut: ty };
}
// pavillon ouvert à nf côtés (6 ou 8) : colonnes, banc, toit en pointe
function pavillonRond(x, y, z, R, nf = 6, o = {}) {
  socle(x, y, z, 0, R * 2 + 2.4, R * 2 + 2.4, o.hs ?? 0.9, { esc: 2.4, balustre: false });
  const y0 = y + (o.hs ?? 0.9), h = o.h ?? 4.2;
  for (let k = 0; k < nf; k++) { const a = (k + 0.5) / nf * TAU, px = x + Math.cos(a) * R, pz = z + Math.sin(a) * R; cyl("laque", px, y0, pz, 0.24, h, ROUGE);
    const b = (k + 1.5) / nf * TAU, qx = x + Math.cos(b) * R, qz = z + Math.sin(b) * R, L = Math.hypot(qx - px, qz - pz), an = Math.atan2(qx - px, qz - pz) + Math.PI / 2;
    ajoute("poutre", BOITE, M4((px + qx) / 2, y0 + h - 0.35, (pz + qz) / 2, 0, an, 0, L + 0.3, 0.5, 0.35));
    boite("laque", (px + qx) / 2, y0 + 0.55, (pz + qz) / 2, an, L, 0.12, 0.5, ROUGE2); boite("or", (px + qx) / 2, y0 + h - 0.8, (pz + qz) / 2, an, L, 0.1, 0.2, OR); }
  toit(x, y0 + h + 0.8, z, Math.PI / nf, { nf, w: R, d: R, deb: o.deb ?? 1.8, hr: o.hr ?? R * 0.95, lev: 1.4, creux: 1.5 });
  COLLIS.push({ x, z, hw: R + 1, hd: R + 1, a: 0, y0: y - 3, y1: y0 + h + R + 2 });
}
function pagode(x, z, etages = 7) {
  const base = H(x, z); let y = socle(x, base, z, 0, 18, 18, 2.4, { esc: 5 }), s = 10;
  for (let k = 0; k < etages; k++) {
    const hs = k === 0 ? 5.4 : 3.4;
    boite("mur", x, y + hs / 2, z, 0, s, hs, s, [0.62, 0.17, 0.12]);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl("laque", x + a * s / 2, y, z + b * s / 2, 0.3, hs, ROUGE);
    for (let f = 0; f < 4; f++) { const a = f * Math.PI / 2; ajoute("porte", new THREE.PlaneGeometry(1, 1), M4(x + Math.sin(a) * (s / 2 + 0.03), y + hs * 0.45, z + Math.cos(a) * (s / 2 + 0.03), 0, a, 0, s * 0.36, hs * (k ? 0.6 : 0.75), 1)); }
    for (const [lx, lz, a] of [[0, -s / 2, 0], [0, s / 2, 0], [-s / 2, 0, Math.PI / 2], [s / 2, 0, Math.PI / 2]]) ajoute("poutre", BOITE, M4(x + lx, y + hs - 0.3, z + lz, 0, a, 0, s + 0.5, 0.55, 0.4));
    toit(x, y + hs + 0.9, z, 0, { w: s, d: s, deb: 2.2 - k * 0.12, hr: 1.5, lev: 1.3, creux: 1.3, faitage: 0 }, { consoles: k < 3 });
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) lampion(x + a * (s / 2 + 1.9), y + hs - 0.6, z + b * (s / 2 + 1.9), 0.6);
    y += hs + 1.5; s *= 0.86;
  }
  ajoute("or", CYL, M4(x, y + 2.5, z, 0, 0, 0, 0.16, 6, 0.16), OR);
  for (let k = 0; k < 7; k++) ajoute("or", BOULE, M4(x, y + 0.9 + k * 0.7, z, 0, 0, 0, 0.6 - k * 0.06, 0.24, 0.6 - k * 0.06), OR);
  COLLIS.push({ x, z, hw: 6, hd: 6, a: 0, y0: base - 2, y1: y + 6 });
}
// grand portail à trois passages, avec la plaque
function portail(x, z, ry, M) {
  const base = H(x, z), y0 = socle(x, base, z, ry, 26, 8, 1.2, { esc: 10 }), c = Math.cos(ry), s = Math.sin(ry), P = lx => [x + lx * c, z - lx * s];
  for (const lx of [-10, -4, 4, 10]) { const [px, pz] = P(lx), hh = Math.abs(lx) > 6 ? 8 : 10.5; cyl("laque", px, y0, pz, 0.5, hh, ROUGE); boite("pierre", px, y0 + 0.7, pz, ry, 1.5, 1.4, 1.5, [0.66, 0.64, 0.6]); }
  ajoute("poutre", BOITE, M4(x, y0 + 10.0, z, 0, ry, 0, 9.5, 0.9, 0.7)); boite("laque", x, y0 + 9.0, z, ry, 9, 0.5, 0.6, ROUGE2);
  for (const lx of [-7, 7]) { const [px, pz] = P(lx); ajoute("poutre", BOITE, M4(px, y0 + 7.5, pz, 0, ry, 0, 6.8, 0.8, 0.6)); }
  toit(x, y0 + 11.2, z, ry, { w: 9.5, d: 3.4, deb: 1.8, hr: 1.6, lev: 1.4, creux: 1.6 });
  for (const lx of [-7, 7]) { const [px, pz] = P(lx); toit(px, y0 + 8.7, pz, ry, { w: 6.5, d: 3.0, deb: 1.5, hr: 1.3, lev: 1.2, creux: 1.6 }); }
  // plaque
  const [qx, qz] = P(0), pl = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.1), M.plaque); pl.position.set(qx + s * 0.4, y0 + 8.0, qz + c * 0.4); pl.rotation.y = ry;
  boite("or", qx + s * 0.32, y0 + 8.0, qz + c * 0.32, ry, 4.6, 2.5, 0.12, OR);
  for (const lx of [-4, 4]) { const [px, pz] = P(lx); lampion(px + s * 0.8, y0 + 6.5, pz + c * 0.8, 1.1); }
  for (const lx of [-13, 13]) { const [px, pz] = P(lx); banniere(px + s * 3, y0, pz + c * 3, ry, 8); }
  COLLIS.push({ x, z, hw: 11, hd: 1.2, a: ry, y0: y0 - 1, y1: y0 + 13 });
  return pl;
}
function ponton(pts, y) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), ang = Math.atan2(dx, dz), mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    boite("bois", mx, y - 0.15, mz, ang, 2.8, 0.3, L + 2.8, [0.36, 0.22, 0.13]);
    const n = Math.max(2, Math.round(L / 2.4));
    for (const sd of [-1.3, 1.3]) { const ox = Math.cos(ang) * sd, oz = -Math.sin(ang) * sd;
      boite("laque", mx + ox, y + 0.95, mz + oz, ang, 0.12, 0.14, L, ROUGE);
      for (let k = 0; k <= n; k++) { const t = k / n; boite("laque", a[0] + dx * t + ox, y + 0.5, a[1] + dz * t + oz, ang, 0.16, 1.0, 0.16, ROUGE); } }
    for (let k = 1; k < n; k += 2) { const t = k / n; cyl("bois", a[0] + dx * t, y - 5, a[1] + dz * t, 0.2, 5, [0.25, 0.16, 0.1], CYL6); }
  }
}
function grandeLanterne(x, y, z, nom, M) {
  // un pied de pierre, une potence de bois laqué, une grosse lanterne de papier (éteinte au départ)
  boite("pierre", x, y + 0.4, z, 0, 1.6, 0.8, 1.6, [0.62, 0.6, 0.56]);
  cyl("laque", x, y + 0.8, z, 0.2, 6, ROUGE2); boite("laque", x + 1.1, y + 6.5, z, 0, 2.6, 0.22, 0.22, ROUGE2); boite("or", x, y + 6.8, z, 0, 0.5, 0.3, 0.5, OR);
  const m = new THREE.MeshStandardMaterial({ color: 0x9e2216, roughness: 0.6, emissive: new THREE.Color(1.0, 0.35, 0.1), emissiveIntensity: 0 });
  const l = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), m); l.scale.set(1.0, 1.2, 1.0); l.position.set(x + 2.1, y + 4.6, z); l.castShadow = true;
  cyl("or", x + 2.1, y + 5.75, z, 0.55, 0.25, OR); cyl("or", x + 2.1, y + 3.2, z, 0.55, 0.25, OR); cyl("bois", x + 2.1, y + 6.0, z, 0.04, 0.5, [0.2, 0.1, 0.05], CYL6);
  ajoute("lampion", CYL6, M4(x + 2.1, y + 2.6, z, 0, 0, 0, 0.1, 0.9, 0.1), [1, 0.9, 0.4]);
  LANTERNES.push({ x: x + 2.1, y: y + 4.6, z, nom, mesh: l, mat: m, allumee: false, anim: 0 });
  return l;
}

export function construireArchi(scene) {
  const M = matieres(), objets = [];
  // ---- le plateau ----
  const pl = portail(0, -168, 0, M); objets.push(pl);
  const palais = salle(0, -268, 0, { w: 40, d: 20, h: 8, hs: 4.5, toits: 2, hr: 7, deb: 3.4, lev: 2.0, esc: 12 });
  salle(-62, -228, Math.PI / 2, { w: 26, d: 12, h: 6.2, hs: 1.8, hr: 4.6 });
  salle(62, -228, -Math.PI / 2, { w: 26, d: 12, h: 6.2, hs: 1.8, hr: 4.6 });
  salle(-165, -248, Math.PI / 2 * 0.4, { w: 14, d: 14, h: 6, hs: 2, toits: 2, hr: 4 });
  salle(162, -236, -0.3, { w: 14, d: 14, h: 6, hs: 2, toits: 2, hr: 4 });
  salle(-110, -300, 0.15, { w: 20, d: 11, h: 5.8, hs: 1.6, hr: 4 });
  salle(110, -300, -0.15, { w: 20, d: 11, h: 5.8, hs: 1.6, hr: 4 });
  // pavillons au bord de la falaise (vue sur le lac)
  const bords = [];
  for (const x of [-190, -95, 95, 190]) { let best = null; for (const p of PLAT.pts) if (Math.abs(p.x - x) < 6 && (!best || p.z > best.z)) best = p; if (best) bords.push(best); }
  for (const b of bords) { const dx = b.x, dz = b.z + 220, l = Math.hypot(dx, dz), px = b.x - dx / l * 9, pz = b.z - dz / l * 9; pavillonRond(px, H(px, pz), pz, 3.2, 6, { h: 3.8 }); }
  // bannières le long de l'allée
  for (const z of [-190, -205, -220]) for (const sx of [-1, 1]) banniere(sx * 9, H(sx * 9, z), z, sx > 0 ? -Math.PI / 2 : Math.PI / 2, 7);
  // ---- cascades : trois départs sur le bord du plateau qui regarde le lac ----
  for (const x of [-140, -30, 120]) { let best = null; for (const p of PLAT.pts) if (Math.abs(p.x - x) < 5 && (!best || p.z > best.z)) best = p;
    if (best) { const i = PLAT.pts.indexOf(best), a = PLAT.pts[(i + 3) % PLAT.n], b = PLAT.pts[(i - 3 + PLAT.n) % PLAT.n], t = V().subVectors(a, b).normalize(), nrm = V(t.z, 0, -t.x); if (nrm.z < 0) nrm.negate();
      CASCADES.push({ p: V(best.x, PLAT_Y + 0.5, best.z), n: nrm, larg: x === -30 ? 12 : 8 });
      // une rigole pavée qui amène l'eau au bord
      const ang = Math.atan2(nrm.x, nrm.z);
      for (let k = 0; k < 6; k++) boite("pierre", best.x - nrm.x * (k * 4 + 2), PLAT_Y + 0.4, best.z - nrm.z * (k * 4 + 2), ang, x === -30 ? 13 : 9, 0.8, 4.2, [0.5, 0.48, 0.44]);
      for (const sd of [-1, 1]) boite("pierre", best.x - nrm.x * 12 + Math.cos(ang) * sd * (x === -30 ? 7 : 5), PLAT_Y + 1.2, best.z - nrm.z * 12 - Math.sin(ang) * sd * (x === -30 ? 7 : 5), ang, 0.8, 1.6, 26, [0.6, 0.58, 0.54]); } }
  // ---- l'île, le rocher au pavillon, la pagode, le ponton ----
  salle(ILE.x, ILE.z, 0.5, { w: 9, d: 9, h: 4.4, hs: 1.2, toits: 2, hr: 3.4, murs: false, nx: 3, nz: 3 });
  ponton([[ILE.x + 6, ILE.z + 26], [ILE.x + 30, ILE.z + 60], [ILE.x + 12, ILE.z + 95], [ILE.x + 40, ILE.z + 135], [ILE.x + 48, ILE.z + 170]], 1.4);
  const roc = PICS.find(p => p.seed === 53);
  if (roc) { const c = centrePic(roc, 0.95); pavillonRond(c[0], roc.y0 + roc.h * 0.985 - 0.6, c[1], 4, 6, { hs: 1.2, h: 4.2 }); }
  pagode(COLLINE.x, COLLINE.z, 7);
  // pavillon sur pilotis au départ
  salle(70, 245, Math.PI, { w: 12, d: 8, h: 4.2, hs: 0.8, murs: false, hr: 3.2, y: 1.2 });
  // ---- les 6 grandes lanternes ----
  grandeLanterne(12, H(12, -176), -176, "la lanterne du grand portail", M);
  grandeLanterne(-24, H(-24, -246), -246, "la lanterne du grand palais", M);
  grandeLanterne(ILE.x - 8, H(ILE.x - 8, ILE.z + 8), ILE.z + 8, "la lanterne de l'île", M);
  grandeLanterne(COLLINE.x + 12, H(COLLINE.x + 12, COLLINE.z + 10), COLLINE.z + 10, "la lanterne de la pagode", M);
  { const g = PICS[0], c = centrePic(g, 0.95); grandeLanterne(c[0] - 2, g.y0 + g.h * 0.985 - 1.2, c[1], "la lanterne du grand pic", M); }
  { const p = PICS.find(p => p.seed === 51); if (p) { const c = centrePic(p, 0.95); grandeLanterne(c[0] - 2, p.y0 + p.h * 0.985 - 1.2, c[1], "la lanterne du pic du lac", M); } }
  for (const L of LANTERNES) scene.add(L.mesh);
  // ---- fusion par matière ----
  for (const [cle, list] of PIECES) {
    if (window.__DEBUG) list.forEach((g, i) => { const a = g.attributes.position.array; for (let k = 0; k < a.length; k++) if (!Number.isFinite(a[k])) { console.warn('NaN', cle, i, g.userData.src || ''); break; } });
    const g = fusion(list); const m = new THREE.Mesh(g, M[cle]); m.castShadow = cle !== "lampion"; m.receiveShadow = true; scene.add(m); objets.push(m);
  }
  scene.add(pl);
  return { M, objets };
}
