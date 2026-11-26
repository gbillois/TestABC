// L'eau : le lac (vrai miroir de la vallée, vagues, fond qui se voit près des rives, écume, reflets du soleil), les cascades
// qui tombent du plateau, leur brume, et l'eau des rigoles.
import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import { GLSL_ATMO_SEUL, G, rng, V, TAU, clamp } from "./commun.js";
import { WY, LAC, CARTE, PLAT_Y } from "./monde.js";
import { CASCADES } from "./archi.js";

// carte de vagues qui se répète : somme de petites ondes (vecteurs d'onde entiers -> raccord parfait)
function texVagues() {
  const S = 256, d = new Uint8Array(S * S * 4), r = rng(31), ondes = [];
  for (let i = 0; i < 40; i++) { const a = r() * TAU, k = 1 + Math.floor(r() * (i < 10 ? 4 : 14)); ondes.push([Math.round(Math.cos(a) * k), Math.round(Math.sin(a) * k), r() * TAU, 1 / (k * k * 0.6 + 1)]); }
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let gx = 0, gy = 0, h = 0; const u = x / S * TAU, v = y / S * TAU;
    for (const [kx, ky, ph, a] of ondes) { const s = kx * u + ky * v + ph, c = Math.cos(s); gx += -kx * Math.sin(s) * a; gy += -ky * Math.sin(s) * a; h += c * a; }
    const o = (x + y * S) * 4; d[o] = clamp(128 + gx * 22, 0, 255); d[o + 1] = clamp(128 + gy * 22, 0, 255); d[o + 2] = clamp(128 + h * 40, 0, 255); d[o + 3] = 255;
  }
  const t = new THREE.DataTexture(d, S, S, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
}

const NC = 3;
export function construireEau(scene, qualite) {
  const tV = texVagues();
  const casc = Array.from({ length: NC }, (_, i) => CASCADES[i] ? new THREE.Vector4(CASCADES[i].p.x + CASCADES[i].n.x * 9, 0, CASCADES[i].p.z + CASCADES[i].n.z * 9, CASCADES[i].larg) : new THREE.Vector4(0, -999, 0, 0));
  const uDrag = { value: new THREE.Vector4(0, -999, 0, 0) };
  const shader = {
    name: "Lac",
    uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, uTime: G.uTime, tV: { value: tV }, tCarte: { value: CARTE.tex }, uCarte: { value: new THREE.Vector4(CARTE.x0, CARTE.z0, CARTE.T, 0) }, uCasc: { value: casc }, uDrag, uMiroir: { value: 1 } },
    vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vW;
      void main(){ vUv = textureMatrix * vec4(position, 1.0); vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `${GLSL_ATMO_SEUL}
      uniform sampler2D tDiffuse, tV, tCarte; uniform vec3 color; uniform vec4 uCarte, uCasc[${NC}], uDrag; uniform float uMiroir; varying vec4 vUv; varying vec3 vW;
      vec3 vagues(vec2 p, float fw){
        vec2 g = vec2(0.0); float t = uTime;
        vec3 a = texture2D(tV, p * 0.018 + vec2(t * 0.011, t * 0.004)).xyz * 2.0 - 1.0;
        vec3 b = texture2D(tV, p * 0.047 + vec2(-t * 0.008, t * 0.017)).xyz * 2.0 - 1.0;
        vec3 c = texture2D(tV, p * 0.13 + vec2(t * 0.03, -t * 0.021)).xyz * 2.0 - 1.0;
        g = a.xy * 0.9 + b.xy * 0.6 + c.xy * 0.45 * (1.0 - smoothstep(0.5, 3.0, fw));
        return vec3(g, a.z + b.z * 0.5);
      }
      void main(){
        vec3 V = cameraPosition - vW; float dist = length(V); V /= dist; float fw = length(fwidth(vW.xz));
        vec4 cs = texture2D(tCarte, (vW.xz - uCarte.xy) / uCarte.z); float prof = max(${WY.toFixed(1)} - cs.r, 0.0);
        vec3 w = vagues(vW.xz, fw);
        // remous au pied des cascades et sillage du dragon
        float rem = 0.0; vec2 gr = vec2(0.0);
        for (int i = 0; i < ${NC}; i++){ vec2 q = vW.xz - uCasc[i].xz; float l = length(q) / (uCasc[i].w * 1.6); rem += exp(-l * l) ; gr += normalize(q + 1e-4) * sin(length(q) * 1.4 - uTime * 6.0) * exp(-l * 0.8) * 0.6; }
        { vec2 q = vW.xz - uDrag.xz; float l = length(q); float k = uDrag.w * exp(-l * l / 300.0); gr += normalize(q + 1e-4) * sin(l * 0.9 - uTime * 7.0) * k * 1.5; rem += k * 0.8; }
        vec3 n = normalize(vec3(-(w.x + gr.x) * 0.10, 1.0, -(w.y + gr.y) * 0.10));
        float fres = 0.025 + 0.975 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
        vec4 uv = vUv; uv.xy += n.xz * 2.2 * uv.w / max(1.0, dist * 0.03);
        vec3 refl = uMiroir > 0.5 ? texture2DProj(tDiffuse, uv).rgb : skyBase(reflect(-V, n));
        // l'eau elle-même : jade profond, fond qui se voit près des rives
        vec3 deep = vec3(0.012, 0.055, 0.050), mid = vec3(0.04, 0.16, 0.13), fond = vec3(0.22, 0.20, 0.13) * (0.7 + 0.6 * vnoise(vW.xz * 0.3));
        float k1 = exp(-prof * 0.45), k2 = exp(-prof * 0.08);
        vec3 corps = mix(deep, mid, k2); corps = mix(corps, fond * 0.55, k1 * 0.8);
        corps += vec3(0.02, 0.06, 0.04) * clamp(w.z, 0.0, 1.0);
        vec3 c = mix(corps, refl, clamp(fres * 1.15, 0.0, 0.92));
        vec3 h = normalize(SUN_DIR + V); float sp = pow(max(dot(n, h), 0.0), 900.0) * 40.0 + pow(max(dot(n, h), 0.0), 90.0) * 0.35;
        c += SUN_C * sp * cloudShade(vW);
        // écume : au bord, et dans les remous
        float bord = smoothstep(0.6, 0.0, prof) * smoothstep(0.35, 0.7, vnoise(vW.xz * 1.2 + uTime * 0.3) + 0.25 * sin(prof * 20.0 - uTime * 2.0));
        float ec = clamp(bord + rem * smoothstep(0.45, 0.75, vnoise(vW.xz * 0.9 + vec2(0.0, uTime * 0.8))), 0.0, 1.0);
        c = mix(c, vec3(0.78, 0.82, 0.84) * (0.6 + 0.6 * max(dot(n, SUN_DIR), 0.0)), ec * 0.85);
        float alpha = smoothstep(0.0, 0.35, prof);
        gl_FragColor = vec4(hazeApply(c, vW, cameraPosition), alpha);
      }`
  };
  const geo = new THREE.PlaneGeometry(900, 900, 1, 1);
  const k = qualite === "haute" ? 0.5 : 0.35;
  const lac = new Reflector(geo, { shader, textureWidth: Math.round(innerWidth * k * 1.5), textureHeight: Math.round(innerHeight * k * 1.5), clipBias: 0.002, multisample: 0 });
  lac.rotation.x = -Math.PI / 2; lac.position.set(LAC.x, WY, LAC.z);
  lac.material.transparent = true; lac.material.depthWrite = true;
  lac.material.uniforms.uTime = G.uTime;
  lac.renderOrder = 2;
  scene.add(lac);
  // version sans miroir (qualité Rapide) : même shader, le ciel en reflet
  const simple = new THREE.Mesh(geo.clone().rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ ...shader, uniforms: { ...shader.uniforms, uMiroir: { value: 0 }, tDiffuse: { value: null }, textureMatrix: { value: new THREE.Matrix4() } }, transparent: true }));
  simple.position.set(LAC.x, WY, LAC.z); simple.visible = false; scene.add(simple);

  // ---------- cascades ----------
  const mc = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTime: G.uTime },
    vertexShader: `attribute float aY; varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }`,
    fragmentShader: `${GLSL_ATMO_SEUL} varying vec2 vUv; varying vec3 vW;
      void main(){
        float t = uTime; vec2 p = vec2(vUv.x * 9.0, vUv.y * 3.0);
        float n = fbm2(vec2(p.x, p.y * 2.0 - t * 2.6)), n2 = vnoise(vec2(p.x * 3.0, p.y * 6.0 - t * 5.5)), n3 = vnoise(vec2(p.x * 7.0, p.y * 10.0 - t * 8.0));
        float bord = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
        float rideau = smoothstep(0.30, 0.75, n * 0.8 + n2 * 0.35 + (1.0 - bord) * -0.2);
        float a = bord * mix(0.35, 1.0, rideau) * (0.8 + 0.2 * n3) * smoothstep(0.0, 0.03, vUv.y);
        a *= mix(1.0, 0.75, smoothstep(0.85, 1.0, vUv.y));
        vec3 c = mix(vec3(0.40, 0.55, 0.58), vec3(1.6, 1.62, 1.6), smoothstep(0.35, 0.85, n * 0.7 + n3 * 0.4));
        c *= 0.75 + 0.45 * max(dot(normalize(vec3(0.0, 0.3, 1.0)), SUN_DIR), 0.0) * cloudShade(vW);
        gl_FragColor = vec4(hazeApply(c, vW, cameraPosition), a * 0.94);
      }`
  });
  const brumes = [];
  for (const C of CASCADES) {
    const H0 = C.p.y, W = C.larg, nu = 6, nv = 40, pos = [], uv = [], idx = [];
    const side = V(C.n.z, 0, -C.n.x);
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const v = j / nv, u = i / nu, y = H0 - v * (H0 - WY + 0.5);
      const tt = Math.sqrt(Math.max(0, H0 - y) / 4.9), out = 2.4 * tt + 1.5;      // la nappe part en avant puis tombe
      const spread = 1 + v * 0.45;
      const p = C.p.clone().addScaledVector(side, (u - 0.5) * W * spread).addScaledVector(C.n, out); p.y = y;
      pos.push(p.x, p.y, p.z); uv.push(u, v);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    const m = new THREE.Mesh(g, mc); m.renderOrder = 3; scene.add(m);
    // l'eau qui arrive par la rigole
    const rg = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.95, 26, 1, 8), mc); rg.rotation.x = -Math.PI / 2 + 0.0; rg.rotation.order = "YXZ"; rg.rotation.y = Math.atan2(C.n.x, C.n.z) + Math.PI;
    rg.position.copy(C.p).addScaledVector(C.n, -12); rg.position.y = PLAT_Y + 0.85; rg.renderOrder = 3; scene.add(rg);
    brumes.push({ x: C.p.x + C.n.x * 9, z: C.p.z + C.n.z * 9, w: W });
  }
  // brume des cascades : des bouffées qui montent et s'effacent (une seule géométrie, animée par le shader)
  const NB = 120 * brumes.length, bg = new THREE.InstancedBufferGeometry(), q = new THREE.PlaneGeometry(1, 1);
  bg.setAttribute("position", q.attributes.position); bg.setAttribute("uv", q.attributes.uv); bg.setIndex(q.index); bg.instanceCount = NB;
  const r = rng(8), dat = new Float32Array(NB * 4), cen = new Float32Array(NB * 4);
  for (let i = 0; i < NB; i++) { const b = brumes[i % brumes.length]; cen[i * 4] = b.x; cen[i * 4 + 1] = 0; cen[i * 4 + 2] = b.z; cen[i * 4 + 3] = b.w; dat[i * 4] = r(); dat[i * 4 + 1] = r(); dat[i * 4 + 2] = r(); dat[i * 4 + 3] = r(); }
  bg.setAttribute("aC", new THREE.InstancedBufferAttribute(cen, 4)); bg.setAttribute("aD", new THREE.InstancedBufferAttribute(dat, 4));
  const bm = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uTime: G.uTime },
    vertexShader: `uniform float uTime; attribute vec4 aC, aD; varying vec2 vUv; varying float vA; varying vec3 vW;
      void main(){ float life = fract(uTime * (0.06 + 0.05 * aD.x) + aD.y); vec3 c = aC.xyz + vec3((aD.z - 0.5) * aC.w * 1.6, life * 22.0, (aD.w - 0.5) * aC.w * 1.4 + life * 6.0);
        float s = (4.0 + 10.0 * life) * (0.7 + 0.6 * aD.x); vA = smoothstep(0.0, 0.15, life) * smoothstep(1.0, 0.4, life); vUv = uv;
        vec3 cr = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), cu = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vW = c + (cr * position.x + cu * position.y) * s; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }`,
    fragmentShader: `${GLSL_ATMO_SEUL} varying vec2 vUv; varying float vA; varying vec3 vW;
      void main(){ vec2 q = vUv - 0.5; float d = length(q) * 2.0; float n = vnoise(vUv * 4.0 + vA * 3.0); float a = smoothstep(1.0, 0.0, d) * smoothstep(0.25, 0.75, n * 0.7 + (1.0 - d) * 0.5) * vA * 0.16;
        gl_FragColor = vec4(hazeApply(vec3(1.05, 1.07, 1.1) * (0.85 + 0.25 * max(SUN_DIR.y, 0.0)), vW, cameraPosition), a); }` });
  const brume = new THREE.Mesh(bg, bm); brume.frustumCulled = false; brume.renderOrder = 4; brume.layers.set(1); scene.add(brume);

  return { lac, simple, uDrag, mettreQualite(q) { lac.visible = q !== "rapide"; simple.visible = q === "rapide"; } };
}
