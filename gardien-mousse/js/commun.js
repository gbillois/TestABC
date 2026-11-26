// Shared tools: maths helpers, seeded random, terrain height (same formula in JS and GLSL),
// and the "painted toon" material used by almost everything in the scene.
import * as THREE from "three";
import { CONFIG } from "./config.js";

export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
/** frame-rate independent smoothing factor: damp(k, dt) in [0,1] */
export const damp = (k, dt) => 1 - Math.exp(-k * dt);
export const col = c => new THREE.Color(c);

/** Small deterministic random generator (mulberry32). */
export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Shared clock uniform, read by every animated shader. */
export const SHARED = { uTime: { value: 0 }, uPlayer: { value: new THREE.Vector3() }, quality: CONFIG.quality.haute };

export const SUN_DIR = new THREE.Vector3(...CONFIG.sun.direction).normalize();

// ---------------------------------------------------------------- terrain
// Gentle rolling ground, flat in the clearing. Keep JS and GLSL versions identical.
const H = CONFIG.world.hills, CR = CONFIG.world.clearingRadius;
export function groundHeight(x, z) {
  const h = Math.sin(x * 0.011) * Math.cos(z * 0.013) * 1.0 + Math.sin(x * 0.027 + z * 0.019) * 0.5 + Math.cos(z * 0.041 - x * 0.007) * 0.25;
  const r = Math.hypot(x, z);
  return h * H * smooth(CR * 0.6, CR * 1.6, r) - 0.0;
}
export const GLSL_GROUND = /* glsl */`
float groundHeight(vec2 p){
  float h = sin(p.x * 0.011) * cos(p.y * 0.013) + sin(p.x * 0.027 + p.y * 0.019) * 0.5 + cos(p.y * 0.041 - p.x * 0.007) * 0.25;
  return h * ${H.toFixed(3)} * smoothstep(${(CR * 0.6).toFixed(2)}, ${(CR * 1.6).toFixed(2)}, length(p));
}`;

// ---------------------------------------------------------------- noise (GLSL)
export const GLSL_NOISE = /* glsl */`
float hash21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash31(vec3 p3){ p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 x){ vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y); }
float vnoise3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x), mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x), mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm2(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
float fbm3(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * vnoise3(p); p = p * 2.03 + vec3(1.7, 9.2, 4.1); a *= 0.5; } return s; }
`;

// ---------------------------------------------------------------- toon ramp
// The light ramp of the toon shading: 4 flat tones, like painted cel animation.
let ramp = null;
export function toonRamp() {
  if (ramp) return ramp;
  const v = [70, 105, 175, 235, 255];
  const d = new Uint8Array(v.length * 4);
  v.forEach((x, i) => d.set([x, x, x, 255], i * 4));
  ramp = new THREE.DataTexture(d, v.length, 1, THREE.RGBAFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true;
  return ramp;
}

/**
 * The painted toon material.
 * options:
 *   color          base colour
 *   patches        [{ color, scale, threshold }]   blotches of another colour (rust, panels, lichen)
 *   brush          0..1  strength of the brush-stroke grain
 *   rim            rim light colour (warm back light) or null
 *   space          "object" (patterns stick to moving parts) or "world"
 *   mossCoat       true: keeps only the upper / noisy parts of the surface (moss growing on things)
 *   wind           sway strength for foliage (vertex animation, world space)
 *   instanced colours are supported through InstancedMesh.setColorAt
 */
export function paintMaterial(o = {}) {
  const m = new THREE.MeshToonMaterial({ color: o.color ?? "#ffffff", gradientMap: toonRamp(), side: o.side ?? THREE.FrontSide });
  if (o.emissive) { m.emissive = col(o.emissive); m.emissiveIntensity = o.emissiveIntensity ?? 1; }
  const patches = (o.patches || []).slice(0, 3);
  const u = {
    uTime: SHARED.uTime,
    uBrush: { value: o.brush ?? 0.35 },
    uRim: { value: col(o.rim ?? "#000000") },
    uRimPow: { value: o.rimPower ?? 3.0 },
    uWind: { value: o.wind ?? 0 },
    uCoat: { value: o.mossCoat ? (o.coatAmount ?? 0.5) : -1 },
    uPC: { value: patches.map(p => col(p.color)).concat([col(0), col(0), col(0)]).slice(0, 3) },
    uPS: { value: patches.map(p => p.scale).concat([1, 1, 1]).slice(0, 3) },
    uPT: { value: patches.map(p => p.threshold).concat([2, 2, 2]).slice(0, 3) },
  };
  m.userData.u = u;
  const space = o.space === "world" ? "W" : "O";
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>
        uniform float uTime, uWind; varying vec3 vO; varying vec3 vW; varying vec3 vON;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        vO = position; vON = normal;
        {
          vec4 wp0 = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            wp0 = instanceMatrix * wp0;
          #endif
          wp0 = modelMatrix * wp0;
          if (uWind > 0.0) {
            // foliage sway: grows with height above the object's origin
            float k = uWind * max(position.y + 1.0, 0.0);
            vec3 sway = vec3(sin(uTime * 1.3 + wp0.x * 0.05 + wp0.z * 0.03), 0.0, cos(uTime * 1.1 + wp0.z * 0.05)) * k * 0.06;
            transformed += sway;
            wp0.xyz += sway;
          }
          vW = wp0.xyz;
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
        ${GLSL_NOISE}
        uniform float uBrush, uRimPow, uCoat; uniform vec3 uRim; uniform vec3 uPC[3]; uniform float uPS[3]; uniform float uPT[3];
        varying vec3 vO; varying vec3 vW; varying vec3 vON;`)
      .replace("#include <color_fragment>", `#include <color_fragment>
        {
          vec3 P = ${space === "W" ? "vW" : "vO"};
          if (uCoat > -0.5) {
            // moss coat: keep the tops, eat the edges with noise
            float n = fbm3(P * 0.9) + normalize(vON).y * 0.55;
            if (n < 1.0 - uCoat) discard;
          }
          for (int i = 0; i < 3; i++) {
            float n = fbm3(P * uPS[i] + float(i) * 17.3);
            diffuseColor.rgb = mix(diffuseColor.rgb, uPC[i], smoothstep(uPT[i] - 0.015, uPT[i] + 0.015, n));
          }
          float b = fbm3(P * vec3(2.6, 7.0, 2.6));
          diffuseColor.rgb *= 1.0 + (b - 0.5) * uBrush;
        }`)
      .replace("#include <opaque_fragment>", `
        {
          float fr = 1.0 - max(dot(normal, normalize(vViewPosition)), 0.0);
          outgoingLight += uRim * pow(fr, uRimPow) * diffuseColor.rgb * 1.6;
        }
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `paint-${space}-${patches.length}-${o.mossCoat ? 1 : 0}-${o.wind ? 1 : 0}`;
  return m;
}

/** Inverted-hull outline: a dark, slightly inflated back-face copy of a mesh. */
export function outlineMaterial(width = CONFIG.robot.outlineWidth, color = CONFIG.robot.outline) {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      transformed += normalize(normal) * ${width.toFixed(3)};`);
  };
  return m;
}

/** A lumpy blob geometry (displaced icosphere), used for moss, foliage, clouds. */
export function blobGeometry(detail = 2, rough = 0.28, seed = 1) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position, v = new THREE.Vector3();
  const r = rng(seed);
  const a = [r() * 10, r() * 10, r() * 10];
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 3.1 + a[0]) * Math.sin(v.y * 2.7 + a[1]) * Math.sin(v.z * 3.3 + a[2]) + 0.5 * Math.sin(v.x * 7 + v.z * 5 + a[1]);
    v.multiplyScalar(1 + n * rough);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  // smooth radial normals: soft, rounded toon shading even with few polygons
  const nrm = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize(); nrm.set([v.x, v.y, v.z], i * 3); }
  g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  return g;
}

/** Canvas helper: make a texture by drawing on a 2D canvas. */
export function canvasTexture(w, h, draw, srgb = true) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Soft round "paint dab" texture, white, used by particles and glows. */
export const dabTexture = (() => {
  let t; return () => t || (t = canvasTexture(128, 128, (g, w, h) => {
    const r = rng(5);
    for (let i = 0; i < 26; i++) {
      const a = r() * TAU, d = r() * 26, x = 64 + Math.cos(a) * d, y = 64 + Math.sin(a) * d, s = 18 + r() * 22;
      const gr = g.createRadialGradient(x, y, 0, x, y, s);
      gr.addColorStop(0, "rgba(255,255,255,0.55)"); gr.addColorStop(0.7, "rgba(255,255,255,0.35)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill();
    }
  }));
})();

/** Cartoon puff texture (hard-edged overlapping circles, lit from above), for dust clouds. */
export const puffTexture = (() => {
  let t; return () => t || (t = canvasTexture(128, 128, (g) => {
    const r = rng(17), circles = [];
    for (let i = 0; i < 9; i++) { const a = r() * TAU, d = r() * 24; circles.push([64 + Math.cos(a) * d, 70 + Math.sin(a) * d * 0.7, 18 + r() * 16]); }
    g.fillStyle = "#b9b1a6"; for (const [x, y, s] of circles) { g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill(); }
    g.fillStyle = "#ffffff"; for (const [x, y, s] of circles) { g.beginPath(); g.arc(x - s * 0.18, y - s * 0.22, s * 0.8, 0, TAU); g.fill(); }
  }));
})();

/** Glow texture (radial, soft). */
export const glowTexture = (() => {
  let t; return () => t || (t = canvasTexture(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }));
})();
