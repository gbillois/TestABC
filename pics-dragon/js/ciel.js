// Le ciel : dégradé bleu, soleil, et des tours de cumulus calculées UNE fois au chargement (lancer de rayons dans un
// champ de densité, lumière du soleil à travers le nuage, ciel et sol qui l'éclairent), rangées dans une image
// « équirectangulaire » vue depuis le centre de la vallée. À l'affichage, le ciel lit cette image et la fait dériver.
import * as THREE from "three";
import { GLSL_ATMO_SEUL, rng, attendre, Q, G } from "./commun.js";

const TOURS = 12;
export const Ciel = (() => {
  let rt = null, mesh = null;
  const r = rng(4242);
  // tours : position (x, z), rayon de base, hauteur ; puis base (y), penchée (x, z), graine
  const A = [], B = [];
  const place = (az, dist, rb, h, y0) => { const a = az * Math.PI / 180; A.push(new THREE.Vector4(Math.sin(a) * dist, -Math.cos(a) * dist, rb, h)); B.push(new THREE.Vector4(y0, (r() - .3) * 0.5, (r() - .5) * 0.3, r() * 100)); };
  // az : degrés depuis le nord (-z) vers l'est (+x)
  place(-38, 3600, 820, 2500, 300);   // derrière les pics, à contre-jour
  place(12, 4300, 900, 2900, 350);
  place(58, 3300, 700, 2100, 280);
  place(105, 3900, 760, 2300, 300);
  place(150, 3000, 620, 1700, 260);
  place(196, 3500, 800, 2600, 320);
  place(238, 3100, 640, 1900, 260);
  place(285, 3800, 780, 2400, 320);
  place(325, 2900, 560, 1500, 240);
  place(80, 6500, 1100, 3200, 400);
  place(220, 6800, 1200, 3400, 420);
  place(0, 7200, 1000, 2600, 400);

  const BAKE = `${GLSL_ATMO_SEUL}
    uniform vec4 uA[${TOURS}], uB[${TOURS}]; uniform vec2 uRes; varying vec2 vUv;
    const vec3 O = vec3(0.0, 120.0, 0.0);
    float billow(vec3 p){ float s = 0.0, a = 0.55; for (int i = 0; i < 4; i++){ s += a * (1.0 - abs(vnoise3(p) * 2.0 - 1.0)); p = p * 2.1 + vec3(3.1, 1.7, 5.3); a *= 0.48; } return s; }
    // densité d'une tour au point p (0 dehors)
    float tour(int i, vec3 p){
      vec4 a = uA[i], b = uB[i]; float h = (p.y - b.x) / a.w; if (h < -0.02 || h > 1.05) return 0.0;
      vec2 c = a.xy + vec2(b.y, b.z) * h * a.w * 0.5;
      float prof = (0.78 + 0.30 * sin(h * 7.0 + b.w) * h + 0.25 * sin(h * 3.1 + b.w * 2.0)) * (1.0 - 0.62 * pow(h, 1.6));
      prof *= mix(0.85, 1.0, smoothstep(0.0, 0.12, h));                                      // base plate un peu rentrée
      float top = smoothstep(1.05, 0.80, h);
      float d = length(p.xz - c) / (a.z * prof);
      float shape = (1.0 - d) * top;
      float n = billow(p * (1.0 / 230.0) + b.w);
      float n2 = billow(p * (1.0 / 70.0) + b.w * 1.7);
      float base = smoothstep(-0.02, 0.06, h);
      return clamp((shape + (n - 0.62) * 0.95 + (n2 - 0.6) * 0.25) * 3.2, 0.0, 1.0) * base;
    }
    float dens(vec3 p, int i){ return tour(i, p); }
    // petits cumulus épars : une couche de bouffées aplaties
    float couche(vec3 p){
      if (p.y < 850.0 || p.y > 1500.0) return 0.0;
      vec2 cell = floor(p.xz / 900.0), f = p.xz / 900.0 - cell; float s = 0.0;
      for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
        vec2 c = cell + vec2(i, j); vec2 rr = hash22(c); if (rr.x < 0.45) continue;
        vec2 cc = (c + 0.25 + 0.5 * rr) * 900.0; float rad = 160.0 + 220.0 * rr.y;
        vec3 q = (p - vec3(cc.x, 1000.0 + 120.0 * rr.x, cc.y)) / vec3(rad, rad * 0.55, rad);
        s = max(s, 1.0 - length(q)); }
      float n = billow(p / 120.0);
      return clamp((s + (n - 0.6) * 0.7) * 3.0, 0.0, 1.0) * smoothstep(850.0, 950.0, p.y);
    }
    vec2 boite(int i, vec3 ro, vec3 rd){
      vec4 a = uA[i], b = uB[i]; vec2 c = a.xy + vec2(b.y, b.z) * a.w * 0.25; float R = a.z * 1.35 + length(vec2(b.y, b.z)) * a.w * 0.3;
      vec2 o = ro.xz - c; float A2 = dot(rd.xz, rd.xz), B2 = dot(o, rd.xz), C2 = dot(o, o) - R * R, D = B2 * B2 - A2 * C2;
      if (D < 0.0 || A2 < 1e-6) return vec2(1e9, -1e9);
      float s = sqrt(D); vec2 t = vec2((-B2 - s) / A2, (-B2 + s) / A2);
      float y0 = b.x - 10.0, y1 = b.x + a.w * 1.06;
      vec2 ty = abs(rd.y) > 1e-5 ? vec2((y0 - ro.y) / rd.y, (y1 - ro.y) / rd.y) : vec2(-1e9, 1e9); if (ty.x > ty.y) ty = ty.yx;
      return vec2(max(max(t.x, ty.x), 0.0), min(t.y, ty.y));
    }
    float phase(float c){ float g1 = 0.75, g2 = -0.25; float a = (1.0 - g1 * g1) / pow(1.0 + g1 * g1 - 2.0 * g1 * c, 1.5), b = (1.0 - g2 * g2) / pow(1.0 + g2 * g2 - 2.0 * g2 * c, 1.5); return mix(b, a, 0.32) * 0.0796; }
    void marche(vec3 ro, vec3 rd, float t0, float t1, int which, inout vec3 col, inout float T){
      const int NS = 44; float dt = (t1 - t0) / float(NS), cth = dot(rd, SUN_DIR), ph = phase(cth);
      float jit = hash21(gl_FragCoord.xy + float(which) * 7.1);
      for (int s = 0; s < NS; s++){
        if (T < 0.01) break;
        float t = t0 + (float(s) + jit) * dt; vec3 p = ro + rd * t;
        float d = which < 0 ? couche(p) : dens(p, which); if (d <= 0.001) continue;
        float sig = d * 0.012;
        float L = 0.0; for (int k = 1; k <= 5; k++){ vec3 q = p + SUN_DIR * (float(k * k) * 22.0); L += (which < 0 ? couche(q) : dens(q, which)) * float(k * 2 - 1) * 22.0; }
        float Tl = exp(-L * 0.012), pow2 = 1.0 - exp(-d * 6.0);
        float h = clamp((p.y - (which < 0 ? 850.0 : uB[which].x)) / (which < 0 ? 600.0 : uA[which].w), 0.0, 1.0);
        vec3 amb = mix(vec3(0.34, 0.37, 0.44), vec3(0.62, 0.74, 0.92), h) * 0.9;
        vec3 Ls = SUN_C * 6.2 * Tl * (ph * 2.0 + 0.10) * mix(0.55, 1.0, pow2) + amb;
        Ls = mix(Ls, hazeCol(rd) * 1.05, 1.0 - exp(-t * 0.00011));
        float a = 1.0 - exp(-sig * dt);
        col += T * a * Ls; T *= 1.0 - a;
      }
    }
    void main(){
      float az = (vUv.x - 0.5) * 6.2831853, el = -0.08 + (1.5708 + 0.08) * pow(vUv.y, 1.7);
      vec3 rd = vec3(sin(az) * cos(el), sin(el), -cos(az) * cos(el));
      vec3 col = vec3(0.0); float T = 1.0;
      // les tours, de la plus proche à la plus lointaine
      vec2 iv[${TOURS}]; for (int i = 0; i < ${TOURS}; i++) iv[i] = boite(i, O, rd);
      for (int n = 0; n < ${TOURS}; n++){
        int best = -1; float bt = 1e8;
        for (int i = 0; i < ${TOURS}; i++) if (iv[i].x < iv[i].y && iv[i].x < bt) { bt = iv[i].x; best = i; }
        if (best < 0) break;
        for (int i = 0; i < ${TOURS}; i++) if (i == best) { marche(O, rd, iv[i].x, iv[i].y, i, col, T); iv[i] = vec2(1e9, -1e9); }
      }
      if (rd.y > 0.02 && T > 0.01){ float ta = (850.0 - O.y) / rd.y, tb = min((1500.0 - O.y) / rd.y, 11000.0); if (tb > ta) marche(O, rd, ta, tb, -1, col, T); }
      gl_FragColor = vec4(col, 1.0 - T);
    }`;

  async function cuire(R, qualite) {
    const W = +(Q.get("ciel") || (qualite === "rapide" ? 1024 : 2048)), H = Math.round(W * 0.34);
    rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
    rt.texture.wrapS = THREE.RepeatWrapping;
    const m = new THREE.ShaderMaterial({ vertexShader: "varying vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }", fragmentShader: BAKE,
      uniforms: { uA: { value: A }, uB: { value: B }, uRes: { value: new THREE.Vector2(W, H) }, uTime: { value: 0 } }, depthTest: false, depthWrite: false });
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const q = new THREE.Mesh(g, m); q.frustumCulled = false; const s = new THREE.Scene(); s.add(q); const c = new THREE.Camera();
    // en bandes, pour ne pas bloquer la carte graphique d'une tablette
    const BANDES = 12; R.setRenderTarget(rt); R.setScissorTest(true);
    for (let i = 0; i < BANDES; i++) {
      const y0 = Math.floor(i * H / BANDES), y1 = Math.floor((i + 1) * H / BANDES);
      rt.scissor.set(0, y0, W, y1 - y0); rt.viewport.set(0, 0, W, H); rt.scissorTest = true;
      R.setRenderTarget(rt); R.render(s, c);
      if (i % 3 === 2) { R.getContext().finish?.(); await attendre(); }
    }
    rt.scissorTest = false; R.setScissorTest(false); R.setRenderTarget(null);
    m.dispose(); g.dispose();
  }

  function faire() {
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { tC: { value: rt.texture }, uTime: G.uTime },
      vertexShader: "varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }",
      fragmentShader: `${GLSL_ATMO_SEUL} uniform sampler2D tC; varying vec3 vDir;
        void main(){
          vec3 d = normalize(vDir); vec3 col = skyBase(d);
          float s = max(dot(d, SUN_DIR), 0.0);
          col += SUN_C * (smoothstep(0.99955, 0.99975, s) * 40.0 + pow(s, 900.0) * 4.0 + pow(s, 60.0) * 0.18);
          // cirrus très haut
          if (d.y > 0.0){ vec2 p = d.xz / (d.y + 0.08); float c = fbm2(vec2(p.x * 0.9 + uTime * 0.003, p.y * 3.5) * 1.3); col += vec3(0.9, 0.92, 0.96) * smoothstep(0.55, 0.85, c) * 0.20 * smoothstep(0.02, 0.25, d.y); }
          if (d.y > -0.08){
            float az = atan(d.x, -d.z), el = asin(clamp(d.y, -1.0, 1.0));
            vec2 uv = vec2(az / 6.2831853 + 0.5 + uTime * 0.00025, pow(clamp((el + 0.08) / (1.5708 + 0.08), 0.0, 1.0), 1.0 / 1.7));
            vec4 cl = texture2D(tC, uv); col = col * (1.0 - cl.a) + cl.rgb;
          }
          gl_FragColor = vec4(col, 1.0);
        }`
    });
    mesh = new THREE.Mesh(new THREE.SphereGeometry(5000, 64, 32), m); mesh.frustumCulled = false; mesh.renderOrder = -10;
    return mesh;
  }
  return { cuire, faire, get rt() { return rt; } };
})();
