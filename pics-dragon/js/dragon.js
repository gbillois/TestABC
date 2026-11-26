// Le dragon rouge (un loong), piloté par le joueur.
// MOUVEMENT : la tête vole où on la dirige ; le corps est le chemin que la tête vient de parcourir (gardé dans un historique),
//   avec par-dessus une ondulation qui court vers la queue et le roulis des virages. Rien d'autre : pas de squelette.
// ALLURE : écailles en plaques qui se chevauchent (relief, liseré d'or, ombre sous chaque plaque, plaques du ventre) calculées
//   par pixel ; tête sculptée par champs de distance ; yeux à pupille fendue ; bois ; collerettes ; crinière de mèches qui
//   suivent le vent de la course ; moustaches qui traînent ; pattes ; souffle de feu.
import * as THREE from "three";
import { SD, geoDe, rng, clamp, lerp, sm, TAU, V, patch, tubeGeo, fusion, xf, M4, keyed, G, Q } from "./commun.js";

export const LEN = 62, NR = 200, NS = 22, RMAX = 1.55, HS = 1.35;
const rProf = keyed([[0, 0.66], [0.03, 0.72], [0.09, 1.0], [0.25, 1.0], [0.6, 0.85], [0.8, 0.55], [0.93, 0.24], [0.985, 0.07], [1, 0.02]]);
export const rayon = a => RMAX * rProf(a / LEN);

const PAL = {
  corps: [0.55, 0.020, 0.022], dos: [0.30, 0.010, 0.014], flanc: [0.66, 0.050, 0.026], ventre: [0.86, 0.58, 0.30],
  crete: [0.82, 0.32, 0.05], peau: [0.34, 0.018, 0.016], creux: [0.012, 0.002, 0.002], levre: [0.40, 0.02, 0.018],
  bouche: [0.34, 0.012, 0.020], gencive: [0.50, 0.07, 0.08], langue: [0.75, 0.12, 0.12], ivoire: [0.92, 0.80, 0.56],
  corne0: [0.36, 0.09, 0.025], corne1: [0.96, 0.74, 0.40], griffe: [0.10, 0.035, 0.02], lisere: [1.0, 0.58, 0.16, 0.46],
  meche: [[0.42, 0.030, 0.016], [0.98, 0.46, 0.10], [1.0, 0.74, 0.36]], braise: [5.0, 0.85, 0.10],
};
const c3 = a => new THREE.Vector3(a[0], a[1], a[2]);

// ======================= le shader des écailles =======================
// uv.x = mètres le long du corps (depuis le museau), uv.y = tour (0.25 dos, 0.75 ventre) ; aT = direction vers la queue
const U = { uGlow: { value: 0 }, uLisere: { value: new THREE.Vector4(...PAL.lisere) }, uBraise: { value: c3(PAL.braise) } };
function matEcailles(cle, o = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.36, metalness: 0.12 });
  m.envMapIntensity = 1.0;
  patch(m, s => {
    Object.assign(s.sh.uniforms, U);
    s.vHead(`attribute vec3 aT; varying vec3 vT; varying float vVZ;${o.tete ? " attribute vec2 aQ; varying vec2 vQ;" : ""}`);
    s.v("#include <begin_vertex>", `#include <begin_vertex>\nvT = normalize(normalMatrix * aT);${o.tete ? " vQ = aQ;" : ""}`);
    s.v("#include <project_vertex>", "#include <project_vertex>\nvVZ = -mvPosition.z;");
    s.fHead(`varying vec3 vT; varying float vVZ; uniform float uGlow; uniform vec4 uLisere; uniform vec3 uBraise; float dRough, dMetal; vec3 dEmis; vec2 dGrad;${o.tete ? " varying vec2 vQ;" : ""}
      // une plaque : on cherche, rang par rang en partant de l'avant, la première écaille qui couvre le point
      float ecaille(vec2 p, out vec2 g, out float rim, out float id, out float occ){
        float j0 = floor(p.y) - 1.0; float prevE = 9.0; g = vec2(0.0); rim = 0.0; id = 0.5; occ = 1.0;
        for (int k = 0; k < 3; k++){
          float j = j0 + float(k), off = mod(j, 2.0) * 0.5, cx = floor(p.x - off + 0.5) + off;
          vec2 q = vec2((p.x - cx) / 0.64, (p.y - (j + 0.55)) / 0.78); float e = dot(q, q);
          if (e < 1.0){
            float ty = clamp(q.y * 0.5 + 0.5, 0.0, 1.0), body = 0.25 + 0.75 * ty, keel = exp(-q.x * q.x * 14.0) * 0.12 * ty;
            float u = clamp((e - 0.70) / 0.30, 0.0, 1.0), s = u * u * (3.0 - 2.0 * u);
            g = -6.0 * u * (1.0 - u) / 0.30 * body * vec2(q.x / 0.32, q.y / 0.39) * 0.5 + (1.0 - s) * vec2(-28.0 * q.x * keel / 0.64, 0.6);
            rim = s * smoothstep(0.2, 0.7, ty); id = fract(sin(dot(vec2(cx, j), vec2(12.9898, 78.233))) * 43758.5453);
            occ = smoothstep(1.0, 1.5, prevE);
            return (1.0 - s) * body + keel;
          }
          // la plaque de devant : sa distance sert à l'ombre portée sur celle de derrière
          vec2 q2 = vec2((p.x - (floor(p.x - mod(j, 2.0) * 0.5 + 0.5) + mod(j, 2.0) * 0.5)) / 0.64, (p.y - (j + 0.55)) / 0.78); prevE = min(prevE, dot(q2, q2));
        }
        return 0.0;
      }`);
    s.f("#include <color_fragment>", `#include <color_fragment>
      {
        ${o.tete ? "float tour = atan(vQ.y, vQ.x) * 0.15915494 + 0.5; float lg = vUv.x;" : "float tour = vUv.y; float lg = vUv.x;"}
        float NSC = ${o.tete ? "34.0" : "30.0"}, LGS = ${o.tete ? "0.26" : "0.46"};
        vec2 p = vec2(tour * NSC, lg / LGS);
        float rpx = 1.0 / max(length(fwidth(p)), 1e-4), lodA = smoothstep(2.5, 6.0, rpx), lodS = smoothstep(3.0, 7.5, rpx), fine = smoothstep(7.0, 24.0, rpx);
        vec2 g; float rim, id, occ, h = ecaille(p, g, rim, id, occ);
        vec3 base = diffuseColor.rgb;
        float kB = ${o.tete ? "0.0" : "smoothstep(0.17, 0.10, abs(vUv.y - 0.75))"};
        vec3 sc = base * (0.72 + 0.5 * id) * mix(0.72, 1.12, h);
        sc = mix(sc, vec3(0.9, 0.2, 0.03), smoothstep(0.86, 0.99, id) * 0.3);
        sc = mix(sc, uLisere.rgb, rim * uLisere.a);
        sc *= mix(0.30, 1.0, occ);
        sc = mix(base * 0.86, sc, max(lodA, 0.15));
        // plaques du ventre : bandes en tuiles, ombre sous le bord, bord libre clair
        float pl = fract(lg / 0.55), plh = smoothstep(0.0, 0.12, pl) * smoothstep(1.0, 0.84, pl);
        vec3 be = base * mix(0.45, 1.05, mix(1.0, plh, smoothstep(1.0, 4.0, rpx * 1.2))) * (1.0 + 0.25 * smoothstep(0.8, 0.95, pl));
        vec3 col = mix(sc, be, kB);
        diffuseColor.rgb = col * (vColor.r > 0.0 ? 1.0 : 1.0);
        vec2 gs = clamp(g, -3.0, 3.0) * (0.32 + 0.18 * fine);
        dGrad = mix(gs * lodS, vec2(0.0, (smoothstep(0.0, 0.12, pl) - smoothstep(0.84, 1.0, pl)) * 1.2), kB);
        dRough = mix(mix(0.46, 0.30, id), 0.22, rim); dRough = mix(0.5, dRough, lodS); dRough = mix(dRough, 0.42, kB);
        dMetal = mix(0.08 + 0.6 * rim * lodS, 0.0, kB);
        float groove = (1.0 - occ) * (1.0 - kB) + (1.0 - plh) * kB;
        float wave = 0.55 + 0.45 * sin(lg * 0.3 - ATMO_T * 6.0);
        dEmis = uBraise * groove * groove * (0.8 * uGlow * wave * smoothstep(40.0, 0.0, lg) + 0.008);
        ${Q.has('dbguv') ? 'diffuseColor.rgb = vec3(fract(lg), fract(tour * 4.0), h); dEmis = diffuseColor.rgb;' : ''}
      }`);
    s.f("#include <normal_fragment_maps>", `{ vec3 Tn = vT - normal * dot(vT, normal); Tn /= max(length(Tn), 1e-4); vec3 Bn = cross(normal, Tn); normal = normalize(normal - (Bn * dGrad.x + Tn * dGrad.y) * 0.9); }`);
    s.f("#include <roughnessmap_fragment>", "float roughnessFactor = dRough;");
    s.f("#include <metalnessmap_fragment>", "float metalnessFactor = dMetal;");
    s.f("#include <emissivemap_fragment>", "totalEmissiveRadiance += dEmis;");
  }, cle);
  m.defines = { USE_UV: "" };
  return m;
}

// ======================= la tête sculptée =======================
const EYE = [0.63, 0.45, 0.70], NOS = [0.27, 0.26, 2.12];
const ymW = z => -0.34 - 0.03 * z + 0.025 * Math.sin(z * 2.7 + 0.6) * sm(0, 0.8, z);
function sculpture() {
  const { SU, SUB, sph, ell, cap, meche, echY, borne } = SD;
  const crane = ell(0, 0.18, -0.45, 0.92, 0.78, 1.0);
  const museau = echY(cap([0, 0.06, 0.3], [0, -0.02, 2.2], 0.66, 0.36), 0.78, 0);
  const bout = ell(0, 0.0, 2.3, 0.40, 0.28, 0.32), naseau = ell(NOS[0] - 0.03, NOS[1] - 0.02, NOS[2] - 0.12, 0.17, 0.15, 0.22);
  const sourcil = meche([0.18, 0.62, 1.15], [0.64, 0.88, 0.72], [0.98, 0.72, -0.2], 0.2, 0.13);
  const crete = meche([0.58, 0.82, 0.35], [0.55, 1.0, -0.25], [0.48, 0.88, -0.9], 0.15, 0.2);
  const arete = borne(SU(0.05, sph(0, 0.55, 1.0, 0.13), sph(0, 0.49, 1.3, 0.12), sph(0, 0.43, 1.6, 0.11), sph(0, 0.37, 1.88, 0.1), sph(0, 0.3, 2.12, 0.09)), 0, 0.45, 1.55, 0.95);
  const pommette = meche([0.55, 0.02, 1.25], [0.98, 0.12, 0.45], [1.04, 0.0, -0.6], 0.15, 0.22);
  const bajoue = ell(0.82, -0.12, -0.3, 0.42, 0.5, 0.7), orbite = sph(EYE[0] - 0.06, EYE[1] - 0.02, EYE[2] - 0.06, 0.3);
  let haut = SU(0.18, crane, museau, bout, bajoue);
  haut = SU(0.08, haut, sourcil, crete, pommette, orbite, naseau);
  haut = SU(0.04, haut, arete);
  haut = SUB(haut, sph(EYE[0] + 0.02, EYE[1], EYE[2] + 0.02, 0.22), 0.03);
  haut = SUB(haut, ell(NOS[0], NOS[1], NOS[2] + 0.06, 0.06, 0.085, 0.12), 0.03);
  haut = SUB(haut, (x, y, z) => Math.max(y - ymW(z), -(z + 0.7)), 0.045);
  haut = SUB(haut, ell(0, -0.42, 0.95, 0.48, 0.3, 1.6), 0.05);
  let mach = SU(0.15, echY(cap([0, -0.5, -0.75], [0, -0.56, 2.15], 0.6, 0.28), 0.62, -0.53), sph(0, -0.7, 2.02, 0.24), ell(0.6, -0.42, -0.4, 0.3, 0.34, 0.5));
  mach = SU(0.05, mach, sph(0, -0.95, 1.9, 0.09), sph(0.15, -0.9, 2.12, 0.07), sph(0.14, -0.86, 1.65, 0.06), sph(0.3, -0.78, 1.25, 0.055));
  mach = SUB(mach, (x, y, z) => -(y - (ymW(z) - 0.08)), 0.05);
  mach = SUB(mach, ell(0, -0.42, 0.85, 0.38, 0.22, 1.4), 0.05);
  // une patte : cuisse, jambe, main, quatre doigts et leurs griffes
  const doigt = (dx, l) => SU(0.06, meche([1.05, -3.05, 0.5], [1.05 + dx * 0.75, -2.98, 1.15 * l], [1.05 + dx * 1.2, -3.4, 1.62 * l], 0.21, 0.14), sph(1.05 + dx * 0.85, -3.04, 1.26 * l, 0.165));
  const griffe = (dx, l) => meche([1.05 + dx * 1.2, -3.36, 1.58 * l], [1.05 + dx * 1.42, -3.6, 2.08 * l], [1.05 + dx * 1.36, -4.3, 1.9 * l], 0.125, 0.015);
  let patte = SU(0.16, cap([0, 0, 0], [0.85, -1.5, -0.45], 0.74, 0.5), cap([0.85, -1.5, -0.45], [1.05, -3.0, 0.5], 0.46, 0.27), sph(1.05, -3.1, 0.55, 0.4), doigt(-0.55, 0.92), doigt(0, 1.05), doigt(0.55, 0.92));
  patte = SU(0.04, patte, griffe(-0.55, 0.92), griffe(0, 1.05), griffe(0.55, 0.92));
  const ab = f => (x, y, z) => f(x < 0 ? -x : x, y, z);
  return { haut: ab(haut), mach: ab(mach), patte, sourcil: ab(sourcil), crete: ab(crete), pommette: ab(pommette), arete, naseau: ab(naseau) };
}
// peinture des sommets (couleur) et coordonnées des écailles
function peindre(g, f, mode) {
  const P = g.attributes.position.array, n = P.length / 3, col = new Float32Array(n * 3), uv = new Float32Array(n * 2), aT = new Float32Array(n * 3), aQ = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2]; let c = PAL.corps.slice();
    if (mode === "patte") { const t = clamp((-y - 0.2) / 3.5); c = [lerp(PAL.corps[0], PAL.flanc[0], t), lerp(PAL.corps[1], PAL.flanc[1], t), lerp(PAL.corps[2], PAL.flanc[2], t)];
      if (y < -3.3 && (z > 1.55 || z < -0.4 || y < -3.5)) c = lerp(0, 1, sm(-3.3, -4.2, y)) > 0.5 ? PAL.corne1 : PAL.griffe;
      uv[i * 2] = -y * 1.0 + 3; aQ[i * 2] = x - 0.5; aQ[i * 2 + 1] = z; aT[i * 3 + 1] = -1; }
    else {
      const ax = Math.abs(x), d = f.haut ? 0 : 0;
      const plaque = Math.max(sm(0.06, -0.02, f.sourcil(x, y, z)), sm(0.06, -0.02, f.crete(x, y, z)), sm(0.05, -0.02, f.pommette(x, y, z)), sm(0.04, -0.02, f.arete(x, y, z)));
      for (let k = 0; k < 3; k++) c[k] = lerp(c[k], PAL.crete[k], plaque * 0.9);
      const dosK = sm(0.2, 0.8, y); for (let k = 0; k < 3; k++) c[k] = lerp(c[k], PAL.dos[k], dosK * 0.4 * (1 - plaque));
      const nez = sm(0.12, 0.0, f.naseau(x, y, z)) * sm(1.8, 2.1, z); for (let k = 0; k < 3; k++) c[k] = lerp(c[k], PAL.peau[k], nez);
      if (mode === "mach") { const gorge = sm(-0.55, -0.85, y) * sm(1.9, 0.4, z); for (let k = 0; k < 3; k++) c[k] = lerp(c[k], PAL.ventre[k], gorge * 0.85); }
      const lev = mode === "mach" ? sm(0.1, 0.0, Math.abs(y - (ymW(z) - 0.08))) : sm(0.08, 0.0, Math.abs(y - ymW(z))) * sm(-0.6, 0.0, z); for (let k = 0; k < 3; k++) c[k] = lerp(c[k], PAL.levre[k], lev * 0.8);
      const inside = mode === "mach" ? sm(-0.5, -0.38, y) : sm(-0.28, -0.4, y) * sm(-0.2, 0.2, z); for (let k = 0; k < 3; k++) c[k] = lerp(c[k], PAL.bouche[k], inside * (ax < 0.45 ? 1 : 0));
      uv[i * 2] = (2.45 - z) * HS; aQ[i * 2] = x; aQ[i * 2 + 1] = y - 0.05; aT[i * 3 + 2] = -1;
    }
    col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3)); g.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); g.setAttribute("aT", new THREE.BufferAttribute(aT, 3)); g.setAttribute("aQ", new THREE.BufferAttribute(aQ, 2));
  return g;
}

// œil : iris d'ambre qui brille, pupille fendue, cornée brillante (+z local = regard)
function matOeil() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.08, metalness: 0.0 });
  patch(m, s => {
    s.vHead("varying vec3 vLoc;"); s.v("#include <begin_vertex>", "#include <begin_vertex>\nvLoc = normalize(position);");
    s.fHead("varying vec3 vLoc; uniform float uGlow;"); s.sh.uniforms.uGlow = U.uGlow;
    s.f("#include <color_fragment>", `#include <color_fragment>
      { vec2 q = vLoc.xy; float r = length(q), front = smoothstep(-0.2, 0.3, vLoc.z);
        float iris = smoothstep(0.86, 0.80, r) * front, pup = smoothstep(0.17, 0.11, abs(q.x) / (1.0 - 0.6 * q.y * q.y)) * smoothstep(0.75, 0.6, r) * front;
        vec3 c = mix(vec3(0.10, 0.012, 0.006), mix(vec3(0.90, 0.12, 0.0), vec3(1.0, 0.62, 0.10), smoothstep(0.75, 0.25, r)), iris);
        c *= 1.0 - 0.5 * smoothstep(0.6, 0.84, r) * iris;
        c = mix(c, vec3(0.0), pup); diffuseColor.rgb = c; }`);
    s.f("#include <emissivemap_fragment>", `{ vec2 q = vLoc.xy; float r = length(q); float iris = smoothstep(0.86, 0.80, r) * smoothstep(-0.2, 0.3, vLoc.z) * (1.0 - smoothstep(0.17, 0.11, abs(q.x) / (1.0 - 0.6 * q.y * q.y)));
      totalEmissiveRadiance += mix(vec3(0.9, 0.2, 0.0), vec3(1.0, 0.7, 0.2), smoothstep(0.7, 0.2, r)) * iris * (0.55 + 1.6 * uGlow); }`);
  }, "oeil");
  return m;
}

// ======================= mèches (crinière, barbe, bout de la queue) =======================
// une mèche : ruban de 12 segments, t = 0 à la peau, 1 au bout ; +Y sort de la peau, +Z sens où elle est peignée.
// Le shader la courbe en arc (plus peignée quand le dragon file), la fait onduler au vent et tourne le ruban vers la caméra.
const uFlot = { value: 0.5 };
function meches(n) {
  const SEG = 12, P = [], UV = [], I = [];
  for (let i = 0; i <= SEG; i++) for (let j = 0; j < 2; j++) { P.push(j ? 1 : -1, i / SEG, 0); UV.push(j, i / SEG); }
  for (let i = 0; i < SEG; i++) { const a = i * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.InstancedBufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I);
  g.instanceCount = n;
  const ia = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4); ia.setUsage(THREE.DynamicDrawUsage);
  const ib = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4); ib.setUsage(THREE.DynamicDrawUsage);
  const ic = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4); ic.setUsage(THREE.DynamicDrawUsage);
  const id = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
  g.setAttribute("aR", ia); g.setAttribute("aY", ib); g.setAttribute("aZ", ic); g.setAttribute("aL", id);   // racine (xyz, longueur), axe Y (xyz, courbure), axe Z (xyz, largeur), (phase, teinte, gravité, -)
  const m = new THREE.ShaderMaterial({
    side: THREE.DoubleSide, transparent: false, alphaToCoverage: true,
    uniforms: { uTime: G.uTime, uFlot, uM0: { value: c3(PAL.meche[0]) }, uM1: { value: c3(PAL.meche[1]) }, uM2: { value: c3(PAL.meche[2]) }, uSun: { value: V() } },
    vertexShader: `uniform float uTime, uFlot; attribute vec4 aR, aY, aZ, aL; varying vec2 vUv; varying vec3 vW, vN; varying float vT;
      void main(){
        float t = uv.y, L = aR.w, ph = aL.x;
        vec3 ey = normalize(aY.xyz), ez = normalize(aZ.xyz - ey * dot(aZ.xyz, ey)), ex = cross(ey, ez);
        float th = aY.w * (0.45 + 0.75 * uFlot) * 1.9 + 0.25 * sin(uTime * 2.3 + ph * 6.0) * (1.0 - 0.5 * uFlot);
        float a = th * t; vec3 dir;
        vec3 p = th > 0.01 ? ey * (sin(a) / th) + ez * ((1.0 - cos(a)) / th) : ey * t;
        p *= L;
        p += ex * sin(t * 5.0 + ph * 9.0 + uTime * (2.0 + 4.0 * uFlot)) * 0.12 * L * t + vec3(0.0, -1.0, 0.0) * aL.z * t * t * L * (1.0 - 0.7 * uFlot);
        vec3 tg = normalize(ey * cos(a) + ez * sin(a));
        vec3 wp = aR.xyz + p;
        vec3 vd = normalize(cameraPosition - wp), side = normalize(cross(tg, vd));
        float w = aZ.w * (1.0 - 0.85 * t * t) * (0.6 + 0.4 * sin(t * 3.14));
        wp += side * position.x * w;
        vN = normalize(cross(side, tg)); vUv = uv; vT = t; vW = wp;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: `uniform vec3 uM0, uM1, uM2, uSun; uniform float uTime; varying vec2 vUv; varying vec3 vW, vN; varying float vT;
      float h(float x){ return fract(sin(x * 91.7) * 43758.5); }
      void main(){
        float u = vUv.x, ed = 1.0 - abs(u * 2.0 - 1.0);
        float br = 0.6 + 0.4 * h(floor(u * 9.0) + floor(vT * 3.0) * 0.0);
        float a = smoothstep(0.0, 0.35, ed) * smoothstep(1.0, 0.85, vT * (0.9 + 0.2 * h(floor(u * 7.0))));
        if (a < 0.02) discard;
        vec3 c = mix(uM0, uM1, smoothstep(0.0, 0.45, vT)); c = mix(c, uM2, smoothstep(0.5, 1.0, vT));
        c *= br * (0.75 + 0.25 * ed);
        vec3 n = normalize(vN); vec3 v = normalize(cameraPosition - vW);
        float dif = 0.35 + 0.65 * abs(dot(n, uSun)), thru = pow(max(dot(-v, uSun), 0.0), 3.0) * 1.5;
        vec3 col = c * (dif * vec3(1.0, 0.86, 0.68) * 2.2 + vec3(0.25, 0.28, 0.35)) + c * thru * vec3(1.2, 0.7, 0.3);
        col += uM2 * pow(1.0 - abs(dot(n, v)), 3.0) * 0.4;
        gl_FragColor = vec4(col, a);
      }`
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false;
  return { mesh, A: ia, B: ib, C: ic, D: id, n };
}

// ======================= construction =======================
export function construireDragon(scene) {
  const t0 = performance.now();
  const D = { grp: new THREE.Group() };
  scene.add(D.grp);
  const matCorps = matEcailles("ecaillesC"), matTete = matEcailles("ecaillesT", { tete: true }), matPatte = matEcailles("ecaillesP", { tete: true });
  D.mats = [matCorps, matTete, matPatte];
  // ---- le corps : un tube dont les anneaux suivent le chemin ----
  const nv = NR * (NS + 1), pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), col = new Float32Array(nv * 3), aT = new Float32Array(nv * 3), idx = [];
  for (let i = 0; i < NR; i++) for (let j = 0; j <= NS; j++) {
    const k = i * (NS + 1) + j, a = i / (NR - 1) * LEN, v = j / NS; uv[k * 2] = a; uv[k * 2 + 1] = v;
    const th = v * TAU, dos = Math.exp(-Math.pow(Math.atan2(Math.sin(th - Math.PI / 2), Math.cos(th - Math.PI / 2)) / 0.9, 2)), ventre = Math.exp(-Math.pow(Math.atan2(Math.sin(th + Math.PI / 2), Math.cos(th + Math.PI / 2)) / 0.5, 2));
    const fl = 1 - dos - ventre;
    for (let c = 0; c < 3; c++) col[k * 3 + c] = PAL.corps[c] * (1 - dos * 0.5) + PAL.dos[c] * dos * 0.5 + (PAL.flanc[c] - PAL.corps[c]) * Math.max(0, fl) * 0.4 + (PAL.ventre[c] - PAL.corps[c]) * ventre;
  }
  for (let i = 0; i < NR - 1; i++) for (let j = 0; j < NS; j++) { const a = i * (NS + 1) + j, b = a + 1, c = a + NS + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute("normal", new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute("aT", new THREE.BufferAttribute(aT, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); g.setAttribute("color", new THREE.BufferAttribute(col, 3)); g.setIndex(idx);
  D.corps = new THREE.Mesh(g, matCorps); D.corps.frustumCulled = false; D.corps.castShadow = true; D.corps.receiveShadow = true; scene.add(D.corps);

  // ---- la tête ----
  const f = sculpture(), res = +(Q.get("tete") || 88);
  const gH = peindre(geoDe(SD.meshSym(f.haut, 1.35, -0.75, -1.7, 1.35, 2.75, res)), f, "haut");
  const gJ = peindre(geoDe(SD.meshSym(f.mach, 1.0, -1.15, -1.4, -0.15, 2.45, Math.round(res * 0.7))), f, "mach");
  D.tete = new THREE.Group(); D.tete.scale.setScalar(HS); scene.add(D.tete);
  const mH = new THREE.Mesh(gH, matTete); mH.castShadow = true; D.tete.add(mH);
  D.mach = new THREE.Group(); D.mach.position.set(0, -0.32, -0.55); D.tete.add(D.mach);
  const mJ = new THREE.Mesh(gJ, matTete); mJ.position.set(0, 0.32, 0.55); mJ.castShadow = true; D.mach.add(mJ);
  // yeux
  const mo = matOeil();
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), mo); e.position.set(sx * EYE[0], EYE[1], EYE[2]); e.quaternion.setFromUnitVectors(V(0, 0, 1), V(sx * 0.82, 0.1, 0.56).normalize()); D.tete.add(e); }
  // dents, crocs, langue
  const ivoire = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.0 }), dents = [], dentsJ = [];
  const dent = (list, x, y, z, h, r, bas) => { const c = new THREE.ConeGeometry(r, h, 6); if (bas) c.translate(0, h / 2, 0); else { c.rotateX(Math.PI); c.translate(0, -h / 2, 0); } list.push(xf(c, M4(x, y, z, 0, 0, 0, 1), PAL.ivoire)); };
  for (let i = 0; i < 9; i++) { const z = 0.5 + i * 0.2; for (const sx of [-1, 1]) { dent(dents, sx * lerp(0.56, 0.3, i / 8), ymW(z) + 0.02, z, 0.12 + (i === 6 ? 0.26 : 0.03 * Math.sin(i)), 0.045 + (i === 6 ? 0.03 : 0), false); dent(dentsJ, sx * lerp(0.44, 0.22, i / 8), ymW(z) - 0.06, z - 0.05, 0.1 + (i === 7 ? 0.2 : 0), 0.04, true); } }
  D.tete.add(new THREE.Mesh(fusion(dents), ivoire)); const dj = new THREE.Mesh(fusion(dentsJ), ivoire); dj.position.set(0, 0.32, 0.55); D.mach.add(dj);
  { const pts = [V(0, -0.5, 0.1), V(0, -0.48, 0.8), V(0, -0.45, 1.5), V(0, -0.38, 2.0), V(0.12, -0.3, 2.5), V(0.22, -0.32, 2.75)]; const lg = tubeGeo(pts, t => 0.13 * (1 - t * 0.7), 8); lg.scale(1, 0.55, 1);
    const l = new THREE.Mesh(lg, new THREE.MeshStandardMaterial({ color: new THREE.Color(...PAL.langue), roughness: 0.35 })); l.position.set(0, 0.32, 0.55); D.mach.add(l); }
  // bois : branches ramifiées, de la racine sombre à la pointe dorée
  const matBois = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.08 }); const bois = [];
  const branche = (pts, r0, r1) => { const g = tubeGeo(pts, t => lerp(r0, r1, Math.pow(t, 0.8)), 9); const p = g.attributes.position.count, c = new Float32Array(p * 3), uvA = g.attributes.uv.array, L = uvA[(p - 1) * 2] || 1;
    for (let i = 0; i < p; i++) { const t = uvA[i * 2] / L, ring = 0.85 + 0.15 * Math.sin(uvA[i * 2] * 24); for (let k = 0; k < 3; k++) c[i * 3 + k] = lerp(PAL.corne0[k], PAL.corne1[k], Math.pow(t, 0.7)) * ring; }
    g.setAttribute("color", new THREE.BufferAttribute(c, 3)); return g; };
  for (const sx of [-1, 1]) {
    const C = new THREE.CatmullRomCurve3([V(sx * 0.46, 0.86, -0.82), V(sx * 0.62, 1.55, -1.35), V(sx * 0.82, 2.2, -2.3), V(sx * 1.05, 2.5, -3.3), V(sx * 1.2, 2.75, -3.9)]);
    const P = C.getPoints(28); bois.push(branche(P, 0.17, 0.035));
    const a = C.getPoint(0.35), b = C.getPoint(0.62);
    bois.push(branche(new THREE.CatmullRomCurve3([a, a.clone().add(V(sx * 0.25, 0.6, 0.35)), a.clone().add(V(sx * 0.35, 1.05, 0.5))]).getPoints(12), 0.1, 0.03));
    bois.push(branche(new THREE.CatmullRomCurve3([b, b.clone().add(V(sx * 0.35, 0.55, 0.1)), b.clone().add(V(sx * 0.55, 0.95, 0.05))]).getPoints(12), 0.08, 0.025));
  }
  const mB = new THREE.Mesh(fusion(bois.map(g => { for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv", "color"].includes(k)) g.deleteAttribute(k); return g; })), matBois); mB.castShadow = true; D.tete.add(mB);
  // collerettes : éventails de lames membraneuses derrière les joues
  const matFrange = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide, emissive: new THREE.Color(0.25, 0.05, 0.0) }); const fr = [];
  for (const sx of [-1, 1]) for (let k = 0; k < 6; k++) {
    const ang = -0.6 + k * 0.32, base = V(sx * 0.98, -0.05 + k * 0.05, -0.45), pts = [], L = 1.3 - Math.abs(k - 2.5) * 0.12;
    for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(base.clone().add(V(sx * (0.25 * t + 0.35 * t * t), Math.sin(ang) * L * t, -Math.cos(ang) * L * t - 0.25 * t * t))); }
    const g = new THREE.BufferGeometry(), P = [], C = [], I = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8, w = 0.16 * (1 - t) + 0.01, p = pts[i]; for (const s of [-1, 1]) { P.push(p.x, p.y + s * w * Math.cos(ang) * 0, p.z + s * w); const cc = t < 0.5 ? [lerp(0.36, 0.78, t * 2), lerp(0.022, 0.16, t * 2), lerp(0.018, 0.035, t * 2)] : [lerp(0.78, 1.0, t * 2 - 1), lerp(0.16, 0.72, t * 2 - 1), lerp(0.035, 0.30, t * 2 - 1)]; C.push(...cc); } }
    for (let i = 0; i < 8; i++) { const a = i * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeVertexNormals(); fillAttr2(g); fr.push(g);
  }
  D.tete.add(new THREE.Mesh(fusion(fr), matFrange));
  // pattes (sculptées une fois, quatre fois posées)
  const gP = peindre(geoDe(SD.mesh(f.patte, [-0.9, -4.5, -1.0, 2.2, 0.9, 2.3], 64)), f, "patte");
  D.pattes = [];
  for (let k = 0; k < 4; k++) { const grp = new THREE.Group(), m = new THREE.Mesh(gP, matPatte); m.castShadow = true; m.position.set(-0.5, 0, 0); m.scale.setScalar(0.55); grp.add(m); scene.add(grp); D.pattes.push({ grp, m, a: k < 2 ? 9 : 34, cote: k % 2 ? -1 : 1 }); }
  // mèches : crinière le long du cou et du dos, autour de la tête, barbe, touffe au bout de la queue
  D.meches = meches(260); scene.add(D.meches.mesh);
  D.listeM = [];
  const r = rng(77);
  for (let i = 0; i < 40; i++) { const a = 2.6 + i * 0.24; D.listeM.push({ a, phi: Math.PI / 2 + (r() - 0.5) * 1.4, L: lerp(1.9, 1.1, i / 40) * (0.8 + 0.4 * r()), courbe: 1.1 + r() * 0.4, w: 0.26, g: 0.3, ph: r() }); }   // le cou
  for (let i = 0; i < 70; i++) { const a = 12 + i * 0.68; D.listeM.push({ a, phi: Math.PI / 2 + (r() - 0.5) * 0.4, L: lerp(1.2, 0.5, i / 70) * (0.8 + 0.4 * r()), courbe: 0.8, w: 0.18, g: 0.1, ph: r() }); }  // la crête du dos
  for (let i = 0; i < 26; i++) { const a = LEN - 2.2 + i * 0.09; D.listeM.push({ a, phi: r() * TAU, L: 2.2 + r() * 1.6, courbe: 0.4, w: 0.34, g: 0.25, ph: r(), queue: 1 }); }     // la touffe de la queue
  // têtes : mèches rigides au crâne (positions locales), barbe sous le menton
  D.listeT = [];
  for (let i = 0; i < 60; i++) { const a = r() * TAU, el = -0.4 + r() * 1.3; D.listeT.push({ p: V(Math.cos(a) * 0.95 * Math.cos(el), 0.25 + Math.sin(el) * 0.7, -0.9 - r() * 0.5), y: V(Math.cos(a) * 0.5, 0.5 + Math.sin(el), -0.6).normalize(), L: 1.8 + r() * 1.6, courbe: 1.1, w: 0.36, g: 0.25, ph: r() }); }
  for (let i = 0; i < 14; i++) { const x = (r() - 0.5) * 0.7; D.listeT.push({ p: V(x, -0.95, 1.6 + r() * 0.6), y: V(x * 0.4, -1, -0.15).normalize(), L: 1.2 + r() * 1.2, courbe: 0.6, w: 0.22, g: 0.6, ph: r(), z: V(0, -0.2, -1) }); }
  // moustaches : chaînes de points qui traînent derrière le museau
  D.moust = [];
  const matM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.3, emissive: new THREE.Color(0.20, 0.035, 0.008) });
  for (const [sx, L, n, r0] of [[1, 7.5, 22, 0.055], [-1, 7.5, 22, 0.055], [1, 3, 12, 0.035], [-1, 3, 12, 0.035]]) {
    const pts = Array.from({ length: n }, () => V()), prev = pts.map(() => V());
    const g0 = tubeGeo(pts.map((p, i) => V(0, 0, -i)), t => r0 * (1 - 0.8 * t), 5); const c = new Float32Array(g0.attributes.position.count * 3); const uvA = g0.attributes.uv.array;
    for (let i = 0; i < g0.attributes.position.count; i++) { const t = uvA[i * 2] / (n - 1); c[i * 3] = lerp(0.9, 1.0, t); c[i * 3 + 1] = lerp(0.26, 0.72, t); c[i * 3 + 2] = lerp(0.06, 0.34, t); }
    g0.setAttribute("color", new THREE.BufferAttribute(c, 3)); g0.attributes.position.setUsage(THREE.DynamicDrawUsage); g0.attributes.normal.setUsage(THREE.DynamicDrawUsage);
    const mesh = new THREE.Mesh(g0, matM); mesh.frustumCulled = false; scene.add(mesh);
    D.moust.push({ sx, L, n, r0, pts, prev, mesh, init: false, racine: L > 5 ? V(sx * 0.36, -0.06, 2.3) : V(sx * 0.6, 0.55, 1.2) });
  }
  // ---- le feu ----
  D.feu = feu(scene);
  D.lumiere = new THREE.PointLight(0xff7a30, 0, 60, 1.6); scene.add(D.lumiere);
  D.temps = ((performance.now() - t0) / 1000).toFixed(2);
  return D;
}
function fillAttr2(g) { const n = g.attributes.position.count; g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n * 2), 2)); }

// ======================= le souffle de feu =======================
function feu(scene) {
  const NB = 700, g = new THREE.InstancedBufferGeometry(), q = new THREE.PlaneGeometry(1, 1);
  g.setAttribute("position", q.attributes.position); g.setAttribute("uv", q.attributes.uv); g.setIndex(q.index); g.instanceCount = NB;
  const P0 = new THREE.InstancedBufferAttribute(new Float32Array(NB * 4), 4), V0 = new THREE.InstancedBufferAttribute(new Float32Array(NB * 4), 4);
  P0.setUsage(THREE.DynamicDrawUsage); V0.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute("aP", P0); g.setAttribute("aV", V0);
  for (let i = 0; i < NB; i++) P0.array[i * 4 + 3] = -99;
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: G.uTime },
    vertexShader: `uniform float uTime; attribute vec4 aP, aV; varying vec2 vUv; varying float vAge; varying float vS;
      void main(){ float age = uTime - aP.w; vAge = age / aV.w; vS = fract(aP.w * 7.31);
        if (vAge < 0.0 || vAge > 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
        vec3 p = aP.xyz + aV.xyz * age * (1.0 - 0.35 * age) + vec3(0.0, 2.5, 0.0) * age * age;
        float s = mix(0.8, 7.5, pow(vAge, 0.7)) * (0.8 + 0.4 * vS);
        vec3 cr = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), cu = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        float a = vS * 6.28 + age * 2.0; vec2 q = vec2(cos(a) * position.x - sin(a) * position.y, sin(a) * position.x + cos(a) * position.y);
        vUv = uv; gl_Position = projectionMatrix * viewMatrix * vec4(p + (cr * q.x + cu * q.y) * s, 1.0); }`,
    fragmentShader: `varying vec2 vUv; varying float vAge, vS;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main(){ vec2 q = vUv - 0.5; float d = length(q) * 2.0; float n = n2(vUv * 5.0 + vS * 10.0) * 0.6 + n2(vUv * 11.0 - vS * 7.0) * 0.4;
        float a = smoothstep(1.0, 0.3, d + (n - 0.5) * 0.6);
        vec3 hot = vec3(9.0, 4.5, 1.6), mid = vec3(6.0, 1.4, 0.18), cold = vec3(0.35, 0.08, 0.02);
        vec3 c = mix(hot, mid, smoothstep(0.0, 0.35, vAge)); c = mix(c, cold, smoothstep(0.5, 1.0, vAge));
        a *= smoothstep(1.0, 0.6, vAge) * (0.35 + 0.65 * n);
        gl_FragColor = vec4(c * a * 0.55, 1.0); }` });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.layers.set(1); mesh.renderOrder = 5; scene.add(mesh);
  return { mesh, P0, V0, NB, k: 0, acc: 0 };
}

// ======================= le vol =======================
const HN = 4096, DS = 0.12;                       // historique : un point tous les 12 cm
export function etatDragon(D, x, y, z, yaw) {
  const S = D.S = { p: V(x, y, z), yaw, pitch: 0, roll: 0, v: 22, vCible: 22, s: 0, hp: new Float32Array(HN * 3), hu: new Float32Array(HN * 3), n: 0, accu: 0, feu: 0, gueule: 0, glow: 0, ondT: 0, fwd: V(), up: V(0, 1, 0), vel: V() };
  // historique rempli d'une ligne droite derrière la tête
  const back = V(Math.sin(yaw), 0, Math.cos(yaw));
  for (let i = 0; i < HN; i++) { const k = (HN - i) % HN; S.hp[k * 3] = x + back.x * i * DS; S.hp[k * 3 + 1] = y; S.hp[k * 3 + 2] = z + back.z * i * DS; S.hu[k * 3 + 1] = 1; }
  S.n = 0; S.vit = 0; S.fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw));
  for (const m of D.moust) m.init = false;
  return S;
}
// point de l'historique à « a » mètres derrière la tête (interpolé)
function hist(S, a, out, up) {
  const f = (a - S.accu) / DS;
  if (f < 0) {       // entre la tête et le point le plus récent
    const t = S.accu > 1e-6 ? a / S.accu : 0, i0 = S.n;
    out.set(lerp(S.p.x, S.hp[i0 * 3], t), lerp(S.p.y, S.hp[i0 * 3 + 1], t), lerp(S.p.z, S.hp[i0 * 3 + 2], t));
    if (up) up.set(lerp(S.up.x, S.hu[i0 * 3], t), lerp(S.up.y, S.hu[i0 * 3 + 1], t), lerp(S.up.z, S.hu[i0 * 3 + 2], t));
    return out;
  }
  const i = Math.floor(f), t = f - i, i0 = (S.n - i + HN * 4) % HN, i1 = (S.n - i - 1 + HN * 4) % HN;
  out.set(lerp(S.hp[i0 * 3], S.hp[i1 * 3], t), lerp(S.hp[i0 * 3 + 1], S.hp[i1 * 3 + 1], t), lerp(S.hp[i0 * 3 + 2], S.hp[i1 * 3 + 2], t));
  if (up) up.set(lerp(S.hu[i0 * 3], S.hu[i1 * 3], t), lerp(S.hu[i0 * 3 + 1], S.hu[i1 * 3 + 1], t), lerp(S.hu[i0 * 3 + 2], S.hu[i1 * 3 + 2], t));
  return out;
}
const A = Array.from({ length: NR }, () => ({ p: V(), t: V(), n: V(), b: V(), r: 1, u: V() }));
export const anneaux = A;
const tA = V(), tB = V(), tU = V(), tmp = V(), mm = new THREE.Matrix4(), qq = new THREE.Quaternion(), e3 = new THREE.Euler();

// entrées : { yaw (-1..1 à droite), pitch (-1..1 monte), vite, lent, feu }
export function volerDragon(D, inp, dt, monde) {
  const S = D.S;
  // vitesse
  S.vCible = inp.vite ? 46 : inp.lent ? 9 : 24;
  S.v = lerp(S.v, S.vCible, 1 - Math.exp(-dt * (inp.vite ? 1.4 : 1.0)));
  // cap et tangage (le tangage revient doucement à plat sans commande)
  const tour = (1.25 - 0.35 * clamp((S.v - 20) / 26)) * inp.yaw;
  S.yawV = lerp(S.yawV || 0, tour, 1 - Math.exp(-dt * 4));
  S.yaw -= S.yawV * dt;
  const pc = clamp(inp.pitch, -1, 1) * 0.95;
  S.pitch = lerp(S.pitch, pc, 1 - Math.exp(-dt * (Math.abs(inp.pitch) > 0.05 ? 2.2 : 1.2)));
  S.roll = lerp(S.roll, -S.yawV * 0.55 * clamp(S.v / 24, 0.4, 1.4), 1 - Math.exp(-dt * 3));
  S.fwd.set(-Math.sin(S.yaw) * Math.cos(S.pitch), Math.sin(S.pitch), -Math.cos(S.yaw) * Math.cos(S.pitch));
  // haut de la tête : penché dans les virages
  const droite = tmp.set(Math.cos(S.yaw), 0, -Math.sin(S.yaw));
  S.up.set(0, 1, 0).addScaledVector(S.fwd, -S.fwd.y).normalize().applyAxisAngle(S.fwd, S.roll);
  // avance
  S.vel.copy(S.fwd).multiplyScalar(S.v);
  const np = S.p.clone().addScaledVector(S.vel, dt);
  // collisions : sol, eau (on rase), pics, bâtiments, bord du monde
  const sol = monde.sol(np.x, np.z);
  if (np.y < sol + 3.0) { np.y = sol + 3.0; if (S.pitch < 0) S.pitch *= 0.85; }
  if (np.y < 2.2) np.y = 2.2;
  monde.repousser(np, 4);
  if (np.y > 620) np.y = 620;
  const rr = Math.hypot(np.x, np.z - 30); if (rr > 1150) { np.x *= 1150 / rr; np.z = 30 + (np.z - 30) * 1150 / rr; S.yaw += dt * 1.5; }
  const d = np.distanceTo(S.p); S.p.copy(np);
  // historique
  S.accu += d;
  while (S.accu >= DS) {
    S.accu -= DS; S.n = (S.n + 1) % HN;
    const back = tB.copy(S.fwd).multiplyScalar(-S.accu);
    S.hp[S.n * 3] = S.p.x + back.x; S.hp[S.n * 3 + 1] = S.p.y + back.y; S.hp[S.n * 3 + 2] = S.p.z + back.z;
    S.hu[S.n * 3] = S.up.x; S.hu[S.n * 3 + 1] = S.up.y; S.hu[S.n * 3 + 2] = S.up.z;
  }
  S.s += d; S.ondT += dt;
  // feu
  S.feu = inp.feu ? Math.min(1, S.feu + dt * 4) : Math.max(0, S.feu - dt * 3);
  S.gueule = lerp(S.gueule, inp.feu ? 1 : (inp.rugir || 0), 1 - Math.exp(-dt * 10));
  S.glow = lerp(S.glow, S.feu, 1 - Math.exp(-dt * 3));
}

// met à jour les géométries à partir de l'état
export function poserDragon(D, dt, cam) {
  const S = D.S, T = G.uTime.value;
  // 1) les anneaux : chemin + ondulation qui court vers la queue
  const pas = LEN / (NR - 1), vit = clamp(S.v / 24, 0.35, 1.8);
  for (let i = 0; i < NR; i++) {
    const R = A[i], a = i * pas + S.accu;
    hist(S, i * pas, R.p, R.u); hist(S, i * pas + 0.6, tA); hist(S, Math.max(0, i * pas - 0.6), tB);
    R.t.subVectors(tB, tA); if (R.t.lengthSq() < 1e-8) R.t.copy(S.fwd); R.t.normalize();
    R.b.crossVectors(R.t, R.u); if (R.b.lengthSq() < 1e-6) R.b.set(1, 0, 0); R.b.normalize(); R.n.crossVectors(R.b, R.t).normalize();
    const f = i / (NR - 1), amp = sm(0.04, 0.3, f) * (0.55 + 0.6 * f) * (1.25 - 0.45 * clamp((S.v - 15) / 30));
    const ph = (i * pas) * (TAU / 17) - S.ondT * (1.6 + 2.2 * vit);
    R.p.addScaledVector(R.n, Math.sin(ph) * amp * 0.9).addScaledVector(R.b, Math.sin(ph * 0.7 + 1.3) * amp * 0.45);
    R.r = rayon(i * pas) * (1 + 0.04 * Math.sin(T * 1.7) * sm(0.05, 0.15, f) * sm(0.4, 0.2, f));
  }
  for (let i = 0; i < NR; i++) {      // repères refaits après l'ondulation
    const R = A[i], a = A[Math.max(0, i - 1)], b = A[Math.min(NR - 1, i + 1)];
    R.t.subVectors(a.p, b.p).normalize(); R.b.crossVectors(R.t, R.u).normalize(); R.n.crossVectors(R.b, R.t).normalize();
  }
  const pos = D.corps.geometry.attributes.position.array, nor = D.corps.geometry.attributes.normal.array, at = D.corps.geometry.attributes.aT.array;
  for (let i = 0; i < NR; i++) {
    const R = A[i];
    for (let j = 0; j <= NS; j++) {
      const th = j / NS * TAU, c = Math.cos(th), s = Math.sin(th), k = (i * (NS + 1) + j) * 3;
      const nx = R.b.x * c + R.n.x * s, ny = R.b.y * c + R.n.y * s, nz = R.b.z * c + R.n.z * s;
      const dos = Math.exp(-Math.pow((th - Math.PI / 2) / 0.22, 2)) * 0.07;
      const rr = R.r * (1 - 0.13 * Math.max(0, -s) + dos);
      pos[k] = R.p.x + nx * rr; pos[k + 1] = R.p.y + ny * rr; pos[k + 2] = R.p.z + nz * rr;
      nor[k] = nx; nor[k + 1] = ny; nor[k + 2] = nz; at[k] = -R.t.x; at[k + 1] = -R.t.y; at[k + 2] = -R.t.z;
    }
  }
  const ga = D.corps.geometry.attributes; ga.position.needsUpdate = ga.normal.needsUpdate = ga.aT.needsUpdate = true;
  // 2) la tête, au bout du premier anneau, dans la direction du vol
  const R0 = A[0], R1 = A[3];
  tA.subVectors(R0.p, R1.p).normalize().lerp(S.fwd, 0.6).normalize();
  tU.copy(R0.n); tB.crossVectors(tU, tA).normalize(); tU.crossVectors(tA, tB).normalize();
  mm.makeBasis(tB, tU, tA); D.tete.quaternion.setFromRotationMatrix(mm);
  // la tête se tourne un peu vers le virage
  qq.setFromAxisAngle(tU, S.yawV * -0.15); D.tete.quaternion.premultiply(qq);
  D.tete.position.copy(R0.p).addScaledVector(tA, 0.15 * HS).addScaledVector(tU, 0.0);
  D.tete.updateMatrixWorld();
  D.mach.rotation.x = 0.06 + S.gueule * 0.62 + Math.sin(T * 1.3) * 0.02;
  U.uGlow.value = S.glow;
  // 3) pattes : elles pagaient quand le dragon va lentement, se replient le long du ventre en vitesse
  const repli = sm(18, 34, S.v);
  for (const L of D.pattes) {
    const i = Math.round(L.a / pas), R = A[i];
    tB.copy(R.b).multiplyScalar(L.cote);
    mm.makeBasis(tB.clone().multiplyScalar(-L.cote).negate(), R.n, R.t); qq.setFromRotationMatrix(mm);
    const pag = Math.sin(T * 2.4 + L.a) * 0.45 * (1 - repli);
    e3.set(0.35 + repli * 1.05 + pag, 0, L.cote * (0.65 - repli * 0.35)); const q2 = new THREE.Quaternion().setFromEuler(e3);
    L.grp.quaternion.copy(qq).multiply(q2);
    L.grp.position.copy(R.p).addScaledVector(tB, R.r * 0.7).addScaledVector(R.n, -R.r * 0.35);
    L.m.scale.set(L.cote * 0.55, 0.55, 0.55); L.m.position.set(-0.4 * L.cote, 0, 0);
  }
  // 4) mèches
  const Mm = D.meches, ar = Mm.A.array, ay = Mm.B.array, az = Mm.C.array, al = Mm.D.array; let n = 0;
  uFlot.value = clamp(S.v / 40, 0, 1);
  const put = (p, y, z, m) => { ar[n * 4] = p.x; ar[n * 4 + 1] = p.y; ar[n * 4 + 2] = p.z; ar[n * 4 + 3] = m.L; ay[n * 4] = y.x; ay[n * 4 + 1] = y.y; ay[n * 4 + 2] = y.z; ay[n * 4 + 3] = m.courbe; az[n * 4] = z.x; az[n * 4 + 1] = z.y; az[n * 4 + 2] = z.z; az[n * 4 + 3] = m.w; al[n * 4] = m.ph; al[n * 4 + 2] = m.g; n++; };
  for (const m of D.listeM) {
    const i = Math.min(NR - 1, Math.round(m.a / pas)), R = A[i], c = Math.cos(m.phi), s = Math.sin(m.phi);
    const dir = tA.set(R.b.x * c + R.n.x * s, R.b.y * c + R.n.y * s, R.b.z * c + R.n.z * s);
    const p = tU.copy(R.p).addScaledVector(dir, R.r * 0.9);
    if (m.queue) put(p, tB.copy(R.t).multiplyScalar(-1).addScaledVector(dir, 0.6).normalize(), dir, m);
    else put(p, dir, tB.copy(R.t).negate(), m);
  }
  const W = D.tete.matrixWorld;
  for (const m of D.listeT) { const p = tA.copy(m.p).applyMatrix4(W), y = tB.copy(m.y).transformDirection(W), z = tU.copy(m.z || V(0, 0, -1)).transformDirection(W); put(p, y, z, m); }
  Mm.mesh.geometry.instanceCount = n; Mm.A.needsUpdate = Mm.B.needsUpdate = Mm.C.needsUpdate = Mm.D.needsUpdate = true;
  Mm.mesh.material.uniforms.uSun.value.set(-0.46, 0.56, -0.69).normalize();
  // 5) moustaches : chaînes qui traînent (on garde la longueur des maillons)
  for (const m of D.moust) {
    const root = tA.copy(m.racine).applyMatrix4(W), seg = m.L / (m.n - 1);
    if (!m.init) { for (let i = 0; i < m.n; i++) { m.pts[i].copy(root).addScaledVector(S.fwd, -i * seg); m.prev[i].copy(m.pts[i]); } m.init = true; }
    m.pts[0].copy(root);
    for (let i = 1; i < m.n; i++) { const p = m.pts[i], pr = m.prev[i]; const vx = (p.x - pr.x) * 0.9, vy = (p.y - pr.y) * 0.9, vz = (p.z - pr.z) * 0.9; pr.copy(p);
      p.x += vx + Math.sin(T * 2.1 + i * 0.6 + m.sx) * 0.02 * i / m.n; p.y += vy - 0.004 * dt * 60 + Math.sin(T * 1.7 + i * 0.5) * 0.015; p.z += vz; }
    for (let it = 0; it < 3; it++) for (let i = 1; i < m.n; i++) { const a = m.pts[i - 1], b = m.pts[i]; tB.subVectors(b, a); let l = tB.length(); if (!(l > 1e-5)) { tB.copy(S.fwd).negate(); l = 1; } b.copy(a).addScaledVector(tB, seg / l); }
    if (!Number.isFinite(m.pts[m.n - 1].x)) { m.init = false; continue; }
    // première partie : sort du museau vers l'extérieur
    const out = tB.set(m.sx * 0.7, -0.2, -0.5).transformDirection(W); m.pts[1].copy(m.pts[0]).addScaledVector(out, seg);
    const g = tubeGeo(m.pts, t => m.r0 * (1 - 0.8 * t), 5);
    m.mesh.geometry.attributes.position.array.set(g.attributes.position.array); m.mesh.geometry.attributes.normal.array.set(g.attributes.normal.array);
    m.mesh.geometry.attributes.position.needsUpdate = true; m.mesh.geometry.attributes.normal.needsUpdate = true; g.dispose();
  }
  // 6) le feu
  const F = D.feu;
  const bouche = tA.set(0, -0.35, 2.6).applyMatrix4(W), dir = tB.set(0, -0.08, 1).transformDirection(W);
  if (S.feu > 0.05) {
    F.acc += dt * 260 * S.feu;
    while (F.acc > 1) { F.acc -= 1; const i = F.k; F.k = (F.k + 1) % F.NB;
      const sp = 0.16, d = V(dir.x + (Math.random() - .5) * sp, dir.y + (Math.random() - .5) * sp, dir.z + (Math.random() - .5) * sp).normalize();
      F.P0.array.set([bouche.x + (Math.random() - .5) * 0.6, bouche.y, bouche.z + (Math.random() - .5) * 0.6, T - Math.random() * dt], i * 4);
      F.V0.array.set([d.x * 58 + S.vel.x * 0.9, d.y * 58 + S.vel.y * 0.9, d.z * 58 + S.vel.z * 0.9, 0.75 + Math.random() * 0.4], i * 4); }
    F.P0.needsUpdate = F.V0.needsUpdate = true;
  }
  D.lumiere.position.copy(bouche).addScaledVector(dir, 12);
  D.lumiere.intensity = S.feu * (900 + 300 * Math.sin(T * 40) * Math.sin(T * 23));
  D.bouche = bouche; D.dirFeu = dir;
}
