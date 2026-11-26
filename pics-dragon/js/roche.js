// La roche : calcaire en blocs. Des joints verticaux coupent la pierre en colonnes, des bancs coupent les colonnes en blocs ;
// chaque bloc avance ou recule et penche un peu. La même fonction, écrite deux fois (JS pour le maillage, GLSL pour le
// dessin), donne des marches dans la silhouette et des joints nets au pixel près, exactement aux mêmes endroits.
import * as THREE from "three";
import { N, rng, clamp, lerp, sm, TAU, V, patch } from "./commun.js";
import { H, PLAT, PLAT_Y, lacD, platD, LAC } from "./monde.js";

// ---------- le champ de blocs (à garder identique au GLSL plus bas) ----------
const hb = (i, j, k) => { let x = Math.imul(i | 0, 0x8da6b343) ^ Math.imul(j | 0, 0xd8163841) ^ Math.imul(k | 0, 0xcb1ab31f); x ^= x >>> 16; x = Math.imul(x, 0x7feb352d); x ^= x >>> 15; x = Math.imul(x, 0x846ca68b); x ^= x >>> 16; return x >>> 0; };
export const LV0 = { S: 13, H: 28, A: 2.6, T: 0.14, seed: 3 }, LV1 = { S: 4.2, H: 8.5, A: 0.85, T: 0.18, seed: 17 };
let bT = 0, bB = 0, tX = 0, tZ = 0;
function banc(cx, cz, yd, Hh, seed) { const n = hb(cx, cz, seed + 1), Hc = Hh * (0.7 + 0.6 * (n & 0xffff) / 65536), ly = yd / Hc + (n >>> 16) / 65536 * 7, fl = Math.floor(ly), lf = ly - fl; bT = (1 - lf) * Hc; bB = lf * Hc; return fl; }
function decal(cx, cz, li, seed) { const n = hb(cx + li * 57, cz + li * 113, seed + 3); tX = ((n >>> 10) & 2047) / 1023.5 - 1; tZ = (n >>> 21) / 1023.5 - 1; const v = (n & 1023) / 511.5 - 1; return v < 0 ? v * (1 + 0.5 * v) : v; }
function bloc(x, y, z, L, band) {
  const S = L.S, seed = L.seed, wy = y / S, ax = x / S, az = z / S;
  const qx = ax + 0.28 * Math.sin(wy * 0.38 + 1.3) + 0.06 * Math.sin(az * 3.9 + wy * 1.7);
  const qz = az + 0.28 * Math.sin(wy * 0.34 + 4.0) + 0.06 * Math.sin(ax * 3.3 - wy * 2.1);
  const X = Math.floor(qx), Z = Math.floor(qz), fx = qx - X, fz = qz - Z;
  let d1 = 1e9, d2 = 1e9, r1x = 0, r1z = 0, r2x = 1, r2z = 1, c1x = X, c1z = Z, c2x = X, c2z = Z;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const n = hb(X + i, Z + j, seed), rx = i + 0.15 + 0.7 * (n & 0xffff) / 65536 - fx, rz = j + 0.15 + 0.7 * (n >>> 16) / 65536 - fz, d = rx * rx + rz * rz;
    if (d < d1) { d2 = d1; r2x = r1x; r2z = r1z; c2x = c1x; c2z = c1z; d1 = d; r1x = rx; r1z = rz; c1x = X + i; c1z = Z + j; }
    else if (d < d2) { d2 = d; r2x = rx; r2z = rz; c2x = X + i; c2z = Z + j; }
  }
  const dl = Math.max(Math.hypot(r2x - r1x, r2z - r1z), 1e-4), e = (d2 - d1) / (2 * dl) * S, TS = L.T * S;
  const li = banc(c1x, c1z, y, L.H, seed), bt = bT, bb = bB;
  const dS = L.A * decal(c1x, c1z, li, seed) - TS * (tX * r1x + tZ * r1z);
  let d = dS;
  if (bt < band) d += 0.5 * (1 - bt / band) * (L.A * decal(c1x, c1z, li + 1, seed) - TS * (tX * r1x + tZ * r1z) - dS);
  if (bb < band) d += 0.5 * (1 - bb / band) * (L.A * decal(c1x, c1z, li - 1, seed) - TS * (tX * r1x + tZ * r1z) - dS);
  if (e < band) { const l2 = banc(c2x, c2z, y, L.H, seed); d += 0.5 * (1 - e / band) * (L.A * decal(c2x, c2z, l2, seed) - TS * (tX * r2x + tZ * r2z) - dS); }
  return d;
}
export const blocs = (x, y, z, k = 1) => (bloc(x, y, z, LV0, 2.2) + bloc(x, y, z, LV1, 0.5)) * k;

const GLSL_BLOCS = /* glsl */`
uint rkH(int i, int j, int k){ uint x = uint(i) * 0x8da6b343u ^ uint(j) * 0xd8163841u ^ uint(k) * 0xcb1ab31fu; x ^= x >> 16u; x *= 0x7feb352du; x ^= x >> 15u; x *= 0x846ca68bu; x ^= x >> 16u; return x; }
int rkBanc(ivec2 c, float yd, float H, int seed, out float bt, out float bb){ uint n = rkH(c.x, c.y, seed + 1); float Hc = H * (0.7 + 0.6 * float(n & 0xffffu) / 65536.0);
  float ly = yd / Hc + float(n >> 16u) / 65536.0 * 7.0, fl = floor(ly), lf = ly - fl; bt = (1.0 - lf) * Hc; bb = lf * Hc; return int(fl); }
float rkDec(ivec2 c, int li, int seed, out vec2 tilt){ uint n = rkH(c.x + li * 57, c.y + li * 113, seed + 3);
  tilt = vec2(float((n >> 10u) & 2047u), float(n >> 21u)) / 1023.5 - 1.0; float v = float(n & 1023u) / 511.5 - 1.0; return v < 0.0 ? v * (1.0 + 0.5 * v) : v; }
struct RkL { float e; float bt; float bb; float off; float offN; float offU; float offD; float id; vec2 g; vec2 tilt; };
RkL rkNiveau(vec3 p, float S, float H, int seed){
  RkL o; float wy = p.y / S; vec2 a = p.xz / S;
  vec2 q = a + vec2(0.28 * sin(wy * 0.38 + 1.3) + 0.06 * sin(a.y * 3.9 + wy * 1.7), 0.28 * sin(wy * 0.34 + 4.0) + 0.06 * sin(a.x * 3.3 - wy * 2.1));
  vec2 fl = floor(q), f = q - fl; ivec2 ic = ivec2(fl), c1 = ic, c2 = ic; float d1 = 1e9, d2 = 1e9; vec2 r1 = vec2(0.0), r2 = vec2(1.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    ivec2 c = ic + ivec2(i, j); uint n = rkH(c.x, c.y, seed);
    vec2 r = vec2(float(i), float(j)) + 0.15 + 0.7 * vec2(float(n & 0xffffu), float(n >> 16u)) / 65536.0 - f; float d = dot(r, r);
    if (d < d1){ d2 = d1; r2 = r1; c2 = c1; d1 = d; r1 = r; c1 = c; } else if (d < d2){ d2 = d; r2 = r; c2 = c; } }
  vec2 dr = r2 - r1; float dl = max(length(dr), 1e-4); o.e = (d2 - d1) / (2.0 * dl) * S; o.g = dr / dl;
  float t0, t1; vec2 tn;
  int li = rkBanc(c1, p.y, H, seed, o.bt, o.bb);
  o.off = rkDec(c1, li, seed, o.tilt); o.offU = rkDec(c1, li + 1, seed, tn); o.offD = rkDec(c1, li - 1, seed, tn);
  o.offN = rkDec(c2, rkBanc(c2, p.y, H, seed, t0, t1), seed, tn);
  o.id = fract((o.off + o.tilt.x) * 5.37 + 0.5);
  return o; }
vec3 gAcc; float gFente, gAO, gCoulure, gId;
// ce qu'un niveau de blocs fait à l'éclairage : pente des faces, marches aux joints, fentes, ombre sous les surplombs, coulures
void rkOmbre(RkL b, vec3 n0, float A, float T, float fw, float S, float Hh, float poids){
  float lod = 1.0 - smoothstep(S * 0.07, S * 0.25, fw);
  float wb = max(0.22 * S / 4.2, fw * 1.2), wc = max(0.05 * S / 4.2, fw * 0.7);
  vec3 tl = vec3(b.tilt.x, 0.0, b.tilt.y) * T; gAcc -= (tl - n0 * dot(tl, n0)) * lod;
  vec3 g3 = vec3(b.g.x, 0.0, b.g.y); g3 -= n0 * dot(g3, n0); float gt = smoothstep(0.30, 0.70, length(g3));
  vec3 up = vec3(0.0, 1.0, 0.0) - n0 * n0.y;
  float dv = A * (b.off - b.offN), dU = A * (b.off - b.offU), dD = A * (b.off - b.offD), k = 0.5 / wb;
  float bn = 1.0 - smoothstep(wb * 0.55, wb, b.e), bT = 1.0 - smoothstep(wb * 0.55, wb, b.bt), bB = 1.0 - smoothstep(wb * 0.55, wb, b.bb);
  float jf = smoothstep(0.03, 0.24, abs(b.off - b.offN)), jU = smoothstep(0.03, 0.24, abs(b.off - b.offU)), jD = smoothstep(0.03, 0.24, abs(b.off - b.offD));
  gAcc += (g3 * clamp(dv * k, -1.2, 1.2) * bn * gt + up * (clamp(dU * k, -1.0, 1.2) * bT - clamp(dD * k, -1.2, 1.0) * bB)) * lod;
  float rb = max(1.0 - b.e / (S * 0.42), 0.0); gAcc += g3 * rb * rb * 0.5 * gt * lod;          // les colonnes bombent entre leurs joints
  float jw = 0.55 + 1.1 * fract((b.off + b.offN) * 7.31 + 0.3);
  float cj = (1.0 - smoothstep(0.0, wc * jw, b.e)) * gt * jf, cb = (1.0 - smoothstep(0.0, wc, b.bt)) * jU + (1.0 - smoothstep(0.0, wc, b.bb)) * jD;
  gFente = max(gFente, min(cj + cb, 1.0) * lod * poids);
  float ov = clamp(-dU / A, 0.0, 1.0), lw = clamp(-dv / A, 0.0, 1.6);
  gAO += (0.6 * lw * exp(-b.e / (S * 0.10 + 0.5 * abs(dv))) * gt + 0.8 * ov * exp(-b.bt / (Hh * 0.05 + 0.6 * abs(dU))) + clamp(dD / A, 0.0, 1.6) * exp(-b.bb / (Hh * 0.025 + 0.3 * abs(dD)))) * lod * poids;
  gCoulure += ov * exp(-b.bt / (Hh * 0.45)) * lod * poids;
  gId = mix(gId, b.id, poids * lod);
}`;

export function matRoche() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 });
  patch(m, s => {
    s.vHead("attribute vec3 aB, aN; varying vec3 vB, vN0, vWN0;");
    s.v("#include <begin_vertex>", "#include <begin_vertex>\nvB = aB; vN0 = normalize(normalMatrix * aN); vWN0 = aN;");
    s.fHead(`varying vec3 vB, vN0, vWN0;\n${GLSL_BLOCS}`);
    s.f("#include <color_fragment>", `#include <color_fragment>
      gAcc = vec3(0.0); gFente = 0.0; gAO = 0.0; gCoulure = 0.0; gId = 0.5;
      vec3 n0 = normalize(vWN0); float fw = length(fwidth(vB));
      { RkL b1 = rkNiveau(vB, ${LV1.S.toFixed(2)}, ${LV1.H.toFixed(2)}, ${LV1.seed}); rkOmbre(b1, n0, ${LV1.A.toFixed(2)}, ${LV1.T.toFixed(2)}, fw, ${LV1.S.toFixed(2)}, ${LV1.H.toFixed(2)}, 1.0);
        RkL b2 = rkNiveau(vB + vec3(31.0, 0.0, 17.0), 1.3, 2.6, 41); rkOmbre(b2, n0, 0.22, 0.24, fw, 1.3, 2.6, 0.6); }
      vec3 wp = vFogW;
      float up = n0.y, nz = vnoise(vB.xz * 0.21 + vB.y * 0.05), streak = vnoise(vec2((vB.x + vB.z) * 0.9, vB.y * 0.05)), fine = vnoise(vB.xy * 2.7 + vB.zy * 1.9);
      float macro = fbm2(vB.xz * 0.012 + vB.y * 0.004), flute = vnoise(vec2((vB.x - vB.z) * 0.42, vB.y * 0.018)), flute2 = vnoise(vec2((vB.x + vB.z) * 1.3, vB.y * 0.05));
      vec3 c = vColor.rgb * mix(vec3(0.33, 0.315, 0.29), vec3(0.50, 0.47, 0.42), gId * 0.6 + nz * 0.4) * (0.78 + 0.4 * macro);
      c = mix(c, c * vec3(1.12, 0.98, 0.80), smoothstep(0.5, 0.8, macro) * 0.6);                                   // plaques ocre
      c *= 0.82 + 0.25 * flute + 0.12 * flute2;                                                                       // cannelures verticales
      c *= 1.0 - 0.30 * smoothstep(0.45, 0.85, streak) * (0.5 + 0.5 * smoothstep(0.0, 1.0, -up + 0.6));       // coulures sombres le long des parois
      c *= 1.0 - 0.45 * clamp(gCoulure, 0.0, 1.0);
      c = mix(c, vec3(0.62, 0.42, 0.18) * (0.8 + 0.4 * fine), smoothstep(0.78, 0.92, vnoise(vB.xz * 0.5 + vB.y * 0.3)) * 0.45);  // lichen orangé
      float mousse = smoothstep(0.45, 0.85, up + (nz - 0.5) * 0.5) * (1.0 - gFente);
      c = mix(c, mix(vec3(0.11, 0.17, 0.045), vec3(0.20, 0.25, 0.07), fine), mousse * 0.9);
      c = mix(c, c * 0.45, smoothstep(2.0, -1.5, wp.y) * 0.8);                                                  // pied humide
      c *= (1.0 - 0.32 * gFente * (1.0 - smoothstep(25.0, 90.0, length(vViewPosition)))) * (1.0 - 0.42 * clamp(gAO, 0.0, 1.0));
      diffuseColor.rgb = c;`);
    s.f("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
      { vec3 a = (viewMatrix * vec4(gAcc, 0.0)).xyz; float k = 1.0 - smoothstep(0.6, 0.98, abs(dot(normal, normalize(vViewPosition))) * 0.0);
        normal = normalize(normal + a * 0.75);
        float e = 0.08; vec2 dn = vec2(vnoise(vB.xy * 3.0 + vB.zz) - vnoise(vB.xy * 3.0 + vB.zz + e), vnoise(vB.zy * 3.0 + vB.xx) - vnoise(vB.zy * 3.0 + vB.xx + e));
        normal = normalize(normal + (viewMatrix * vec4(dn.x, 0.0, dn.y, 0.0)).xyz * 0.6 * (1.0 - smoothstep(20.0, 80.0, length(vViewPosition)))); }`);
    s.f("#include <roughnessmap_fragment>", "float roughnessFactor = mix(0.9, 0.6, smoothstep(2.0, -1.0, vFogW.y));");
  }, "roche");
  return m;
}

// ---------- surfaces paramétriques -> géométrie déplacée ----------
// f(u, v, out) donne le point non déplacé ; k(u, v) l'amplitude des blocs ; nu x nv sommets
function surface(f, nu, nv, kOf, ferme = true, teinte) {
  const nvx = nu * (nv + 1), P = new Float32Array(nvx * 3), idx = [];
  const o = V();
  for (let j = 0; j <= nv; j++) for (let i = 0; i < nu; i++) { f(i / nu, j / nv, o); const k = (i + j * nu) * 3; P[k] = o.x; P[k + 1] = o.y; P[k + 2] = o.z; }
  const cols = ferme ? nu : nu - 1;
  for (let j = 0; j < nv; j++) for (let i = 0; i < cols; i++) { const i1 = (i + 1) % nu, a = i + j * nu, b = i1 + j * nu, c = i + (j + 1) * nu, d = i1 + (j + 1) * nu; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(P, 3)); g.setIndex(idx); g.computeVertexNormals();
  const n0 = g.attributes.normal.array.slice(), B = P.slice(), col = new Float32Array(nvx * 3);
  for (let j = 0; j <= nv; j++) for (let i = 0; i < nu; i++) {
    const k = (i + j * nu) * 3, x = B[k], y = B[k + 1], z = B[k + 2], amp = kOf(i / nu, j / nv);
    const d = amp > 0 ? blocs(x, y, z) * amp : 0;
    P[k] = x + n0[k] * d; P[k + 1] = y + n0[k + 1] * d; P[k + 2] = z + n0[k + 2] * d;
    const t = teinte ? teinte(x, y, z) : 1; col[k] = t; col[k + 1] = t * (0.98 + 0.03 * N.n3(x * .01, y * .01, z * .01)); col[k + 2] = t * 0.97;
  }
  g.setAttribute("aB", new THREE.BufferAttribute(B, 3)); g.setAttribute("aN", new THREE.BufferAttribute(n0, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// ---------- les pics ----------
export const PICS = [];
const profil = (sp, t) => {
  let r = sp.rb * (1 - 0.42 * Math.pow(t, 1.25)) * (1 + 0.12 * Math.sin(t * 6.5 + sp.seed) + 0.05 * Math.sin(t * 15 + sp.seed * 2));
  if (t > 0.9) r *= Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.9) / 0.1, 2)));
  return r;
};
export const centrePic = (sp, t, out = [0, 0]) => { out[0] = sp.x + sp.lx * t * t + Math.sin(t * 4 + sp.seed) * sp.rb * 0.08; out[1] = sp.z + sp.lz * t * t + Math.cos(t * 3.3 + sp.seed) * sp.rb * 0.08; return out; };
export const rayonPic = profil;
function picGeo(sp, pas) {
  const nu = Math.max(24, Math.round(TAU * sp.rb / pas)), nv = Math.max(20, Math.round(sp.h / pas)), c = [0, 0];
  return surface((u, v, o) => {
    const a = u * TAU, t = v; centrePic(sp, t, c);
    const ca = Math.cos(a), sa = Math.sin(a), y = sp.y0 + t * sp.h;
    const r = profil(sp, t) * (1 + 0.16 * N.fbm(ca * 1.4 + sp.seed, t * 3, sa * 1.4, 3) + 0.10 * N.n3(ca * 4, y * 0.04, sa * 4));
    o.set(c[0] + ca * r, t > 0.97 ? y + (t - 0.97) * 0 : y, c[1] + sa * r);
  }, nu, nv, (u, v) => (1 - sm(0.86, 0.98, v)) * Math.min(1, sp.rb / 12), true, (x, y) => 0.92 + 0.12 * N.n3(x * .02, y * .02, sp.seed));
}

// ---------- la falaise du plateau ----------
function falaiseGeo(pas) {
  const pts = PLAT.pts, n = pts.length, y0 = -16, y1 = PLAT_Y + 0.8, lev = 5;
  const nu = Math.round(PLAT.L / pas), nvw = Math.round((y1 - y0) / pas), nv = nvw + lev;
  const tan = V(), nor = V(), p = V();
  const at = (u, out, outN) => {
    const f = u * n, i = Math.floor(f) % n, j = (i + 1) % n, t = f - Math.floor(f);
    out.lerpVectors(pts[i], pts[j], t);
    const a = pts[(i - 2 + n) % n], b = pts[(i + 3) % n]; tan.subVectors(b, a).normalize(); outN.set(tan.z, 0, -tan.x);   // vers l'extérieur (sens du contour)
  };
  // sens : on vérifie que la normale part vers l'extérieur
  at(0, p, nor); const s = platD(p.x + nor.x * 10, p.z + nor.z * 10) > 0 ? 1 : -1;
  return surface((u, v, o) => {
    at(u, p, nor); nor.multiplyScalar(s);
    const j = v * nv;
    if (j <= nvw) { const y = y0 + (y1 - y0) * (j / nvw), bomb = 3 * Math.sin(u * 61 + 1.3) * sm(y0, y0 + 25, y) + 2.2 * N.fbm(u * 40, y * 0.05, 0, 3);
      const pied = sm(y0 + 20, y0, y) * 6;                                // le pied s'évase (éboulis)
      o.set(p.x + nor.x * (bomb + pied), y, p.z + nor.z * (bomb + pied)); }
    else { const k = (j - nvw) / lev, a = k * Math.PI * 0.5; o.set(p.x - nor.x * (Math.sin(a) * 5 - 2.2 * N.fbm(u * 40, y1 * 0.05, 0, 3) * (1 - k)), y1 + Math.sin(a * 2) * 0.6 - k * k * 2.5, p.z - nor.z * (Math.sin(a) * 5 - 2.2 * N.fbm(u * 40, y1 * 0.05, 0, 3) * (1 - k))); }
  }, nu, nv, (u, v) => v * nv <= nvw ? 1 : Math.max(0, 1 - (v * nv - nvw) / 2), true, (x, y, z) => 0.95 + 0.1 * N.n3(x * .015, y * .02, z * .015));
}

export const SITES = { corniche: [], suspendu: [], sommet: [] };   // où les plantes s'accrochent
export function construireRoche(qualite) {
  const pas = qualite === "rapide" ? 3.2 : qualite === "moyenne" ? 2.6 : 2.15;
  const r = rng(9091);
  // le grand pic de la lanterne, et des pics tout autour (jamais sur le plateau, le lac ou le départ)
  const ajout = (x, z, rb, h, seed, lean = 8) => { const sol = H(x, z); const la = r() * TAU, l = r() * lean; PICS.push({ x, z, rb, h, y0: sol - 12, sol, seed, lx: Math.cos(la) * l, lz: Math.sin(la) * l }); };
  ajout(120, -420, 34, 260, 77, 6);   // le grand pic, derrière le plateau
  ajout(-90, -440, 30, 230, 12, 6);
  ajout(10, -520, 40, 300, 33, 6);
  ajout(-260, -400, 28, 210, 5, 8);
  ajout(260, -390, 30, 220, 8, 8);
  // pics dans le lac et sur ses bords
  ajout(170, 20, 16, 95, 51); ajout(-190, -30, 14, 80, 52); ajout(110, 170, 12, 70, 53);
  let essais = 0;
  while (PICS.length < 46 && essais++ < 5000) {
    const a = r() * TAU, rr = 280 + r() * 380, x = LAC.x + Math.cos(a) * rr, z = LAC.z + Math.sin(a) * rr * 0.95;
    const rb = 13 + r() * 20, h = 70 + r() * 140 + (rr > 500 ? 60 : 0);
    if (platD(x, z) < 30) continue;
    if (Math.hypot(x - 40, z - 330) < 90 || Math.hypot(x + 360, z - 70) < 110) continue;
    if (lacD(x, z) > -25 && lacD(x, z) < 25) continue;
    if (PICS.some(p => Math.hypot(p.x - x, p.z - z) < p.rb + rb + 18)) continue;
    ajout(x, z, rb, h, Math.floor(r() * 1000));
  }
  // quelques pics sur le plateau, derrière les temples
  for (const [x, z, rb, h] of [[-225, -255, 18, 120], [225, -265, 20, 135], [-95, -315, 15, 105], [80, -320, 14, 95]]) ajout(x, z, rb, h, Math.floor(r() * 1000), 4);
  const geos = [];
  for (const sp of PICS) geos.push(picGeo(sp, Math.hypot(sp.x - LAC.x, sp.z - LAC.z) > 560 ? pas * 1.8 : pas));
  geos.push(falaiseGeo(pas * 1.1));
  // pics lointains, sans détail, dans la brume
  const loin = [];
  for (let i = 0; i < 40; i++) { const a = r() * TAU, rr = 800 + r() * 700, x = Math.cos(a) * rr, z = LAC.z + Math.sin(a) * rr, sol = H(x, z);
    loin.push(picGeo({ x, z, rb: 35 + r() * 50, h: 200 + r() * 300, y0: sol - 20, sol, seed: 500 + i, lx: (r() - .5) * 40, lz: (r() - .5) * 40 }, 9)); }
  // sites pour les plantes, pris sur les sommets du maillage
  for (const g of geos) {
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    for (let i = 0; i < p.length; i += 3) {
      if (r() > 0.11) continue;
      const ny = n[i + 1], y = p[i + 1]; if (y < 1.5) continue;
      if (ny > 0.72) SITES.corniche.push([p[i], y, p[i + 2], n[i], ny, n[i + 2]]);
      else if (ny > -0.1 && ny < 0.25 && r() < 0.25) SITES.suspendu.push([p[i], y, p[i + 2], n[i], ny, n[i + 2]]);
    }
  }
  for (const sp of PICS) { const c = centrePic(sp, 0.93); SITES.sommet.push([c[0], sp.y0 + sp.h * 0.985, c[1], profil(sp, 0.9) * 0.7, sp]); }
  return { pres: geos, loin };
}
// collision : rayon d'un pic à une hauteur donnée
export function dansPic(x, y, z, marge) {
  for (const sp of PICS) {
    const t = (y - sp.y0) / sp.h; if (t < 0 || t > 1.02) continue;
    const c = centrePic(sp, clamp(t, 0, 1)), r = profil(sp, clamp(t, 0, 1)) * 1.1 + 2 + marge;
    const dx = x - c[0], dz = z - c[1], d = Math.hypot(dx, dz);
    if (d < r) return { sp, c, r, d, dx, dz };
  }
  return null;
}
