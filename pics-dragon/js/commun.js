// Les Pics du Dragon — outils communs : hasard, bruit, géométrie, sculpture par champs de distance, retouches de shaders,
// lumière du jour et brume partagées par toutes les matières.
// Principes appris en lisant « Crimson Loong » (ChetasLua) ; code écrit pour ce jeu.
import * as THREE from "three";

export const Q = new URLSearchParams(location.search);
export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
export const lerp = (a, b, t) => a + (b - a) * t;
export const sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const hI = (i, j, k = 0) => { let n = Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(j | 0, 0x165667b1) ^ Math.imul(k | 0, 0x9e3779b1); n = Math.imul(n ^ (n >>> 15), 0x2c1b3c6d); n = Math.imul(n ^ (n >>> 12), 0x297a2d39); return (n ^ (n >>> 15)) >>> 0; };
export const h01 = (i, j, k = 0) => hI(i, j, k) / 4294967296;
export const keyed = ks => x => { if (x <= ks[0][0]) return ks[0][1]; for (let i = 1; i < ks.length; i++) if (x <= ks[i][0]) return lerp(ks[i - 1][1], ks[i][1], (x - ks[i - 1][0]) / (ks[i][0] - ks[i - 1][0])); return ks[ks.length - 1][1]; };

// ---------- bruit de Perlin (3D) et ses sommes ----------
export const N = (() => {
  const p = new Uint8Array(512), r = rng(7319), perm = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const gr = (h, x, y, z) => { h &= 15; const u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14) ? x : z; return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); };
  const l = (a, b, t) => a + (b - a) * t;
  function n3(x, y, z) {
    let X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z); x -= X; y -= Y; z -= Z; X &= 255; Y &= 255; Z &= 255;
    const u = fade(x), v = fade(y), w = fade(z), A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z, B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
    return l(l(l(gr(p[AA], x, y, z), gr(p[BA], x - 1, y, z), u), l(gr(p[AB], x, y - 1, z), gr(p[BB], x - 1, y - 1, z), u), v),
      l(l(gr(p[AA + 1], x, y, z - 1), gr(p[BA + 1], x - 1, y, z - 1), u), l(gr(p[AB + 1], x, y - 1, z - 1), gr(p[BB + 1], x - 1, y - 1, z - 1), u), v), w);
  }
  const fbm = (x, y, z, o = 5) => { let a = .5, s = 0, f = 1; for (let i = 0; i < o; i++) { s += a * n3(x * f, y * f, z * f); f *= 2.03; a *= .5; } return s; };
  const ridged = (x, y, z, o = 5) => { let a = .5, s = 0, f = 1, w = 1; for (let i = 0; i < o; i++) { let n = 1 - Math.abs(n3(x * f, y * f, z * f)); n *= n; s += n * a * w; w = clamp(n * 1.6); f *= 2.11; a *= .5; } return s; };
  return { n3, fbm, ridged };
})();

// ---------- état partagé ----------
export const G = { uTime: { value: 0 }, uWind: { value: 0 }, tick: [], qualite: "haute" };

// ---------- lumière du jour : le soleil de l'après-midi, haut et doré, dans un ciel bleu ----------
export const SUN = V(-0.46, 0.56, -0.69).normalize();
export const SUN_COL = new THREE.Color(1.0, 0.86, 0.68);
const g3 = v => `vec3(${v.x.toFixed(5)},${v.y.toFixed(5)},${v.z.toFixed(5)})`;

export const GLSL_NOISE = /* glsl */`
float hash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float hash31(vec3 p3){ p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 x){ vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y); }
float vnoise3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x), mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x), mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm2(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
float fbm3(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * vnoise3(p); p = p * 2.03 + vec3(1.7, 9.2, 4.1); a *= 0.5; } return s; }
`;

// Le ciel, la brume et l'ombre des nuages : une seule source pour le ciel, l'eau et toutes les matières.
// La brume est plus épaisse en bas, et sa couleur est celle de l'horizon dans la même direction.
export const GLSL_ATMO = /* glsl */`
const vec3 SUN_DIR = ${g3(SUN)};
const vec3 SUN_C = vec3(${SUN_COL.r.toFixed(3)}, ${SUN_COL.g.toFixed(3)}, ${SUN_COL.b.toFixed(3)});
vec3 skyBase(vec3 d){
  float h = clamp(d.y, -0.2, 1.0), s = max(dot(d, SUN_DIR), 0.0);
  vec3 zen = vec3(0.028, 0.115, 0.46), hor = vec3(0.40, 0.58, 0.86), low = vec3(0.62, 0.67, 0.74);
  vec3 c = mix(hor, zen, pow(max(h, 0.0), 0.42));
  c = mix(c, low, smoothstep(0.08, -0.08, h));
  c += vec3(1.0, 0.70, 0.40) * (0.10 * pow(s, 8.0) + 0.05 * pow(s, 2.0)) * (1.0 - 0.6 * max(h, 0.0));
  return c;
}
vec3 hazeCol(vec3 d){ d.y = max(d.y, 0.0) * 0.35 + 0.02; vec3 c = skyBase(normalize(d)); float s = max(dot(normalize(d), SUN_DIR), 0.0); return c * 1.02 + vec3(0.30, 0.20, 0.10) * pow(s, 8.0); }
float hazeAmt(vec3 wp, vec3 cam){
  vec3 rd = wp - cam; float dist = length(rd); rd /= max(dist, 1e-3);
  const float b = 0.0095, d0 = 0.00055; float k = dist * rd.y * b;
  float term = abs(k) > 1e-4 ? (1.0 - exp(-k)) / (rd.y * b) : dist;
  float a = d0 * exp(-max(cam.y, -20.0) * b) * term + dist * 0.000022;
  return 1.0 - exp(-a);
}
vec3 hazeApply(vec3 col, vec3 wp, vec3 cam){ return mix(col, hazeCol(normalize(wp - cam)), hazeAmt(wp, cam)); }
// ombre des nuages qui passent (sur le sol, portée le long des rayons du soleil)
float cloudShade(vec3 wp){
  vec2 p = (wp.xz - SUN_DIR.xz / SUN_DIR.y * wp.y) * 0.0024 + vec2(ATMO_T * 0.0045, ATMO_T * 0.0021);
  float n = vnoise(p) * 0.65 + vnoise(p * 2.3 + 7.1) * 0.35;
  return mix(1.0, 0.42, smoothstep(0.56, 0.74, n));
}
`;

// La brume de three.js est remplacée pour toutes les matières, et le soleil passe par l'ombre des nuages.
// Le temps arrive par fogDensity (la brume de three.js ne s'en sert plus) : scene.fog.density = temps, à chaque image.
THREE.ShaderChunk.fog_pars_vertex = `#ifdef USE_FOG
varying vec3 vFogW;
#endif`;
THREE.ShaderChunk.fog_vertex = `#ifdef USE_FOG
{ vec4 fw = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
fw = instanceMatrix * fw;
#endif
vFogW = (modelMatrix * fw).xyz; }
#endif`;
THREE.ShaderChunk.fog_pars_fragment = `#ifdef USE_FOG
varying vec3 vFogW; uniform vec3 fogColor; uniform float fogDensity;
#define ATMO_T fogDensity
${GLSL_NOISE}
${GLSL_ATMO}
#endif`;
THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
gl_FragColor.rgb = hazeApply(gl_FragColor.rgb, vFogW, cameraPosition);
#endif`;
THREE.ShaderChunk.lights_fragment_begin = THREE.ShaderChunk.lights_fragment_begin.replace(
  "getDirectionalLightInfo( directionalLight, directLight );",
  "getDirectionalLightInfo( directionalLight, directLight );\n\t\t#ifdef USE_FOG\n\t\tif ( UNROLLED_LOOP_INDEX == 0 ) directLight.color *= cloudShade( vFogW );\n\t\t#endif");
// pour les ShaderMaterial maison : tout le nécessaire, avec le temps en uniforme
export const GLSL_ATMO_SEUL = `uniform float uTime;\n#define ATMO_T uTime\n${GLSL_NOISE}\n${GLSL_ATMO}`;

// ---------- retouche d'une matière (onBeforeCompile) ----------
// fn(s) reçoit s.v(chunk, remplacement), s.f(...), s.vHead(txt), s.fHead(txt), s.sh (le shader), s.u (uniformes à ajouter)
export function patch(mat, fn, cle) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = G.uTime;
    const s = {
      sh,
      v: (a, b) => { if (!sh.vertexShader.includes(a)) console.warn("patch: absent (v)", a); sh.vertexShader = sh.vertexShader.replace(a, b); },
      f: (a, b) => { if (!sh.fragmentShader.includes(a)) console.warn("patch: absent (f)", a); sh.fragmentShader = sh.fragmentShader.replace(a, b); },
      vHead: t => { sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\n" + t); },
      fHead: t => { sh.fragmentShader = sh.fragmentShader.replace("#include <fog_pars_fragment>", "#include <fog_pars_fragment>\n" + t); },
    };
    if (!sh.fragmentShader.includes("#include <fog_pars_fragment>")) s.fHead = t => { sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\n" + t); };
    fn(s);
  };
  mat.customProgramCacheKey = () => cle;
  return mat;
}
export const GLSL_VNOISE_V = GLSL_NOISE; // pour les vertex shaders qui en ont besoin

// ---------- géométrie ----------
export function tubeGeo(pts, radii, sides = 8, upHint) {
  const n = pts.length, pos = new Float32Array(n * (sides + 1) * 3), nor = new Float32Array(n * (sides + 1) * 3), uv = new Float32Array(n * (sides + 1) * 2), idx = [];
  const T = V(), Nn = V(), B = V(), tmp = V(); let len = 0;
  Nn.copy(upHint || V(0.13, 0.2, 0.97));
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; T.subVectors(b, a).normalize();
    Nn.addScaledVector(T, -Nn.dot(T)); if (Nn.lengthSq() < 1e-8) Nn.set(1, 0, 0).addScaledVector(T, -T.x); Nn.normalize(); B.crossVectors(T, Nn);
    if (i > 0) len += pts[i].distanceTo(pts[i - 1]);
    const r = typeof radii === "function" ? radii(i / (n - 1)) : typeof radii === "number" ? radii : radii[i];
    for (let j = 0; j <= sides; j++) {
      const th = j / sides * TAU, c = Math.cos(th), s = Math.sin(th), o = (i * (sides + 1) + j) * 3;
      tmp.set(0, 0, 0).addScaledVector(Nn, c).addScaledVector(B, s);
      nor[o] = tmp.x; nor[o + 1] = tmp.y; nor[o + 2] = tmp.z;
      pos[o] = pts[i].x + tmp.x * r; pos[o + 1] = pts[i].y + tmp.y * r; pos[o + 2] = pts[i].z + tmp.z * r;
      uv[(i * (sides + 1) + j) * 2] = len; uv[(i * (sides + 1) + j) * 2 + 1] = j / sides;
    }
    if (i < n - 1) for (let j = 0; j < sides; j++) { const p0 = i * (sides + 1) + j, p1 = p0 + sides + 1; idx.push(p0, p0 + 1, p1, p0 + 1, p1 + 1, p1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.BufferAttribute(nor, 3)); g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx); return g;
}
export function fillAttr(g, name, size, vals) { const n = g.attributes.position.count, a = new Float32Array(n * size); for (let i = 0; i < n; i++) for (let k = 0; k < size; k++) a[i * size + k] = vals[k]; g.setAttribute(name, new THREE.BufferAttribute(a, size)); return g; }
export function couleur(g, c) { return fillAttr(g, "color", 3, c); }
// fusion simple (mêmes attributs) ; les géométries sans index reçoivent un index
export function fusion(list) {
  const names = Object.keys(list[0].attributes); let nv = 0, ni = 0;
  for (const g of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const out = new THREE.BufferGeometry(), arrs = {};
  for (const n of names) arrs[n] = new Float32Array(nv * list[0].attributes[n].itemSize);
  const idx = new Uint32Array(ni); let vo = 0, io = 0;
  for (const g of list) {
    for (const n of names) { const a = g.attributes[n]; if (!a) throw new Error("fusion: il manque " + n); arrs[n].set(a.array, vo * a.itemSize); }
    if (g.index) { const ia = g.index.array; for (let i = 0; i < ia.length; i++) idx[io + i] = ia[i] + vo; io += ia.length; }
    else { const c = g.attributes.position.count; for (let i = 0; i < c; i++) idx[io + i] = vo + i; io += c; }
    vo += g.attributes.position.count;
  }
  for (const n of names) out.setAttribute(n, new THREE.BufferAttribute(arrs[n], list[0].attributes[n].itemSize));
  out.setIndex(new THREE.BufferAttribute(idx, 1)); return out;
}
export const M4 = (px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => new THREE.Matrix4().compose(V(px, py, pz), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, "YXZ")), V(sx, sy, sz));
// garde position, normal, uv (+ color si demandé) et transforme
export function xf(geo, m, col) {
  const g = geo.index ? geo.clone() : geo.clone();
  for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv", "color", "aPente", "aFlot"].includes(k)) g.deleteAttribute(k);
  if (m) g.applyMatrix4(m);
  if (!g.attributes.uv) fillAttr(g, "uv", 2, [0, 0]);
  if (col) couleur(g, col);
  if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
  return g;
}

// ---------- textures dessinées ----------
export function canevas(w, h, f) { const c = document.createElement("canvas"); c.width = w; c.height = h; f(c.getContext("2d", { willReadFrequently: true }), w, h); return c; }
export function texCanvas(w, h, f, srgb = true, rep = true) {
  const t = new THREE.CanvasTexture(canevas(w, h, f)); if (srgb) t.colorSpace = THREE.SRGBColorSpace; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}

// =====================================================================================================
// Sculpture par champs de distance (SDF) + maillage « surface nets »
// =====================================================================================================
export const SD = (() => {
  const sq = Math.sqrt, ab = Math.abs, mx = Math.max, mn = Math.min;
  const smin = (a, b, k) => { const h = mx(k - ab(a - b), 0) / k; return mn(a, b) - h * h * k * .25; };
  const smax = (a, b, k) => -smin(-a, -b, k);
  const sph = (cx, cy, cz, r) => (x, y, z) => { x -= cx; y -= cy; z -= cz; return sq(x * x + y * y + z * z) - r; };
  const ell = (cx, cy, cz, rx, ry, rz) => {
    const a = 1 / (rx * rx), b = 1 / (ry * ry), c = 1 / (rz * rz), m = mn(rx, ry, rz);
    return (x, y, z) => { x -= cx; y -= cy; z -= cz; const k0 = sq(x * x * a + y * y * b + z * z * c), k1 = sq(x * x * a * a + y * y * b * b + z * z * c * c); return k1 < 1e-9 ? -m : k0 * (k0 - 1) / k1; };
  };
  // capsule de rayon variable entre A et B
  const cap = (A, B, ra, rb = ra) => {
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], il = 1 / (ux * ux + uy * uy + uz * uz + 1e-12);
    return (x, y, z) => { x -= A[0]; y -= A[1]; z -= A[2]; let h = (x * ux + y * uy + z * uz) * il; h = h < 0 ? 0 : h > 1 ? 1 : h; x -= ux * h; y -= uy * h; z -= uz * h; return sq(x * x + y * y + z * z) - (ra + (rb - ra) * h); };
  };
  // chaîne lisse de capsules le long d'une courbe de Bézier quadratique (rayon r0 -> r1)
  const meche = (A, B, C, r0, r1, n = 8, k = 0.04) => {
    const pts = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; pts.push([u * u * A[0] + 2 * u * t * B[0] + t * t * C[0], u * u * A[1] + 2 * u * t * B[1] + t * t * C[1], u * u * A[2] + 2 * u * t * B[2] + t * t * C[2], r0 + (r1 - r0) * t]); }
    const segs = []; for (let i = 0; i < n; i++) segs.push(cap(pts[i], pts[i + 1], pts[i][3], pts[i + 1][3]));
    let cx = 0, cy = 0, cz = 0; for (const p of pts) { cx += p[0]; cy += p[1]; cz += p[2]; } cx /= pts.length; cy /= pts.length; cz /= pts.length;
    let R = 0; for (const p of pts) R = mx(R, Math.hypot(p[0] - cx, p[1] - cy, p[2] - cz) + p[3]);
    return borne(SU(k, ...segs), cx, cy, cz, R);
  };
  const U = (...f) => (x, y, z) => { let d = f[0](x, y, z); for (let i = 1; i < f.length; i++) { const e = f[i](x, y, z); if (e < d) d = e; } return d; };
  const SU = (k, ...f) => (x, y, z) => { let d = f[0](x, y, z); for (let i = 1; i < f.length; i++) d = smin(d, f[i](x, y, z), k); return d; };
  const SUB = (a, b, k = 0) => k ? (x, y, z) => smax(a(x, y, z), -b(x, y, z), k) : (x, y, z) => mx(a(x, y, z), -b(x, y, z));
  const INT = (a, b, k = 0) => k ? (x, y, z) => smax(a(x, y, z), b(x, y, z), k) : (x, y, z) => mx(a(x, y, z), b(x, y, z));
  const echY = (f, k, cy = 0) => (x, y, z) => f(x, cy + (y - cy) / k, z) * k;     // aplatit verticalement
  function borne(f, cx, cy, cz, R, m = .2) { return (x, y, z) => { const a = x - cx, b = y - cy, c = z - cz, d = sq(a * a + b * b + c * c) - R; return d > m ? d : f(x, y, z); }; }
  // maillage : surface nets, avec saut des blocs loin de la surface, une correction de Newton, normales par gradient
  function mesh(f, bb, n) {
    const x0 = bb[0], y0 = bb[1], z0 = bb[2], h = mx(bb[3] - x0, bb[4] - y0, bb[5] - z0) / n;
    const nx = Math.ceil((bb[3] - x0) / h) + 2, ny = Math.ceil((bb[4] - y0) / h) + 2, nz = Math.ceil((bb[5] - z0) / h) + 2, nxy = nx * ny;
    const g = new Float32Array(nxy * nz), ST = 4, far = ST * h * 0.9 + h;
    for (let k0 = 0; k0 < nz; k0 += ST) for (let j0 = 0; j0 < ny; j0 += ST) for (let i0 = 0; i0 < nx; i0 += ST) {
      const i1 = mn(i0 + ST, nx - 1), j1 = mn(j0 + ST, ny - 1), k1 = mn(k0 + ST, nz - 1);
      const d = f(x0 + (i0 + i1) * .5 * h, y0 + (j0 + j1) * .5 * h, z0 + (k0 + k1) * .5 * h), loin = ab(d) > far;
      for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const p = i + nx * j + nxy * k; g[p] = loin ? d : f(x0 + i * h, y0 + j * h, z0 + k * h);
      }
    }
    const vi = new Int32Array(nxy * nz).fill(-1), P = [], I = [];
    const co = [0, 1, nx, nx + 1, nxy, nxy + 1, nxy + nx, nxy + nx + 1], cx = [0, 1, 0, 1, 0, 1, 0, 1], cy = [0, 0, 1, 1, 0, 0, 1, 1], cz = [0, 0, 0, 0, 1, 1, 1, 1];
    const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const b = i + nx * j + nxy * k; let m = 0;
      for (let c = 0; c < 8; c++) if (g[b + co[c]] < 0) m |= 1 << c;
      if (m === 0 || m === 255) continue;
      let sx = 0, sy = 0, sz = 0, ne = 0;
      for (const [a, c] of E) { const va = g[b + co[a]], vc = g[b + co[c]]; if ((va < 0) === (vc < 0)) continue; const t = va / (va - vc);
        sx += cx[a] + (cx[c] - cx[a]) * t; sy += cy[a] + (cy[c] - cy[a]) * t; sz += cz[a] + (cz[c] - cz[a]) * t; ne++; }
      vi[b] = P.length / 3; P.push(x0 + (i + sx / ne) * h, y0 + (j + sy / ne) * h, z0 + (k + sz / ne) * h);
    }
    const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) I.push(a, b, c, a, c, d); else I.push(a, c, b, a, d, c); };
    for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const b = i + nx * j + nxy * k, s0 = g[b] < 0;
      if (s0 !== (g[b + 1] < 0)) quad(vi[b], vi[b - nx], vi[b - nx - nxy], vi[b - nxy], s0);
      if (s0 !== (g[b + nx] < 0)) quad(vi[b], vi[b - nxy], vi[b - 1 - nxy], vi[b - 1], s0);
      if (s0 !== (g[b + nxy] < 0)) quad(vi[b], vi[b - 1], vi[b - 1 - nx], vi[b - nx], s0);
    }
    // correction vers la vraie surface et normales
    const nv = P.length / 3, pos = new Float32Array(P), nor = new Float32Array(nv * 3), e = h * 0.5;
    for (let v = 0; v < nv; v++) {
      let x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
      for (let it = 0; it < 2; it++) {
        const d = f(x, y, z), gx = f(x + e, y, z) - f(x - e, y, z), gy = f(x, y + e, z) - f(x, y - e, z), gz = f(x, y, z + e) - f(x, y, z - e), l2 = (gx * gx + gy * gy + gz * gz) / (4 * e * e) + 1e-12;
        const k = clamp(d / l2, -h, h) / (2 * e); x -= gx * k; y -= gy * k; z -= gz * k;
        if (it === 1) { const l = sq(gx * gx + gy * gy + gz * gz) || 1; nor[v * 3] = gx / l; nor[v * 3 + 1] = gy / l; nor[v * 3 + 2] = gz / l; }
      }
      pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z;
    }
    return { pos, nor, idx: new Uint32Array(I) };
  }
  // symétrique : on maille x >= 0 et on recolle le miroir
  function meshSym(f, X, y0, z0, y1, z1, n) {
    const E = mx(y1 - y0, z1 - z0), h = E / n, m = mesh(f, [-2 * h, y0, z0, mn(X, E - 2 * h), y1, z1], n), P = m.pos, Nn = m.nor, Ix = m.idx, nv = P.length / 3;
    const map = new Int32Array(nv).fill(-1), tri = []; let nu = 0;
    for (let k = 0; k < Ix.length; k += 3) { const a = Ix[k], b = Ix[k + 1], c = Ix[k + 2]; if (P[a * 3] > 0 || P[b * 3] > 0 || P[c * 3] > 0) tri.push(a, b, c); }
    for (const v of tri) if (map[v] < 0) map[v] = nu++;
    const pos = new Float32Array(nu * 6), nor = new Float32Array(nu * 6), idx = new Uint32Array(tri.length * 2), nt = tri.length;
    for (let i = 0; i < nv; i++) { const j = map[i]; if (j < 0) continue; const a = j * 3, b = (nu + j) * 3, k = i * 3; let x = P[k], nx = Nn[k];
      if (x < 1e-4) { x = 0; nx = 0; }
      pos[a] = x; pos[a + 1] = P[k + 1]; pos[a + 2] = P[k + 2]; nor[a] = nx; nor[a + 1] = Nn[k + 1]; nor[a + 2] = Nn[k + 2];
      pos[b] = -x; pos[b + 1] = P[k + 1]; pos[b + 2] = P[k + 2]; nor[b] = -nx; nor[b + 1] = Nn[k + 1]; nor[b + 2] = Nn[k + 2]; }
    for (let k = 0; k < nt; k += 3) { const a = map[tri[k]], b = map[tri[k + 1]], c = map[tri[k + 2]]; idx[k] = a; idx[k + 1] = b; idx[k + 2] = c; idx[nt + k] = nu + a; idx[nt + k + 1] = nu + c; idx[nt + k + 2] = nu + b; }
    // les points du plan x = 0 sont en double : on les soude
    const cle = new Map(), remap = new Uint32Array(nu * 2);
    for (let i = 0; i < nu * 2; i++) { remap[i] = i; if (pos[i * 3] === 0) { const kk = pos[i * 3 + 1].toFixed(5) + "," + pos[i * 3 + 2].toFixed(5); if (cle.has(kk)) remap[i] = cle.get(kk); else cle.set(kk, i); } }
    for (let k = 0; k < idx.length; k++) idx[k] = remap[idx[k]];
    return { pos, nor, idx };
  }
  return { smin, smax, sph, ell, cap, meche, U, SU, SUB, INT, echY, borne, mesh, meshSym };
})();
export function geoDe(m) { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(m.pos, 3)); g.setAttribute("normal", new THREE.BufferAttribute(m.nor, 3)); g.setIndex(new THREE.BufferAttribute(m.idx, 1)); return g; }

export const attendre = () => new Promise(r => setTimeout(r, 0));
