// La végétation : érables rouges, pins des falaises, buissons, herbe, plantes accrochées à la roche.
// Les feuilles sont dessinées au canevas sous forme de DONNÉES (R ombre, G nuance propre à chaque feuille, B bois, A couverture) ;
// la couleur vient d'une palette par arbre, si bien que 6 formes d'arbres donnent des centaines d'arbres tous différents.
// Chaque bouquet est une carte posée au bout d'un rameau ; l'ombre dans le houppier, la lumière à travers les feuilles,
// le vent et le passage du dragon sont calculés par le shader.
import * as THREE from "three";
import { rng, clamp, lerp, sm, TAU, V, patch, tubeGeo, fusion, fillAttr, G } from "./commun.js";
import { H, Hc, lacD, platD, foret, pave, CARTE, LAC, WY } from "./monde.js";
import { PICS, SITES, dansPic } from "./roche.js";

const AS = 2048, CW = 512;   // atlas 4 x 2 cases de 512
// cases : 0..2 rameaux d'érable, 3 rameau de buisson, 4 plateau de pin (vu de dessus), 5 pin de profil, 6 touffe d'herbe et fougère, 7 rideau de lianes
const CELL = i => { const cx = i % 4, cy = Math.floor(i / 4); return [cx * CW / AS, 1 - (cy + 1) * CW / AS, (cx + 1) * CW / AS, 1 - cy * CW / AS]; };

// ======================= dessin =======================
const dc = (s, h, w = 0) => `rgb(${clamp(s) * 255 | 0},${clamp(h) * 255 | 0},${clamp(w) * 255 | 0})`;
function feuilleErable(x, cx, cy, s, rot, sh, hu) {
  x.save(); x.translate(cx, cy); x.rotate(rot); x.scale(s, s);
  const g = x.createRadialGradient(0, -0.15, 0.05, 0, -0.25, 1.0); g.addColorStop(0, dc(sh + 0.12, hu)); g.addColorStop(1, dc(sh * 0.6, hu)); x.fillStyle = g;
  // 7 lobes pointus, dents sur les bords
  x.beginPath(); x.moveTo(0, 0.05);
  const lobes = [[-2.2, .42], [-1.55, .72], [-0.78, .9], [0, 1.0], [0.78, .9], [1.55, .72], [2.2, .42]];
  for (let i = 0; i < lobes.length; i++) {
    const [a, L] = lobes[i], ax = Math.sin(a) * L, ay = -Math.cos(a) * L;
    const prev = i ? lobes[i - 1] : [a - 0.5, L * 0.3], am = (a + prev[0]) / 2, Lm = Math.min(L, prev[1]) * 0.42;
    x.lineTo(Math.sin(am) * Lm, -Math.cos(am) * Lm);
    x.lineTo(Math.sin(a - 0.16) * L * 0.62, -Math.cos(a - 0.16) * L * 0.62); x.lineTo(Math.sin(a - 0.09) * L * 0.78, -Math.cos(a - 0.09) * L * 0.78);
    x.lineTo(ax, ay);
    x.lineTo(Math.sin(a + 0.09) * L * 0.78, -Math.cos(a + 0.09) * L * 0.78); x.lineTo(Math.sin(a + 0.16) * L * 0.62, -Math.cos(a + 0.16) * L * 0.62);
  }
  x.lineTo(Math.sin(2.6) * 0.15, -Math.cos(2.6) * 0.15); x.closePath(); x.fill();
  x.strokeStyle = dc(sh + 0.25, hu); x.lineWidth = 0.03; x.beginPath(); for (const [a, L] of lobes) { x.moveTo(0, 0); x.lineTo(Math.sin(a) * L * 0.8, -Math.cos(a) * L * 0.8); } x.stroke();
  x.restore();
}
function feuilleOvale(x, cx, cy, L, w, rot, sh, hu) {
  x.save(); x.translate(cx, cy); x.rotate(rot); x.fillStyle = dc(sh, hu); x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(w, -L * 0.25, w * 0.8, -L * 0.8, 0, -L); x.bezierCurveTo(-w * 0.8, -L * 0.8, -w, -L * 0.25, 0, 0); x.fill();
  x.strokeStyle = dc(sh + 0.15, hu); x.lineWidth = Math.max(1, L * 0.04); x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -L * 0.85); x.stroke(); x.restore();
}
const brin = (x, a, b, w, sh = 0.3) => { x.strokeStyle = dc(sh, 0.5, 1); x.lineWidth = w; x.lineCap = "round"; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); };
// un rameau d'érable : la tige monte du bas de la case, rameaux latéraux, feuilles par paires
function rameauErable(x, ox, oy, S, r) {
  const courbe = (r() - 0.5) * 0.2, tw = t => [ox + S * (0.5 + courbe * Math.sin(t * 2.4)), oy + S * (0.96 - 0.8 * t)], fs = [];
  let pr = tw(0); for (let i = 1; i <= 24; i++) { const p = tw(i / 24); brin(x, pr, p, S * (0.016 - 0.011 * i / 24)); pr = p; }
  const NN = 11;
  for (let i = 0; i < NN; i++) {
    const t = 0.1 + 0.9 * i / (NN - 1), p = tw(t), q = tw(Math.min(1, t + 0.03)), ta = Math.atan2(q[0] - p[0], -(q[1] - p[1])), sz = S * (0.105 + 0.03 * r()) * (1 - 0.18 * t);
    for (const sd of [-1, 1]) fs.push([p[0], p[1], ta + sd * (1.0 + 0.5 * r()), sz * (0.85 + 0.3 * r())]);
    if (i < NN - 1) { const sd = i % 2 ? 1 : -1, a = ta + sd * (0.8 + 0.35 * r()), L = S * (0.16 + 0.16 * r()) * (1 - 0.4 * t), M = 3 + (r() * 2 | 0); let pp = p;
      for (let k = 1; k <= M; k++) { const u = k / M, aa = a + sd * 0.3 * u, e = [p[0] + Math.sin(aa) * L * u, p[1] - Math.cos(aa) * L * u]; brin(x, pp, e, S * 0.006); pp = e;
        const ss = sz * (0.8 + 0.3 * r()); if (k < M) for (const s2 of [-1, 1]) fs.push([e[0], e[1], aa + s2 * (0.9 + 0.5 * r()), ss]); else fs.push([e[0], e[1], aa + (r() - .5) * 0.5, ss * 1.1]); } }
  }
  const tip = tw(1); fs.push([tip[0], tip[1], (r() - .5) * 0.4, S * 0.085]);
  for (let i = fs.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [fs[i], fs[j]] = [fs[j], fs[i]]; }
  const m = S * 0.06;
  for (const [lx, ly, a, s] of fs) { const pet = s * 0.42, cx = clamp(lx + Math.sin(a) * pet, ox + m + s, ox + S - m - s), cy = clamp(ly - Math.cos(a) * pet, oy + m + s, oy + S - m - s * 0.6);
    brin(x, [lx, ly], [cx, cy], S * 0.004); feuilleErable(x, cx, cy, s, a + (r() - .5) * 0.5, 0.3 + 0.7 * r(), r()); }
}
function rameauBuisson(x, ox, oy, S, r) {
  for (let k = 0; k < 9; k++) { const a = (r() - 0.5) * 2.2, L = S * (0.3 + 0.25 * r()), b = [ox + S * 0.5, oy + S * 0.95], e = [b[0] + Math.sin(a) * L, b[1] - Math.cos(a) * L - S * 0.1];
    brin(x, b, e, S * 0.008);
    for (let i = 0; i < 9; i++) { const t = 0.2 + 0.8 * i / 8, p = [lerp(b[0], e[0], t), lerp(b[1], e[1], t)]; for (const sd of [-1, 1]) feuilleOvale(x, p[0], p[1], S * (0.07 + 0.03 * r()), S * 0.03, a + sd * (0.7 + 0.4 * r()), 0.3 + 0.7 * r(), r()); } }
}
function plateauPin(x, ox, oy, S, r) {        // vu de dessus : des touffes d'aiguilles serrées, en rosettes, sur des pousses en étoile
  const c = [ox + S / 2, oy + S / 2];
  for (let k = 0; k < 16; k++) { const a = r() * TAU, L = S * (0.08 + 0.3 * r()), e = [c[0] + Math.cos(a) * L, c[1] + Math.sin(a) * L]; brin(x, c, e, S * 0.012, 0.15);
    const R = S * (0.07 + 0.05 * r());
    x.fillStyle = dc(0.12, 0.5); x.beginPath(); x.ellipse(e[0], e[1], R * 0.75, R * 0.75, 0, 0, TAU); x.fill();
    for (let i = 0; i < 90; i++) { const b = r() * TAU, l = R * (0.5 + 0.7 * r()), sh = 0.2 + 0.8 * r() * (0.6 + 0.4 * Math.max(0, -Math.sin(b)));
      x.strokeStyle = dc(sh, r()); x.lineWidth = S * 0.02; x.lineCap = "round"; x.beginPath(); x.moveTo(e[0], e[1]); x.lineTo(e[0] + Math.cos(b) * l, e[1] + Math.sin(b) * l); x.stroke(); } }
}
function profilPin(x, ox, oy, S, r) {          // vu de côté : un nuage d'aiguilles au dessus plat et bombé, plus sombre dessous
  const base = oy + S * 0.7;
  brin(x, [ox + S * 0.05, base], [ox + S * 0.95, base - S * 0.04], S * 0.016, 0.12);
  for (let k = 0; k < 420; k++) { const u = 0.04 + 0.92 * r(), top = base - S * (0.08 + 0.26 * Math.sin(u * Math.PI)), py = lerp(base + S * 0.03, top, Math.sqrt(r())), px = ox + S * u;
    const a = -Math.PI / 2 + (r() - 0.5) * 2.2, l = S * (0.035 + 0.045 * r()), hh = (base - py) / (base - top + 1);
    x.strokeStyle = dc(0.15 + 0.85 * hh * (0.6 + 0.4 * r()), r()); x.lineWidth = S * 0.02; x.lineCap = "round"; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); }
}
function touffeHerbe(x, ox, oy, S, r) {
  for (let k = 0; k < 70; k++) { const bx = ox + S * (0.25 + 0.5 * r()), by = oy + S * 0.98, a = (r() - 0.5) * 1.3, L = S * (0.35 + 0.55 * r()), cv = (r() - 0.5) * 0.5;
    x.strokeStyle = dc(0.25 + 0.75 * r(), r()); x.lineWidth = S * (0.006 + 0.006 * r()); x.beginPath(); x.moveTo(bx, by); x.quadraticCurveTo(bx + Math.sin(a) * L * 0.5, by - Math.cos(a) * L * 0.5, bx + Math.sin(a + cv) * L, by - Math.cos(a + cv) * L); x.stroke(); }
  for (let f = 0; f < 3; f++) { const bx = ox + S * (0.3 + 0.4 * r()), by = oy + S * 0.98, a = (r() - 0.5) * 1.2, L = S * (0.5 + 0.3 * r()); for (let i = 1; i < 14; i++) { const t = i / 14, p = [bx + Math.sin(a) * L * t, by - Math.cos(a) * L * t]; for (const sd of [-1, 1]) feuilleOvale(x, p[0], p[1], S * 0.07 * (1 - t * 0.6), S * 0.015, a + sd * 1.3, 0.4 + 0.5 * r(), r()); } }
}
function rideauLianes(x, ox, oy, S, r) {
  for (let k = 0; k < 14; k++) { const bx = ox + S * (0.08 + 0.84 * r()), L = S * (0.4 + 0.58 * r()); let px = bx, py = oy + S * 0.02;
    for (let i = 0; i < 18; i++) { const ny = py + L / 18, nx = px + (r() - 0.5) * S * 0.02; brin(x, [px, py], [nx, ny], S * 0.004, 0.2); px = nx; py = ny;
      for (const sd of [-1, 1]) if (r() < 0.8) feuilleOvale(x, px, py, S * (0.035 + 0.02 * r()) * (1 - i / 30), S * 0.016, Math.PI + sd * (0.6 + 0.6 * r()), 0.3 + 0.6 * r(), r()); } }
}
function atlas() {
  const cv = document.createElement("canvas"); cv.width = AS; cv.height = AS / 2; const x = cv.getContext("2d", { willReadFrequently: true });
  const r = rng(11);
  for (let i = 0; i < 8; i++) {
    const ox = (i % 4) * CW, oy = Math.floor(i / 4) * CW;
    x.save(); x.beginPath(); x.rect(ox, oy, CW, CW); x.clip();
    if (i < 3) rameauErable(x, ox, oy, CW, r); else if (i === 3) rameauBuisson(x, ox, oy, CW, r); else if (i === 4) plateauPin(x, ox, oy, CW, r);
    else if (i === 5) profilPin(x, ox, oy, CW, r); else if (i === 6) touffeHerbe(x, ox, oy, CW, r); else rideauLianes(x, ox, oy, CW, r);
    x.restore();
  }
  const d = x.getImageData(0, 0, AS, AS / 2).data;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] < 8) { d[i] = 150; d[i + 1] = 128; d[i + 2] = 0; d[i + 3] = 0; }
  const t = new THREE.DataTexture(new Uint8Array(d.buffer, d.byteOffset, d.length), AS, AS / 2, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.flipY = false; t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 8; t.needsUpdate = true;
  return t;
}
// les cases sont rangées de haut en bas dans le canevas : la texture n'est pas retournée, v va donc vers le bas
const CASE = i => { const cx = i % 4, cy = Math.floor(i / 4); return [cx * CW / AS, (cy * CW) / (AS / 2), (cx + 1) * CW / AS, ((cy + 1) * CW) / (AS / 2)]; };

// ======================= matières =======================
// palettes : 0 érable (bordeaux, cramoisi, écarlate, orange, or, un peu de vert), 1 buisson (verts, puis rouges), 2 pin, 3 herbe
const PAL = /* glsl */`
vec3 flPal(float h, float k){
  if (k < 0.5){ vec3 c = mix(vec3(0.15, 0.012, 0.02), vec3(0.40, 0.015, 0.026), smoothstep(0.0, 0.25, h)); c = mix(c, vec3(0.66, 0.045, 0.02), smoothstep(0.25, 0.45, h));
    c = mix(c, vec3(0.78, 0.19, 0.022), smoothstep(0.45, 0.62, h)); c = mix(c, vec3(0.82, 0.44, 0.045), smoothstep(0.62, 0.8, h)); return mix(c, vec3(0.24, 0.30, 0.04), smoothstep(0.86, 1.0, h)); }
  if (k < 1.5){ vec3 c = mix(vec3(0.03, 0.085, 0.022), vec3(0.075, 0.18, 0.034), smoothstep(0.0, 0.25, h)); c = mix(c, vec3(0.19, 0.25, 0.045), smoothstep(0.25, 0.46, h));
    c = mix(c, vec3(0.46, 0.04, 0.026), smoothstep(0.5, 0.6, h)); c = mix(c, vec3(0.70, 0.19, 0.026), smoothstep(0.66, 0.78, h)); return mix(c, vec3(0.74, 0.47, 0.05), smoothstep(0.84, 0.95, h)); }
  if (k < 2.5){ vec3 c = mix(vec3(0.04, 0.09, 0.04), vec3(0.09, 0.20, 0.05), smoothstep(0.0, 0.5, h)); return mix(c, vec3(0.28, 0.34, 0.08), smoothstep(0.5, 1.05, h)); }
  vec3 c = mix(vec3(0.12, 0.19, 0.04), vec3(0.27, 0.33, 0.07), smoothstep(0.0, 0.6, h)); return mix(c, vec3(0.45, 0.36, 0.11), smoothstep(0.65, 1.0, h)); }
vec3 flPalT(float h, float k){ return k < 0.5 ? flPal(h + 0.1, k) * vec3(1.4, 1.9, 1.2) + vec3(0.05, 0.012, 0.0) : flPal(h, k) * vec3(1.3, 1.6, 0.9); }`;

// vent et passage du dragon : chaque sommet penche selon son poids (aW.x), les feuilles frémissent (aW.y)
export const uDragon = { value: [new THREE.Vector4(0, -999, 0, 0), new THREE.Vector4(0, -999, 0, 0), new THREE.Vector4(0, -999, 0, 0), new THREE.Vector4(0, -999, 0, 0)] };
const BEND = /* glsl */`
uniform float uTime; uniform vec4 uDrg[4]; attribute vec3 aW;
vec3 plier(vec3 p, vec3 base){
  float w = aW.x, ph = base.x * 0.031 + base.z * 0.027;
  vec3 d = vec3(0.0);
  float g = 0.55 + 0.45 * sin(uTime * 0.31 + base.x * 0.004) * sin(uTime * 0.17 + base.z * 0.005);
  d.x += (sin(uTime * 1.2 + ph) * 0.25 + 0.35 * g) * w * 0.55;
  d.z += cos(uTime * 0.9 + ph * 1.3) * w * 0.18;
  d += vec3(sin(uTime * 7.0 + aW.z * 40.0), cos(uTime * 6.1 + aW.z * 31.0), sin(uTime * 5.3 + aW.z * 17.0)) * aW.y * 0.045 * (0.5 + g);
  for (int i = 0; i < 4; i++){ vec3 q = base - uDrg[i].xyz; q.y *= 0.5; float l = length(q), k = uDrg[i].w * exp(-l * l / 900.0);
    vec3 dir = l > 0.1 ? normalize(vec3(q.x, 0.0, q.z)) : vec3(1.0, 0.0, 0.0); d += dir * k * w * 2.4 + vec3(0.0, -0.3, 0.0) * k * w; }
  return p + d;
}`;
function feuillage(map, kind, o = {}) {
  const m = new THREE.MeshLambertMaterial({ map, side: THREE.DoubleSide, vertexColors: true, alphaTest: 0.42 });
  m.alphaToCoverage = !!o.a2c;
  patch(m, s => {
    s.sh.uniforms.uDrg = uDragon;
    s.vHead(`${BEND}\nattribute vec4 aTree; varying vec4 vTree;`);
    s.v("#include <begin_vertex>", `#include <begin_vertex>
      vTree = aTree;
      { vec3 base = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; vec3 wp = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        vec3 np = plier(wp, base); transformed += (inverse(mat3(modelMatrix * instanceMatrix)) * (np - wp)); }`);
    s.fHead(`varying vec4 vTree; vec3 flN, flTr;\n${PAL}`);
    s.f("#include <color_fragment>", "");
    s.f("#include <map_fragment>", `
      { vec4 sp = texture2D(map, vMapUv);
        flN = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
        sp.a *= smoothstep(0.04, 0.25, abs(dot(flN, normalize(vViewPosition))));
        float hue = vTree.x + vColor.g + (sp.g - 0.5) * vTree.y;
        float lum = (0.46 + 0.86 * sp.r) * vColor.b * vTree.z;
        float face = smoothstep(-0.25, 0.25, dot(normalize(vNormal), normalize(vViewPosition)));
        vec3 leaf = flPal(hue, ${kind.toFixed(1)}) * lum * mix(0.62, 1.0, face), bois = vec3(0.06, 0.04, 0.03);
        diffuseColor = vec4(mix(leaf, bois, sp.b) * vColor.r, sp.a);
        flTr = flPalT(hue, ${kind.toFixed(1)}) * lum * (1.0 - sp.b) * mix(vColor.r, 1.0, 0.35); }`);
    if (o.a2c) s.f("#include <alphatest_fragment>", `{ float a = diffuseColor.a; diffuseColor.a = smoothstep(alphaTest, alphaTest + max(fwidth(a), 1e-4), a); if (diffuseColor.a < 0.02) discard; }`);
    s.f("#include <normal_fragment_begin>", `#include <normal_fragment_begin>
      #ifdef DOUBLE_SIDED
        normal *= faceDirection;
      #endif
      normal = normalize(mix(normal, flN, 0.25));`);
    s.f("#include <lights_lambert_pars_fragment>", `#include <lights_lambert_pars_fragment>
      void RE_Direct_Feuille(const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight){
        RE_Direct_Lambert(directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);
        float back = saturate(dot(-flN, directLight.direction)) + saturate(dot(flN, directLight.direction)) * 0.0, toward = saturate(dot(-geometryViewDir, directLight.direction));
        reflectedLight.directDiffuse += directLight.color * flTr * (saturate(dot(-geometryNormal, directLight.direction)) * 0.5 + 0.2) * (0.35 + 1.4 * toward * toward) * 0.55 * RECIPROCAL_PI; }
      #undef RE_Direct
      #define RE_Direct RE_Direct_Feuille`);
    s.f("#include <lights_fragment_end>", `#include <lights_fragment_end>
      { float ny = dot(normal, vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]));
        reflectedLight.indirectDiffuse += diffuseColor.rgb * (mix(vec3(0.06, 0.05, 0.05), vec3(0.16, 0.18, 0.24), ny * 0.5 + 0.5)); }`);
  }, "feuil" + kind + (o.a2c ? "a" : ""));
  // l'ombre portée suit le vent et respecte la découpe des feuilles
  const dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.42, side: THREE.DoubleSide });
  patch(dm, s => { s.sh.uniforms.uDrg = uDragon; s.vHead(BEND); s.v("#include <begin_vertex>", `#include <begin_vertex>
      { vec3 base = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; vec3 wp = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        transformed += inverse(mat3(modelMatrix * instanceMatrix)) * (plier(wp, base) - wp); }`); }, "feuilD");
  m.userData.depth = dm;
  return m;
}
function ecorce(teinte, k) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, color: new THREE.Color(...teinte) });
  patch(m, s => {
    s.sh.uniforms.uDrg = uDragon;
    s.vHead(BEND);
    s.v("#include <begin_vertex>", `#include <begin_vertex>
      { vec3 base = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; vec3 wp = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        transformed += inverse(mat3(modelMatrix * instanceMatrix)) * (plier(wp, base) - wp); }`);
    s.f("#include <color_fragment>", `#include <color_fragment>
      { float st = vnoise(vec2(vUv.y * 9.0, vUv.x * 0.9)), pl = vnoise(vec2(vUv.y * 4.0, vUv.x * 2.5));
        diffuseColor.rgb *= ${k === 1 ? "mix(vec3(0.75, 0.55, 0.45), vec3(1.15, 0.85, 0.65), smoothstep(0.3, 0.7, pl)) * (0.7 + 0.5 * st)" : "(0.65 + 0.55 * st) * mix(0.8, 1.1, pl)"}; }`);
  }, "ecorce" + k);
  m.defines = { USE_UV: "" };
  return m;
}

// ======================= géométrie =======================
// cartes : { b: base, ax: le long du rameau, n: normale de la carte, L, W, dr: tombée du bout, cell, ao, hu, br, sn: normale d'ombrage, wb: [poids base, bout], fl, ph, seg }
const sR = V(), sP = V();
function coins(k, out) {
  sR.crossVectors(k.ax, k.n).normalize(); let o = 0;
  for (let i = 0; i <= k.seg; i++) { const t = i / k.seg; sP.copy(k.b).addScaledVector(k.ax, k.L * t).addScaledVector(k.n, -k.dr * t * t); const w = k.W * 0.5;
    out[o++].copy(sP).addScaledVector(sR, -w); out[o++].copy(sP).addScaledVector(sR, w); }
  return o;
}
const sv = Array.from({ length: 12 }, () => V());
function cartesGeo(list) {
  let nv = 0, ni = 0; for (const k of list) { nv += (k.seg + 1) * 2; ni += k.seg * 6; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), col = new Float32Array(nv * 3), aw = new Float32Array(nv * 3), idx = new Uint32Array(ni); let v = 0, q = 0;
  for (const k of list) {
    const n = coins(k, sv), c = CASE(k.cell), v0 = v;
    for (let j = 0; j < n; j++, v++) { const p = sv[j], t = (j >> 1) / k.seg;
      pos[v * 3] = p.x; pos[v * 3 + 1] = p.y; pos[v * 3 + 2] = p.z; nor[v * 3] = k.sn.x; nor[v * 3 + 1] = k.sn.y; nor[v * 3 + 2] = k.sn.z;
      uv[v * 2] = (j & 1) ? c[2] : c[0]; uv[v * 2 + 1] = lerp(c[3], c[1], t);
      col[v * 3] = k.ao; col[v * 3 + 1] = k.hu; col[v * 3 + 2] = k.br;
      aw[v * 3] = lerp(k.wb[0], k.wb[1], t); aw[v * 3 + 1] = k.fl * (0.25 + 0.75 * t); aw[v * 3 + 2] = k.ph; }
    for (let i = 0; i < k.seg; i++) { const a = v0 + i * 2; idx[q++] = a; idx[q++] = a + 1; idx[q++] = a + 2; idx[q++] = a + 1; idx[q++] = a + 3; idx[q++] = a + 2; }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.BufferAttribute(nor, 3)); g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3)); g.setAttribute("aW", new THREE.BufferAttribute(aw, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}
function boisGeo(brs, wbOf, tint) {
  const gs = [];
  for (const b of brs) { const g = tubeGeo(b.pts, b.radii, b.sides), p = g.attributes.position.array, n = g.attributes.position.count, col = new Float32Array(n * 3), aw = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { sP.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]); const k = (0.5 + 0.5 * sm(0, 1.2, sP.y)) * (b.ao ?? 1); col[i * 3] = tint[0] * k; col[i * 3 + 1] = tint[1] * k; col[i * 3 + 2] = tint[2] * k; aw[i * 3] = wbOf(sP); }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3)); g.setAttribute("aW", new THREE.BufferAttribute(aw, 3)); gs.push(g); }
  return fusion(gs);
}
// ombre dans le houppier : combien de feuillage au-dessus de chaque carte
function ombreHouppier(list, cell = 1.3) {
  const m = new Map(), key = (i, k) => (i + 512) * 2048 + (k + 512), fl = Math.floor;
  const cs = list.map(k => V().copy(k.b).addScaledVector(k.ax, k.L * 0.5));
  cs.forEach((c, i) => { const kk = key(fl(c.x / cell), fl(c.z / cell)); if (!m.has(kk)) m.set(kk, []); m.get(kk).push(i); });
  cs.forEach((c, i) => { let n = 0; const ix = fl(c.x / cell), iz = fl(c.z / cell);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = m.get(key(ix + a, iz + b)); if (!l) continue; for (const q of l) { const o = cs[q], dy = o.y - c.y; if (dy > 0.25 && Math.hypot(o.x - c.x, o.z - c.z) < cell + dy * 0.35) n += list[q].L * list[q].W; } }
    list[i].over = n; });
}
const perp = (d, a, out) => { const u = Math.abs(d.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0); const x = V().crossVectors(d, u).normalize(), y = V().crossVectors(d, x); return out.copy(x).multiplyScalar(Math.cos(a)).addScaledVector(y, Math.sin(a)); };
const melange = (a, r) => { for (let i = a.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

// un érable : tronc, branches maîtresses qui s'écartent, rameaux ; une carte de feuilles au bout de chaque rameau
function erable(seed, o = {}) {
  const r = rng(seed), brs = [], list = [], brindilles = [], Ht = o.h ?? (6 + r() * 3.5), spread = o.spread ?? 1.0, tmp = V();
  function branche(p0, dir, len, rad, depth) {
    const n = Math.max(3, Math.round(len / 0.9)), pts = [p0.clone()], radii = [rad], d = dir.clone(); let p = p0.clone();
    for (let i = 1; i <= n; i++) {
      const wnd = depth === 0 ? 0.14 : 0.3; d.x += (r() - .5) * wnd; d.z += (r() - .5) * wnd; d.y += (r() - .5) * wnd * 0.5 + (depth === 0 ? 0.02 : -0.035); d.normalize();
      p = p.clone().addScaledVector(d, len / n); pts.push(p); radii.push(rad * (1 - 0.62 * i / n));
      if (depth < 3 && i > n * (depth === 0 ? 0.4 : 0.25) && r() < (depth === 0 ? 0.85 : 0.6)) {
        perp(d, r() * TAU, tmp); if (depth === 0) tmp.y = Math.abs(tmp.y) * 0.3;
        const cd = d.clone().multiplyScalar(depth === 0 ? 0.45 : 0.8).addScaledVector(tmp, spread).normalize(); if (depth === 0) cd.y = Math.max(cd.y, 0.15);
        branche(p, cd, len * (depth === 0 ? 0.8 + r() * 0.3 : 0.55 + r() * 0.25), radii[i] * 0.72, depth + 1);
      }
      if (depth >= 2 || (depth === 1 && i > n * 0.6)) brindilles.push([p, d.clone()]);
    }
    brs.push({ pts, radii, depth });
  }
  const dir = V((r() - .5) * 0.4 + (o.lean ? o.lean[0] : 0), 1, (r() - .5) * 0.4 + (o.lean ? o.lean[1] : 0)).normalize(), rad0 = 0.2 + Ht * 0.024;
  branche(V(0, -0.3, 0), dir, Ht, rad0, 0);
  // le houppier : des boules de feuillage (comme des nuages) au bout des branches ; chaque boule est faite de bouquets
  // posés sur sa surface, tournés vers l'extérieur, les plus profonds dans l'ombre
  const bouts = []; for (const b of brs) if (b.depth >= 1) for (let i = Math.floor(b.pts.length * 0.5); i < b.pts.length; i += 2) if (b.pts[i].y > Ht * 0.5) bouts.push(b.pts[i]);
  melange(bouts, r);
  const nb = Math.min(bouts.length, o.boules ?? 16), K = o.cartes ?? 1050, parBoule = Math.round(K / Math.max(1, nb));
  for (let bI = 0; bI < nb; bI++) {
    const c = bouts[bI], rc = (o.boule ?? 1.9) * (0.7 + 0.6 * r());
    for (let q = 0; q < parBoule; q++) {
      const u = r(), az = r() * TAU, el = Math.acos(1 - 1.7 * u) , dirn = V(Math.sin(el) * Math.cos(az), Math.cos(el) * 0.8, Math.sin(el) * Math.sin(az)).normalize();
      const prof = Math.sqrt(r()), p = c.clone().addScaledVector(dirn, rc * (0.35 + 0.65 * prof)); p.y = c.y + (p.y - c.y) * 0.72 + rc * 0.2;
      const ax = V().crossVectors(dirn, V(0, 1, 0)); if (ax.lengthSq() < 0.01) ax.set(1, 0, 0); ax.normalize().applyAxisAngle(dirn, r() * TAU);
      const nn = dirn.clone().lerp(V(0, 1, 0), 0.35).normalize(); nn.addScaledVector(ax, -nn.dot(ax)).normalize();
      const L = (o.feuille ?? 2.0) * (0.75 + r() * 0.5);
      list.push({ b: p.addScaledVector(ax, -L * 0.5), ax, n: nn, L, W: L * (0.85 + 0.2 * r()), dr: 0, cell: (r() * 3) | 0, seg: 1, ph: r(), fl: 0.7 + 0.6 * r(), prof });
    }
  }
  const cc = V(); for (const k of list) cc.add(k.b); cc.multiplyScalar(1 / list.length); let Rc = 0; for (const k of list) Rc = Math.max(Rc, k.b.distanceTo(cc));
  ombreHouppier(list);
  const wbOf = p => Math.pow(clamp(p.length() / (Ht * 1.05), 0, 1.25), 1.6), out = V(), ce = V();
  for (const k of list) { ce.copy(k.b).addScaledVector(k.ax, k.L * 0.5); out.subVectors(ce, cc); const rr = out.length() / Rc; out.normalize();
    k.ao = (0.45 + 0.55 / (1 + 0.12 * k.over)) * (0.62 + 0.38 * (k.prof ?? 1)) * (0.78 + 0.22 * sm(0.2, 0.9, rr)) * (0.9 + 0.2 * r());
    k.hu = 0.09 * (sm(0.35, 1.0, rr) - 0.5) + 0.05 * (1 / (1 + 0.3 * k.over) - 0.5) + (r() - .5) * 0.1; k.br = 0.8 + 0.4 * r();
    k.sn = V().copy(k.n).multiplyScalar(0.45).addScaledVector(out, 0.65).add(V(0, 0.18, 0)).normalize(); k.wb = [wbOf(k.b), wbOf(sP.copy(k.b).addScaledVector(k.ax, k.L))]; }
  melange(list, rng(seed * 31 + 5));
  const bois = []; for (const b of brs) { if (b.radii[0] < 0.07 || b.depth > 2) continue; const rr = b.radii.slice(); if (b.depth === 0) for (let i = 0; i < 3 && i < rr.length; i++) rr[i] *= 1 + 0.55 * Math.exp(-i * 1.1);
    bois.push({ pts: b.pts, radii: rr, sides: b.depth === 0 ? 7 : b.depth === 1 ? 4 : 3, ao: b.depth === 0 ? 1 : 0.85 }); }
  return { bois: boisGeo(bois, wbOf, [0.95, 0.9, 0.86]), feuilles: cartesGeo(list), n: list.length, H: Ht, Rc };
}
// un pin des falaises : tronc tordu, quelques longues branches presque horizontales qui portent des plateaux d'aiguilles plats
function pin(seed, o = {}) {
  const r = rng(seed), brs = [], list = [], Ht = o.h ?? (7 + r() * 5), tmp = V();
  const tronc = [V(0, -0.3, 0)], tr = []; let d = V((r() - .5) * 0.6, 1, (r() - .5) * 0.6).normalize(), p = tronc[0].clone();
  const nt = 10; for (let i = 1; i <= nt; i++) { d.x += (r() - .5) * 0.35; d.z += (r() - .5) * 0.35; d.normalize(); p = p.clone().addScaledVector(d, Ht / nt); tronc.push(p); }
  for (let i = 0; i <= nt; i++) tr.push((0.22 + Ht * 0.022) * (1 - 0.7 * i / nt) * (i < 2 ? 1.3 : 1));
  brs.push({ pts: tronc, radii: tr, sides: 8 });
  const plateau = (c, s) => {    // un nuage plat d'aiguilles : cartes presque à plat, quelques cartes de profil sur le pourtour
    const n = Math.round(6 + s * 4);
    for (let i = 0; i < n; i++) { const a = r() * TAU, rr = s * Math.sqrt(r()) * 0.75, b = V(c.x + Math.cos(a) * rr, c.y + (r() - 0.4) * 0.35, c.z + Math.sin(a) * rr);
      const L = s * (0.7 + 0.4 * r()), ax = V(Math.cos(r() * TAU), 0, Math.sin(r() * TAU)).normalize(), nn = V((r() - .5) * 0.3, 1, (r() - .5) * 0.3).normalize(); nn.addScaledVector(ax, -nn.dot(ax)).normalize();
      list.push({ b: b.addScaledVector(ax, -L / 2), ax, n: nn, L, W: L, dr: 0, cell: 4, seg: 1, ph: r(), fl: 0.3, top: 1 }); }
    for (let i = 0; i < 5; i++) { const a = r() * TAU, ax = V(-Math.sin(a), 0, Math.cos(a)), L = s * 1.3; const b = V(c.x + Math.cos(a) * s * 0.55, c.y - s * 0.3, c.z + Math.sin(a) * s * 0.55).addScaledVector(ax, -L / 2);
      list.push({ b, ax, n: V(Math.cos(a), 0, Math.sin(a)), L, W: L * 0.5, dr: 0, cell: 5, seg: 1, ph: r(), fl: 0.3, side: 1 }); }
  };
  const nb = 4 + (r() * 4 | 0);
  for (let k = 0; k < nb; k++) {
    const t = 0.45 + 0.55 * k / nb, i0 = Math.round(t * nt), p0 = tronc[Math.min(nt, i0)], a = r() * TAU + k * 2.3, len = Ht * (0.35 + 0.35 * r()) * (1.1 - t * 0.6);
    const pts = [p0.clone()], radii = [tr[Math.min(nt, i0)] * 0.6], dir = V(Math.cos(a), 0.15 + r() * 0.2, Math.sin(a)).normalize(); let q = p0.clone();
    for (let i = 1; i <= 6; i++) { dir.y += 0.05; dir.normalize(); q = q.clone().addScaledVector(dir, len / 6); pts.push(q); radii.push(radii[0] * (1 - 0.7 * i / 6)); }
    brs.push({ pts, radii, sides: 5 });
    plateau(q.clone().add(V(0, 0.35, 0)), 1.6 + r() * 1.4);
    if (len > 3) plateau(pts[3].clone().add(V(0, 0.4, 0)), 1.1 + r() * 0.8);
  }
  plateau(tronc[nt].clone().add(V(0, 0.3, 0)), 2.0 + r());
  const wbOf = p => Math.pow(clamp(p.length() / (Ht * 1.05), 0, 1.25), 1.6) * 0.5;
  for (const k of list) { k.ao = k.top ? 0.75 + 0.35 * r() : 0.55; k.hu = (r() - .5) * 0.2 + (k.top ? 0.1 : -0.1); k.br = 0.8 + 0.4 * r(); k.sn = k.top ? V(0, 1, 0) : V().copy(k.n).add(V(0, 0.6, 0)).normalize(); k.wb = [wbOf(k.b), wbOf(k.b)]; }
  melange(list, rng(seed * 7 + 1));
  return { bois: boisGeo(brs, wbOf, [0.62, 0.36, 0.26]), feuilles: cartesGeo(list), n: list.length, H: Ht };
}
// un buisson : des rameaux posés sur un dôme, l'intérieur dans l'ombre
function buisson(seed, cellule, n = 40) {
  const r = rng(seed), list = [];
  for (let i = 0; i < n; i++) { const u = r(), a = r() * TAU, el = Math.acos(1 - u * 0.95), rr = 1.0 * (0.75 + 0.3 * r());
    const dirn = V(Math.sin(el) * Math.cos(a), Math.cos(el) * 0.75, Math.sin(el) * Math.sin(a)).normalize(), c = dirn.clone().multiplyScalar(rr).add(V(0, 0.5, 0));
    const ax = V().crossVectors(dirn, V(0, 1, 0)); if (ax.lengthSq() < 0.01) ax.set(1, 0, 0); ax.normalize().applyAxisAngle(dirn, r() * TAU);
    const L = 0.9 + 0.5 * r(); list.push({ b: c.clone().addScaledVector(ax, -L / 2), ax, n: dirn, L, W: L, dr: 0.1, cell: cellule, seg: 1, ph: r(), fl: 0.8, ao: 0.5 + 0.5 * sm(-0.2, 0.9, dirn.y), hu: (r() - .5) * 0.15, br: 0.85 + 0.3 * r(), sn: dirn, wb: [0.15, 0.4] }); }
  melange(list, r); return cartesGeo(list);
}
// une touffe d'herbe : quelques cartes croisées
function touffe(seed) {
  const r = rng(seed), list = [];
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI + r() * 0.3, ax = V(0, 1, 0), n = V(Math.cos(a), 0, Math.sin(a)), L = 0.7 + 0.4 * r(), side = V().crossVectors(ax, n);
    list.push({ b: V().addScaledVector(side, (r() - .5) * 0.3), ax, n, L, W: L * 1.2, dr: -0.08, cell: 6, seg: 2, ph: r(), fl: 0.6, ao: 1, hu: (r() - .5) * 0.2, br: 0.9 + 0.2 * r(), sn: V(0, 1, 0), wb: [0, 0.35] }); }
  return cartesGeo(list);
}
// rideau de lianes (sur une paroi : y vers le haut, z hors de la paroi)
function rideau(seed) {
  const r = rng(seed), list = [];
  for (let i = 0; i < 3; i++) { const L = 3 + r() * 3; list.push({ b: V((i - 1) * 1.2, 0, 0.2 + 0.2 * r()), ax: V(0, -1, 0.05).normalize(), n: V(0, 0, 1), L, W: 1.6, dr: -0.3, cell: 7, seg: 2, ph: r(), fl: 0.5, ao: 0.8, hu: (r() - .5) * 0.2, br: 0.9, sn: V(0, 0.3, 1).normalize(), wb: [0, 0.4] }); }
  return cartesGeo(list);
}

// ======================= plantation =======================
const inst = (geo, mat, list, scene, o = {}) => {
  const im = new THREE.InstancedMesh(geo, mat, list.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = V(), p = V();
  const at = new Float32Array(list.length * 4);
  list.forEach((k, i) => { e.set(k.rx || 0, k.yaw, k.rz || 0); q.setFromEuler(e); m.compose(p.set(k.p[0], k.p[1], k.p[2]), q, s.set(k.s, k.sy ?? k.s, k.s)); im.setMatrixAt(i, m); at.set(k.tree || [0.5, 1, 1, 0], i * 4); });
  geo.setAttribute("aTree", new THREE.InstancedBufferAttribute(at, 4));
  im.castShadow = o.ombre !== false; im.receiveShadow = true; if (mat.userData.depth) im.customDepthMaterial = mat.userData.depth;
  im.computeBoundingSphere(); im.frustumCulled = o.cull !== false; scene.add(im); return im;
};
// LOD : la même géométrie sous deux objets, dont l'un ne dessine que la première part des cartes (déjà mélangées : c'est un éclaircissement régulier)
function vue(g, part) { const v = new THREE.BufferGeometry(); for (const k of Object.keys(g.attributes)) v.setAttribute(k, g.attributes[k]); v.setIndex(g.index); v.setDrawRange(0, Math.floor(g.index.count * part / 6) * 6); return v; }

export const Flore = { groupes: [], arbres: [] };
export function construireFlore(scene, qualite) {
  const k = qualite === "rapide" ? 0.45 : qualite === "moyenne" ? 0.75 : 1, a2c = qualite !== "rapide";
  const tex = atlas();
  const matE = feuillage(tex, 0, { a2c }), matB = feuillage(tex, 1, { a2c }), matP = feuillage(tex, 2, { a2c }), matH = feuillage(tex, 3, { a2c: false });
  const bE = ecorce([0.30, 0.25, 0.22], 0), bP = ecorce([0.45, 0.27, 0.18], 1);
  const r = rng(555);
  const libre = (x, z, rr) => {
    if (dansPic(x, H(x, z) + 2, z, rr)) return false;
    if (pave(x, z) > 0.1) return false;
    if (Math.abs(platD(x, z)) < 8) return false;
    return true;
  };
  // ---- érables : 6 formes ----
  const formesE = [0, 1, 2, 3, 4, 5].map(i => erable(101 + i * 13, { h: 6 + (i % 3) * 1.6, spread: 0.9 + (i % 2) * 0.25 }));
  const listesE = formesE.map(() => []);
  const planter = (x, z, s, h) => { const y = H(x, z); listesE[(r() * 6) | 0].push({ p: [x, y - 0.2, z], yaw: r() * TAU, s: s * (1.15 + r() * 0.45), tree: [h ?? 0.18 + r() * 0.62, 0.12 + r() * 0.06, 0.95 + 0.3 * r(), r()] }); };
  let n = 0;
  for (let i = 0; i < 40000 && n < 560 * k; i++) {
    const x = (r() - .5) * 1300, z = LAC.z - 60 + (r() - .5) * 1150, d = lacD(x, z);
    if (d < 6 || Math.hypot(x - LAC.x, z - LAC.z) > 640) continue;
    const pd = platD(x, z);
    const dens = pd < -10 ? 0.55 : foret(x, z) * 0.85 + (d < 40 ? 0.35 : 0) + 0.04;
    if (r() > dens) continue;
    if (!libre(x, z, 3)) continue;
    if (Math.hypot(x - 40, z - 330) < 40) continue;
    planter(x, z, 1); n++;
  }
  for (const [x, z] of [[-60, 95], [-40, 110], [-75, 80]]) planter(x, z, 1.1);   // l'île
  // ---- pins : 4 formes, sur les sommets et corniches, et quelques-uns au sol ----
  const formesP = [0, 1, 2, 3].map(i => pin(301 + i * 17, { h: 7 + i * 1.5 }));
  const listesP = formesP.map(() => []);
  for (const s of SITES.sommet) { const nb = Math.max(1, Math.round(s[3] / 6)); for (let j = 0; j < nb; j++) { const a = r() * TAU, rr = r() * s[3]; listesP[(r() * 4) | 0].push({ p: [s[0] + Math.cos(a) * rr, s[1] - 1.5 - rr * 0.15, s[2] + Math.sin(a) * rr], yaw: r() * TAU, s: 1.9 + r() * 1.2, tree: [0.3 + r() * 0.5, 0.2, 0.85 + 0.3 * r(), r()] }); } }
  for (const s of SITES.corniche) if (r() < 0.14 * k) listesP[(r() * 4) | 0].push({ p: [s[0], s[1] - 0.6, s[2]], yaw: r() * TAU, s: 0.5 + r() * 0.5, rx: (s[5]) * 0.5, rz: -(s[3]) * 0.5, tree: [0.3 + r() * 0.5, 0.2, 0.8 + 0.3 * r(), r()] });
  // ---- buissons ----
  const formesB = [buisson(901, 3), buisson(902, 3, 30), buisson(903, 0, 34)];
  const listesB = formesB.map(() => []);
  for (let i = 0; i < 30000 && listesB.reduce((a, l) => a + l.length, 0) < 1400 * k; i++) {
    const x = (r() - .5) * 1300, z = LAC.z - 60 + (r() - .5) * 1150; if (lacD(x, z) < 2 || Math.hypot(x - LAC.x, z - LAC.z) > 640 || !libre(x, z, 1)) continue;
    const j = r() < 0.25 ? 2 : (r() * 2) | 0; listesB[j].push({ p: [x, H(x, z) - 0.15, z], yaw: r() * TAU, s: 0.7 + r() * 1.0, tree: j === 2 ? [r() * 0.7, 0.12, 0.9, 0] : [r() < 0.2 ? 0.55 + r() * 0.4 : r() * 0.45, 0.15, 0.9 + 0.2 * r(), 0] });
  }
  for (const s of SITES.corniche) if (r() < 0.75 * k) { const j = r() < 0.4 ? 2 : 0; listesB[j].push({ p: [s[0], s[1] - 0.3, s[2]], yaw: r() * TAU, s: 0.5 + r() * 0.9, tree: [r() < 0.4 ? 0.5 + r() * 0.4 : r() * 0.4, 0.15, 0.9, 0] }); }
  // ---- plantes suspendues ----
  const geoR = rideau(77), listeR = [];
  for (const s of SITES.suspendu) if (r() < 0.5 * k) { const yaw = Math.atan2(s[3], s[5]); listeR.push({ p: [s[0], s[1], s[2]], yaw, s: 0.8 + r() * 0.8, tree: [0.2 + r() * 0.4, 0.2, 0.9, 0] }); }

  const pose = (formes, listes, mat, bm, nom) => formes.forEach((f, i) => {
    if (!listes[i].length) return;
    const geoN = f.feuilles || f, near = inst(geoN, mat, listes[i], scene);
    let far = null;
    if (f.feuilles) {
      const gf = vue(geoN, 0.34); gf.setAttribute("aTree", geoN.attributes.aTree);
      far = new THREE.InstancedMesh(gf, mat, listes[i].length); far.castShadow = false; far.receiveShadow = true; far.frustumCulled = false; far.count = 0; far.layers.set(1); scene.add(far);
      const wood = inst(f.bois, bm, listes[i], scene);
      Flore.groupes.push({ near, far, liste: listes[i], wood, nom });
    }
  });
  pose(formesE, listesE, matE, bE, "erable");
  pose(formesP, listesP, matP, bP, "pin");
  formesB.forEach((g, i) => { if (listesB[i].length) inst(g, i === 2 ? matE : matB, listesB[i], scene, { ombre: i !== 1 }); });
  if (listeR.length) inst(geoR, matB, listeR, scene, { ombre: false });
  // ---- l'herbe : des touffes autour de la caméra, placées par le shader sur une grille qui suit la caméra ----
  Flore.herbe = herbe(scene, tex, qualite);
  for (const l of listesE) for (const t of l) Flore.arbres.push(t);
  for (const l of listesP) for (const t of l) Flore.arbres.push(t);
  Flore.mats = [matE, matB, matP, matH];
  return Flore;
}

// LOD : on range chaque arbre dans « près » (toutes les cartes) ou « loin » (42 %), selon la distance à la caméra
const mm = new THREE.Matrix4(), dernier = V(1e9, 0, 0);
export function majFlore(cam, force) {
  if (!force && cam.position.distanceToSquared(dernier) < 100) return; dernier.copy(cam.position);
  const D2 = 95 * 95, q = new THREE.Quaternion(), e = new THREE.Euler(), s = V(), p = V();
  for (const g of Flore.groupes) {
    let a = 0, b = 0; const aN = g.near.geometry.attributes.aTree, aF = g.far.geometry.attributes.aTree;
    // les deux objets partagent la même liste d'attributs par arbre : on réordonne les matrices et on garde aTree au même ordre
    const ordre = [], loin = [];
    for (let i = 0; i < g.liste.length; i++) { const t = g.liste[i], dx = t.p[0] - cam.position.x, dy = t.p[1] - cam.position.y, dz = t.p[2] - cam.position.z; ((dx * dx + dy * dy + dz * dz) < D2 ? ordre : loin).push(i); }
    if (!g.arr) { g.arr = new Float32Array(g.liste.length * 4); g.base = aN.array.slice(); g.nearT = new Float32Array(g.liste.length * 4); g.farT = new Float32Array(g.liste.length * 4);
      g.near.geometry.setAttribute("aTree", new THREE.InstancedBufferAttribute(g.nearT, 4)); g.far.geometry.setAttribute("aTree", new THREE.InstancedBufferAttribute(g.farT, 4)); }
    const set = (mesh, list, T) => { list.forEach((i, j) => { const t = g.liste[i]; e.set(t.rx || 0, t.yaw, t.rz || 0); q.setFromEuler(e); mm.compose(p.set(t.p[0], t.p[1], t.p[2]), q, s.set(t.s, t.sy ?? t.s, t.s)); mesh.setMatrixAt(j, mm); T.set(g.base.subarray(i * 4, i * 4 + 4), j * 4); });
      mesh.count = list.length; mesh.instanceMatrix.needsUpdate = true; mesh.geometry.attributes.aTree.needsUpdate = true; };
    set(g.near, ordre, g.nearT); set(g.far, loin, g.farT);
    g.near.computeBoundingSphere(); g.far.boundingSphere = null; g.near.frustumCulled = false;
  }
}

// ======================= l'herbe =======================
function herbe(scene, tex, qualite) {
  const geo = touffe(4040), NB = qualite === "rapide" ? 6000 : qualite === "moyenne" ? 11000 : 17000, R = qualite === "rapide" ? 50 : 70;
  const ig = new THREE.InstancedBufferGeometry(); for (const k of Object.keys(geo.attributes)) ig.setAttribute(k, geo.attributes[k]); ig.setIndex(geo.index); ig.instanceCount = NB;
  const r = rng(77), off = new Float32Array(NB * 4);
  for (let i = 0; i < NB; i++) { off[i * 4] = r(); off[i * 4 + 1] = r(); off[i * 4 + 2] = r(); off[i * 4 + 3] = r(); }
  ig.setAttribute("aOff", new THREE.InstancedBufferAttribute(off, 4)); ig.setAttribute("aTree", new THREE.InstancedBufferAttribute(new Float32Array(NB * 4).fill(1), 4));
  const m = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide, vertexColors: true, alphaTest: 0.45 });
  const u = { tCarte: { value: CARTE.tex }, uCarte: { value: new THREE.Vector4(CARTE.x0, CARTE.z0, CARTE.T, 0) }, uCam: { value: V() }, uR: { value: R }, uDrg: uDragon };
  patch(m, s => {
    Object.assign(s.sh.uniforms, u);
    s.vHead(`uniform sampler2D tCarte; uniform vec4 uCarte; uniform vec3 uCam; uniform float uR; uniform float uTime; uniform vec4 uDrg[4]; attribute vec4 aOff, aTree; attribute vec3 aW; varying vec4 vTree; varying float vFade;`);
    s.v("#include <begin_vertex>", `
      vec2 cell = floor(uCam.xz / (2.0 * uR));
      vec2 wp2 = (cell + aOff.xy) * 2.0 * uR; if (wp2.x - uCam.x > uR) wp2.x -= 2.0 * uR; if (wp2.x - uCam.x < -uR) wp2.x += 2.0 * uR; if (wp2.y - uCam.z > uR) wp2.y -= 2.0 * uR; if (wp2.y - uCam.z < -uR) wp2.y += 2.0 * uR;
      vec4 cs = texture2D(tCarte, (wp2 - uCarte.xy) / uCarte.z);
      float dd = length(wp2 - uCam.xz); vFade = smoothstep(uR, uR * 0.7, dd);
      float sc = (0.6 + 0.8 * aOff.w) * step(aOff.z, cs.g) * vFade;
      float an = aOff.z * 40.0, ca = cos(an), sa = sin(an);
      vec3 transformed = vec3(ca * position.x - sa * position.z, position.y, sa * position.x + ca * position.z) * sc;
      vec3 base = vec3(wp2.x, cs.r, wp2.y);
      { float w = aW.x * position.y; float g = 0.55 + 0.45 * sin(uTime * 0.31 + base.x * 0.004) * sin(uTime * 0.17 + base.z * 0.005);
        transformed.x += (sin(uTime * 1.7 + base.x * 0.2 + base.z * 0.13) * 0.2 + 0.3 * g) * w * 0.6;
        for (int i = 0; i < 4; i++){ vec3 q = base - uDrg[i].xyz; float l = length(q), k = uDrg[i].w * exp(-l * l / 400.0); vec2 dir = l > 0.1 ? normalize(q.xz) : vec2(1.0, 0.0); transformed.xz += dir * k * w * 1.6; transformed.y -= k * w * 0.3; } }
      transformed += base;
      vTree = vec4(0.25 + 0.5 * cs.b + aOff.y * 0.35, 0.2, 0.85 + 0.3 * aOff.x, 0.0);`);
    s.v("#include <beginnormal_vertex>", "vec3 objectNormal = vec3(0.0, 1.0, 0.0);");
    s.fHead(`varying vec4 vTree; varying float vFade;\n${PAL}`);
    s.f("#include <color_fragment>", "");
    s.f("#include <map_fragment>", `{ vec4 sp = texture2D(map, vMapUv); float lum = (0.5 + 0.8 * sp.r) * vTree.z;
      diffuseColor = vec4(flPal(vTree.x + (sp.g - 0.5) * 0.2, 3.0) * lum * mix(0.55, 1.0, vMapUv.y < 0.5 ? 1.0 : 1.0), sp.a); }`);
    s.f("#include <lights_fragment_end>", `#include <lights_fragment_end>
      reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(0.10, 0.12, 0.14);`);
  }, "herbe");
  const mesh = new THREE.Mesh(ig, m); mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.layers.set(1);
  scene.add(mesh);
  return { mesh, u };
}
