// Chaîne de rendu : scène HDR (multi-échantillons) -> ombre de contact (AO, demi-taille) -> halo (bloom, 4 étages)
// -> rayons du soleil (quart de taille) -> étalonnage (ACES, saturation, ombres bleutées / lumières ambrées, courbe en S, vignette, grain).
import * as THREE from "three";
import { SUN, SUN_COL } from "./commun.js";

export const Post = (() => {
  let R, W = 0, H = 0, rtMain, rtFx, rtAO, rtAO2, rtGod, rtGod2, blooms = [], msaa = 4, aoOn = true, raysOn = true;
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const quad = new THREE.Mesh(g, null); quad.frustumCulled = false; const qs = new THREE.Scene(); qs.add(quad); const qc = new THREE.Camera();
  const VS = "varying vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }";
  const mk = (fs, uniforms) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false });
  const cu = { tDepth: { value: null }, uNear: { value: 0.3 }, uFar: { value: 6000 }, uIP: { value: new THREE.Vector2() } };
  const DEPTH = `uniform sampler2D tDepth; uniform float uNear, uFar; uniform vec2 uIP;
    float vz(float d){ return (uNear * uFar) / ((uFar - uNear) * d - uFar); }
    vec3 vpos(vec2 uv){ float z = vz(texture2D(tDepth, uv).x); return vec3((uv * 2.0 - 1.0) * uIP * -z, z); }`;

  // ombre de contact : 12 échantillons en spirale dans un disque dont la taille grandit avec la distance
  const mAO = mk(`${DEPTH} uniform vec2 uTexel; varying vec2 vUv;
    void main(){
      float d0 = texture2D(tDepth, vUv).x; if (d0 >= 0.99999) { gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); return; }
      vec3 p = vpos(vUv);
      vec3 px1 = vpos(vUv + vec2(uTexel.x, 0.0)), px0 = vpos(vUv - vec2(uTexel.x, 0.0)), py1 = vpos(vUv + vec2(0.0, uTexel.y)), py0 = vpos(vUv - vec2(0.0, uTexel.y));
      vec3 dx = abs(px1.z - p.z) < abs(p.z - px0.z) ? px1 - p : p - px0, dy = abs(py1.z - p.z) < abs(p.z - py0.z) ? py1 - p : p - py0;
      vec3 n = normalize(cross(dx, dy));
      float rw = clamp(-p.z * 0.03, 0.35, 4.5), rs = rw / (-p.z * uIP.y) * 0.5;
      float ang = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) * 6.2831853, occ = 0.0;
      for (int i = 0; i < 12; i++) {
        float fi = (float(i) + 0.5) / 12.0, a = ang + fi * 6.2831853 * 3.7, r = rs * sqrt(fi);
        vec2 o = vec2(cos(a), sin(a)) * r * vec2(uIP.y / uIP.x, 1.0);
        vec3 v = vpos(vUv + o) - p; float l2 = dot(v, v);
        occ += max(dot(v, n) - 0.0004 * p.z * p.z * 0.0 - 0.03, 0.0) / (l2 + 0.02) * smoothstep(rw * rw * 2.5, rw * rw * 0.6, l2);
      }
      float ao = clamp(1.0 - occ * (2.0 / 12.0) * rw * 0.8, 0.0, 1.0);
      ao = mix(ao, 1.0, smoothstep(160.0, 420.0, -p.z));
      gl_FragColor = vec4(ao, 1.0 - d0, 0.0, 1.0); }`, { ...cu, uTexel: { value: new THREE.Vector2() } });
  const mAOBlur = mk(`uniform sampler2D tA; uniform vec2 uDir; varying vec2 vUv;
    void main(){ vec2 c = texture2D(tA, vUv).xy; float s = c.x * 0.30, w = 0.30;
      for (int i = 1; i <= 3; i++) for (int k = -1; k <= 1; k += 2) { vec2 q = texture2D(tA, vUv + uDir * float(i * k) * 1.35).xy;
        float ww = (i == 1 ? 0.22 : i == 2 ? 0.10 : 0.03) * step(abs(q.y - c.y), 0.035 * c.y + 1e-7); s += q.x * ww; w += ww; }
      gl_FragColor = vec4(s / w, c.y, 0.0, 1.0); }`, { tA: { value: null }, uDir: { value: new THREE.Vector2() } });
  const mCopy = mk(`uniform sampler2D tC, tA; uniform float uAO; varying vec2 vUv;
    void main(){ vec3 c = texture2D(tC, vUv).rgb; float ao = uAO > 0.0 ? texture2D(tA, vUv).x : 1.0; c *= mix(1.0, ao, uAO); gl_FragColor = vec4(min(c, vec3(200.0)), 1.0); }`,
    { tC: { value: null }, tA: { value: null }, uAO: { value: 0.85 } });
  // halo : on descend en atténuant les points trop brillants (pas de lucioles), puis on remonte en mélangeant
  const mDown = mk(`uniform sampler2D tC; uniform vec2 uT; varying vec2 vUv;
    vec3 S(vec2 o){ return texture2D(tC, vUv + o * uT).rgb; } float kw(vec3 c){ return 1.0 / (1.0 + max(c.r, max(c.g, c.b))); }
    void main(){ vec3 a = S(vec2(-1, 1)), b = S(vec2(1, 1)), c = S(vec2(-1, -1)), d = S(vec2(1, -1));
      float wa = kw(a), wb = kw(b), wc = kw(c), wd = kw(d);
      gl_FragColor = vec4(max((a * wa + b * wb + c * wc + d * wd) / (wa + wb + wc + wd), vec3(0.0)), 1.0); }`, { tC: { value: null }, uT: { value: new THREE.Vector2() } });
  const mUp = mk(`uniform sampler2D tC, tB; uniform vec2 uT; uniform float uMix; varying vec2 vUv;
    void main(){ vec3 s = vec3(0.0);
      s += texture2D(tC, vUv + vec2(-1, 1) * uT).rgb + texture2D(tC, vUv + vec2(1, 1) * uT).rgb + texture2D(tC, vUv + vec2(-1, -1) * uT).rgb + texture2D(tC, vUv + vec2(1, -1) * uT).rgb;
      s += 2.0 * (texture2D(tC, vUv + vec2(0, 1) * uT).rgb + texture2D(tC, vUv + vec2(0, -1) * uT).rgb + texture2D(tC, vUv + vec2(1, 0) * uT).rgb + texture2D(tC, vUv + vec2(-1, 0) * uT).rgb);
      s += 4.0 * texture2D(tC, vUv).rgb; s /= 16.0;
      gl_FragColor = vec4(mix(texture2D(tB, vUv).rgb, s, uMix), 1.0); }`, { tC: { value: null }, tB: { value: null }, uT: { value: new THREE.Vector2() }, uMix: { value: 0.6 } });
  // rayons : le ciel brillant près du soleil, étiré vers le soleil en trois passes
  const mGodMask = mk(`uniform sampler2D tC, tDepth; uniform vec2 uSun; uniform float uAsp; varying vec2 vUv;
    void main(){ float d = texture2D(tDepth, vUv).x; vec3 c = texture2D(tC, vUv).rgb; float l = dot(c, vec3(0.3, 0.5, 0.2));
      vec2 q = (vUv - uSun) * vec2(uAsp, 1.0); float near = exp(-dot(q, q) * 2.2);
      gl_FragColor = vec4(c * step(0.99999, d) * near * smoothstep(0.8, 2.6, l), 1.0); }`, { tC: { value: null }, tDepth: cu.tDepth, uSun: { value: new THREE.Vector2() }, uAsp: { value: 1 } });
  const mGodBlur = mk(`uniform sampler2D tC; uniform vec2 uSun; uniform float uLen; varying vec2 vUv;
    void main(){ vec2 dir = (uSun - vUv) * uLen; vec3 s = vec3(0.0); float w = 0.0;
      for (int i = 0; i < 8; i++) { float f = (float(i) + 0.5) / 8.0; vec2 u = vUv + dir * f; float inb = step(0.0, u.x) * step(u.x, 1.0) * step(0.0, u.y) * step(u.y, 1.0);
        float ww = 1.0 - f * 0.35; s += texture2D(tC, u).rgb * ww * inb; w += ww; }
      gl_FragColor = vec4(s / w, 1.0); }`, { tC: { value: null }, uSun: { value: new THREE.Vector2() }, uLen: { value: 1 } });
  const fin = { tC: { value: null }, tB: { value: null }, tG: { value: null }, uBloom: { value: 0.08 }, uGod: { value: 0.0 }, uExp: { value: 1.0 }, uFade: { value: 1 }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2() }, uHit: { value: 0 } };
  const mFinal = mk(`uniform sampler2D tC, tB, tG; uniform float uBloom, uGod, uExp, uFade, uTime, uHit; uniform vec2 uRes; varying vec2 vUv;
    vec3 fit(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
    vec3 aces(vec3 c){
      const mat3 I = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
      const mat3 O = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
      c = I * (c / 0.6); c = fit(c); return clamp(O * c, 0.0, 1.0); }
    void main(){
      vec2 uv = vUv, q = uv - 0.5; float r2 = dot(q, q);
      vec2 ca = q * r2 * (0.005 + 0.02 * uHit);
      vec3 c = vec3(texture2D(tC, uv - ca).r, texture2D(tC, uv).g, texture2D(tC, uv + ca).b);
      vec3 b = texture2D(tB, uv).rgb, g = uGod > 0.0 ? texture2D(tG, uv).rgb : vec3(0.0);
      c = max(mix(c, b, uBloom) + g * uGod * vec3(1.0, 0.76, 0.50), 0.0);
      c *= uExp * (1.0 - 0.38 * smoothstep(0.10, 0.75, r2 * 1.25));
      c = aces(c);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, 1.10);
      c += vec3(-0.004, 0.002, 0.014) * (1.0 - l) + vec3(0.016, 0.006, -0.012) * l;
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.40);
      c = pow(max(c, 0.0), vec3(1.0 / 2.2));
      float n = fract(sin(dot(gl_FragCoord.xy + fract(uTime) * 91.7, vec2(12.9898, 78.233))) * 43758.5453);
      c += (n - 0.5) * 0.016;
      gl_FragColor = vec4(c * uFade, 1.0); }`, fin);

  const BLV = 4;
  function size(w, h, ms) {
    if (w === W && h === H && ms === msaa) return; W = w; H = h; msaa = ms;
    for (const t of [rtMain, rtFx, rtAO, rtAO2, rtGod, rtGod2, ...blooms.flat()]) if (t) t.dispose();
    if (rtMain && rtMain.depthTexture) rtMain.depthTexture.dispose();
    const hf = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    const dt = new THREE.DepthTexture(W, H); dt.minFilter = dt.magFilter = THREE.NearestFilter;
    rtMain = new THREE.WebGLRenderTarget(W, H, { ...hf, samples: msaa, depthTexture: dt });
    rtFx = new THREE.WebGLRenderTarget(W, H, { ...hf, depthBuffer: false });
    const hw = Math.max(2, W >> 1), hh = Math.max(2, H >> 1);
    rtAO = new THREE.WebGLRenderTarget(hw, hh, { ...hf, depthBuffer: false }); rtAO2 = rtAO.clone();
    rtGod = new THREE.WebGLRenderTarget(Math.max(2, W >> 2), Math.max(2, H >> 2), { ...hf, depthBuffer: false }); rtGod2 = rtGod.clone();
    blooms = []; let bw = hw, bh = hh;
    for (let i = 0; i < BLV && bw > 8 && bh > 8; i++) { blooms.push([new THREE.WebGLRenderTarget(bw, bh, { ...hf, depthBuffer: false }), new THREE.WebGLRenderTarget(bw, bh, { ...hf, depthBuffer: false })]); bw >>= 1; bh >>= 1; }
    fin.uRes.value.set(W, H);
  }
  const run = (mat, target) => { quad.material = mat; R.setRenderTarget(target); R.render(qs, qc); };
  const sunV = new THREE.Vector3(), fwd = new THREE.Vector3();

  function render(scene, camera, o = {}) {
    cu.uNear.value = camera.near; cu.uFar.value = camera.far; cu.tDepth.value = rtMain.depthTexture;
    cu.uIP.value.set(1 / camera.projectionMatrix.elements[0], 1 / camera.projectionMatrix.elements[5]);
    R.setRenderTarget(rtMain); R.clear(); R.render(scene, camera);
    if (aoOn) {
      mAO.uniforms.uTexel.value.set(1 / rtAO.width, 1 / rtAO.height); run(mAO, rtAO);
      mAOBlur.uniforms.tA.value = rtAO.texture; mAOBlur.uniforms.uDir.value.set(1 / rtAO.width, 0); run(mAOBlur, rtAO2);
      mAOBlur.uniforms.tA.value = rtAO2.texture; mAOBlur.uniforms.uDir.value.set(0, 1 / rtAO.height); run(mAOBlur, rtAO);
    }
    mCopy.uniforms.tC.value = rtMain.texture; mCopy.uniforms.tA.value = rtAO.texture; mCopy.uniforms.uAO.value = aoOn ? 0.85 : 0; run(mCopy, rtFx);
    let src = rtFx.texture, sw = W, sh = H;
    for (let i = 0; i < blooms.length; i++) { const t = blooms[i][0]; mDown.uniforms.tC.value = src; mDown.uniforms.uT.value.set(1 / sw, 1 / sh); run(mDown, t); src = t.texture; sw = t.width; sh = t.height; }
    let up = blooms[blooms.length - 1][0];
    for (let i = blooms.length - 2; i >= 0; i--) { const t = blooms[i][1]; mUp.uniforms.tC.value = up.texture; mUp.uniforms.tB.value = blooms[i][0].texture; mUp.uniforms.uT.value.set(1 / up.width, 1 / up.height); mUp.uniforms.uMix.value = 0.62; run(mUp, t); up = t; }
    sunV.copy(camera.position).addScaledVector(SUN, 1000).project(camera);
    camera.getWorldDirection(fwd);
    const face = fwd.dot(SUN), sx = sunV.x * 0.5 + 0.5, sy = sunV.y * 0.5 + 0.5;
    if (raysOn && face > 0.2) {
      mGodMask.uniforms.tC.value = rtFx.texture; mGodMask.uniforms.uSun.value.set(sx, sy); mGodMask.uniforms.uAsp.value = W / H; run(mGodMask, rtGod);
      let a = rtGod, b = rtGod2;
      for (const len of [0.07, 0.22, 0.65]) { mGodBlur.uniforms.tC.value = a.texture; mGodBlur.uniforms.uSun.value.set(sx, sy); mGodBlur.uniforms.uLen.value = len; run(mGodBlur, b); [a, b] = [b, a]; }
      fin.tG.value = a.texture; fin.uGod.value = 0.35 * Math.min(1, (face - 0.2) * 3);
    } else { fin.tG.value = null; fin.uGod.value = 0; }
    fin.tC.value = rtFx.texture; fin.tB.value = up.texture; fin.uTime.value = performance.now() / 1000;
    fin.uExp.value = o.exposure ?? 1; fin.uFade.value = o.fade ?? 1; fin.uHit.value = o.hit ?? 0; fin.uBloom.value = o.bloom ?? 0.06;
    run(mFinal, null);
  }
  return {
    init(r) { R = r; }, size, render,
    set ao(v) { aoOn = v; }, set rays(v) { raysOn = v; },
    get W() { return W; }, get H() { return H; }, get depth() { return rtMain && rtMain.depthTexture; },
  };
})();
