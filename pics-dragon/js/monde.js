// Le plan de la vallée : relief (une seule fonction H), lac, plateau des temples, collines, montagnes.
// Une carte des hauteurs (texture) sert à l'herbe, à l'eau et aux collisions.
import * as THREE from "three";
import { N, clamp, lerp, sm, patch, TAU } from "./commun.js";

export const WY = 0;                                   // niveau du lac
export const LAC = { x: 0, z: 30 };
const lacRay = a => 215 + 34 * Math.sin(3 * a + 0.4) + 20 * Math.sin(5 * a + 2.0) + 10 * Math.sin(9 * a + 1.0);
export const lacD = (x, z) => { const dx = x - LAC.x, dz = z - LAC.z; return Math.hypot(dx, dz) - lacRay(Math.atan2(dz, dx)); };

// le plateau des temples, au nord du lac : un contour fermé (polygone lissé), dessus à PLAT_Y
export const PLAT_Y = 46;
const PLAT_PTS = [[-250, -300], [-150, -330], [-30, -345], [90, -335], [200, -300], [255, -240], [240, -175], [170, -150], [90, -168], [20, -150], [-60, -160], [-140, -150], [-215, -175], [-262, -235]];
export const PLAT = (() => {
  // contour lissé (Catmull-Rom fermé), échantillonné régulièrement
  const P = PLAT_PTS.map(p => new THREE.Vector3(p[0], 0, p[1]));
  const c = new THREE.CatmullRomCurve3(P, true, "centripetal", 0.5);
  const n = 720, pts = c.getSpacedPoints(n).slice(0, n);
  return { courbe: c, pts, n, L: c.getLength() };
})();
// distance signée au contour du plateau (négative dedans), par une grille précalculée
const PG = (() => {
  const x0 = -320, z0 = -400, S = 2, nx = 320, nz = 160, d = new Float32Array(nx * nz);
  const pts = PLAT.pts;
  const dedans = (x, z) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) c = !c; } return c; };
  for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * S, z = z0 + k * S; let m = 1e9;
    for (let q = 0; q < pts.length; q += 2) { const dx = pts[q].x - x, dz = pts[q].z - z, e = dx * dx + dz * dz; if (e < m) m = e; }
    m = Math.sqrt(m); d[i + k * nx] = dedans(x, z) ? -m : m;
  }
  return { x0, z0, S, nx, nz, d };
})();
export function platD(x, z) {
  const fx = (x - PG.x0) / PG.S, fz = (z - PG.z0) / PG.S;
  if (fx < 0 || fz < 0 || fx >= PG.nx - 1 || fz >= PG.nz - 1) { const cx = clamp(x, -300, 300), cz = clamp(z, -390, -90); return 100 + Math.hypot(x - cx, z - cz); }
  const i = Math.floor(fx), k = Math.floor(fz), u = fx - i, v = fz - k, d = PG.d, nx = PG.nx;
  return lerp(lerp(d[i + k * nx], d[i + 1 + k * nx], u), lerp(d[i + (k + 1) * nx], d[i + 1 + (k + 1) * nx], u), v);
}

export const COLLINE = { x: -360, z: 70, r: 95, h: 30 };   // colline de la pagode
export const ILE = { x: -60, z: 95, r: 34 };
export const DEPART = { x: 40, z: 330 };

// hauteur du sol (sans les rochers)
export function H(x, z) {
  const d = lacD(x, z);
  let base = 3.2 + N.fbm(x * .004, 0, z * .004, 4) * 10 + N.fbm(x * .02, 3, z * .02, 3) * 1.6;
  base = Math.max(base, 1.2);
  { const q = Math.hypot(x - COLLINE.x, z - COLLINE.z) / COLLINE.r; if (q < 1.8) base += COLLINE.h * Math.exp(-q * q * 1.9); }
  let h = lerp(-11, base, sm(-45, 30, d));
  const di = Math.hypot(x - ILE.x, z - ILE.z) / ILE.r;
  if (di < 1.3) h = Math.max(h, 3.4 - di * di * 9 + N.fbm(x * .1, 1, z * .1, 2) * .5);
  // le plateau : marche nette sous la falaise (cachée par le mur de roche)
  const pd = platD(x, z);
  if (pd < 6) { const top = PLAT_Y + N.fbm(x * .02, 5, z * .02, 3) * 1.5 + sm(-30, -120, pd) * 2.5; h = lerp(h, top, sm(6, -2, pd)); }
  // montagnes tout autour
  const r = Math.hypot(x - LAC.x, (z - LAC.z) * 1.1 + 60);
  const m = sm(620, 980, r);
  if (m > 0) h += m * (150 + 260 * N.ridged(x * .0022 + 3, 1, z * .0022 - 5, 5));
  return h;
}

// densités de surface (pour la couleur du sol et l'herbe) : forêt d'érables, chemins, pavés
export const foret = (x, z) => sm(-0.02, 0.32, N.fbm(x * .006 + 40, 2, z * .006 - 13, 3));
// cours pavées du plateau (rectangles), et l'allée qui va de la grande porte au grand palais
export const COURS = [{ x: 0, z: -232, w: 130, d: 110 }, { x: -165, z: -245, w: 70, d: 80 }, { x: 160, z: -232, w: 70, d: 80 }, { x: 0, z: -175, w: 16, d: 40 }];
export const pave = (x, z) => {
  let p = 0;
  for (const c of COURS) { const dx = Math.abs(x - c.x) - c.w / 2, dz = Math.abs(z - c.z) - c.d / 2; p = Math.max(p, sm(2, -1, Math.max(dx, dz))); }
  return p * sm(-3, -8, platD(x, z));
};

// ---------- carte des hauteurs (pour l'herbe, l'eau et le jeu) ----------
export const CARTE = { x0: -1300, z0: -1300, T: 2600, n: 1024, h: null, tex: null };
export function construireCarte() {
  const { x0, z0, T, n } = CARTE, h = new Float32Array(n * n), dat = new Uint16Array(n * n * 4), s = T / (n - 1);
  for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) {
    const x = x0 + i * s, z = z0 + k * s, y = H(x, z), o = (i + k * n);
    h[o] = y;
    const herbe = (y > 0.8 && platD(x, z) < -10 || platD(x, z) > 4) ? (1 - pave(x, z)) * (1 - sm(150, 260, y)) * sm(0.6, 2.0, y) : 0;
    dat[o * 4] = THREE.DataUtils.toHalfFloat(y); dat[o * 4 + 1] = THREE.DataUtils.toHalfFloat(herbe); dat[o * 4 + 2] = THREE.DataUtils.toHalfFloat(foret(x, z)); dat[o * 4 + 3] = THREE.DataUtils.toHalfFloat(1);
  }
  CARTE.h = h;
  const t = new THREE.DataTexture(dat, n, n, THREE.RGBAFormat, THREE.HalfFloatType); t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
  CARTE.tex = t;
}
// hauteur rapide (carte), bilinéaire
export function Hc(x, z) {
  const { x0, z0, T, n, h } = CARTE; const s = T / (n - 1);
  const fx = clamp((x - x0) / s, 0, n - 1.001), fz = clamp((z - z0) / s, 0, n - 1.001), i = Math.floor(fx), k = Math.floor(fz), u = fx - i, v = fz - k;
  return lerp(lerp(h[i + k * n], h[i + 1 + k * n], u), lerp(h[i + (k + 1) * n], h[i + 1 + (k + 1) * n], u), v);
}

// ---------- le sol ----------
export function faireSol() {
  const parts = [];
  // intérieur fin (4 m) et extérieur grossier
  const fait = (T, seg, cx, cz, baisse) => {
    const g = new THREE.PlaneGeometry(T, T, seg, seg); g.rotateX(-Math.PI / 2); g.translate(cx, 0, cz);
    const p = g.attributes.position.array, col = new Float32Array(p.length);
    for (let i = 0; i < p.length; i += 3) {
      const x = p[i], z = p[i + 2]; let y = H(x, z);
      if (baisse && Math.abs(x - cx) < 760 && Math.abs(z - cz) < 760) y -= 4;
      p[i + 1] = y;
      col[i] = foret(x, z); col[i + 1] = pave(x, z); col[i + 2] = sm(-1.5, -8, lacD(x, z));
    }
    g.setAttribute("aSurf", new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
  };
  const gIn = fait(1560, 300, 0, -60, false), gOut = fait(5200, 160, 0, -60, true);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, color: 0xffffff });
  patch(mat, s => {
    s.vHead("attribute vec3 aSurf; varying vec3 vSurf; varying vec3 vWN; varying vec3 vWP;");
    s.v("#include <begin_vertex>", "#include <begin_vertex>\nvSurf = aSurf; vWN = normal; vWP = (modelMatrix * vec4(position, 1.0)).xyz;");
    s.fHead("varying vec3 vSurf; varying vec3 vWN; varying vec3 vWP;");
    s.f("#include <color_fragment>", `#include <color_fragment>
      { vec3 p = vWP; float fw = length(fwidth(p.xz));
        float n1 = fbm2(p.xz * 0.045), n2 = vnoise(p.xz * 0.6), n3 = vnoise(p.xz * 3.1);
        float detail = mix(n2 * 0.6 + n3 * 0.4, 0.5, smoothstep(0.4, 2.5, fw));
        vec3 herbe = mix(vec3(0.115, 0.165, 0.040), vec3(0.205, 0.235, 0.060), n1) * (0.80 + 0.40 * detail);
        herbe = mix(herbe, vec3(0.24, 0.20, 0.07), smoothstep(0.62, 0.8, n1) * 0.5);                 // herbe sèche
        vec3 litiere = mix(vec3(0.30, 0.055, 0.025), vec3(0.42, 0.13, 0.03), detail) * (0.75 + 0.4 * n1);
        vec3 c = mix(herbe, litiere, smoothstep(0.25, 0.75, vSurf.x) * (0.55 + 0.45 * smoothstep(0.35, 0.65, n2)));
        // dalles des cours
        vec2 q = p.xz / vec2(1.6, 0.8); q.x += floor(q.y) * 0.5; vec2 f = fract(q); float joint = min(min(f.x, 1.0 - f.x) * 1.6, min(f.y, 1.0 - f.y) * 0.8);
        vec3 dalle = vec3(0.42, 0.40, 0.37) * (0.82 + 0.3 * hash21(floor(q))) * mix(0.55, 1.0, smoothstep(0.0, 0.05, joint));
        c = mix(c, dalle, vSurf.y);
        // plages de galets et fond du lac
        float plage = smoothstep(2.4, 0.6, p.y) * (1.0 - vSurf.y);
        c = mix(c, vec3(0.36, 0.33, 0.27) * (0.75 + 0.5 * detail), plage);
        c = mix(c, vec3(0.16, 0.16, 0.12), vSurf.z);
        // pentes raides : la roche affleure ; montagnes
        float pente = 1.0 - normalize(vWN).y;
        c = mix(c, vec3(0.34, 0.33, 0.30) * (0.8 + 0.4 * n2), smoothstep(0.25, 0.45, pente));
        c = mix(c, mix(vec3(0.20, 0.24, 0.10), vec3(0.33, 0.32, 0.30), smoothstep(0.3, 0.6, pente + n1 * 0.3)), smoothstep(60.0, 140.0, p.y));
        diffuseColor.rgb = c; }`);
    s.f("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
      { vec2 e = vec2(0.35, 0.0); float a = vnoise(vWP.xz * 1.3), b = vnoise((vWP.xz + e.xy) * 1.3), c2 = vnoise((vWP.xz + e.yx) * 1.3);
        float k = 0.5 * (1.0 - smoothstep(10.0, 60.0, length(vViewPosition)));
        normal = normalize(normal + (viewMatrix * vec4((a - b) * k, 0.0, (a - c2) * k, 0.0)).xyz); }`);
  }, "sol");
  const sol = new THREE.Mesh(gIn, mat), loin = new THREE.Mesh(gOut, mat);
  sol.receiveShadow = loin.receiveShadow = true; sol.castShadow = true;
  return [sol, loin];
}
