// The sky: a painted sunrise dome (gradient, sun halo, brushed pink clouds, misty mountain line)
// plus a few flocks of far birds. Everything is drawn in one shader on a big sphere that follows the camera.
import * as THREE from "three";
import { CONFIG } from "./config.js";
import { GLSL_NOISE, SHARED, SUN_DIR, col, rng, TAU } from "./commun.js";

export function createSky(scene) {
  const S = CONFIG.sky;
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uTime: SHARED.uTime, uSun: { value: SUN_DIR },
      uZen: { value: col(S.zenith) }, uMid: { value: col(S.mid) }, uHor: { value: col(S.horizon) }, uGlow: { value: col(S.sunGlow) },
      uCL: { value: col(S.cloudLight) }, uCS: { value: col(S.cloudShade) }, uBand: { value: new THREE.Vector2(...S.cloudBand) },
      uRidge: { value: col(S.ridge) }, uAlt: { value: 0 },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */`
      ${GLSL_NOISE}
      uniform float uTime, uAlt; uniform vec3 uSun, uZen, uMid, uHor, uGlow, uCL, uCS, uRidge; uniform vec2 uBand;
      varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float e = d.y;                                       // elevation (-1..1)
        float sunD = max(dot(d, uSun), 0.0);
        // base gradient
        vec3 c = mix(uHor, uMid, smoothstep(-0.02, 0.22, e));
        c = mix(c, uZen, smoothstep(0.18, 0.75, e));
        c = mix(c, uHor * 1.04, pow(sunD, 3.0) * 0.55 * (1.0 - smoothstep(0.0, 0.6, e)));
        // brushed streak clouds (stretched horizontally, layered painted edges)
        vec2 q = vec2(atan(d.z, d.x) * 3.0, e * 14.0);
        float band = smoothstep(uBand.x, uBand.x + 0.06, e) * (1.0 - smoothstep(uBand.y - 0.12, uBand.y, e));
        float n = fbm2(vec2(q.x * 1.6 + uTime * 0.004, q.y * 0.9)) + 0.35 * fbm2(q * vec2(5.0, 2.0));
        float cl = smoothstep(0.62, 0.68, n) * band;
        float top = smoothstep(0.62, 0.9, fbm2(vec2(q.x * 1.6 + uTime * 0.004, q.y * 0.9 + 0.12)));
        vec3 cloud = mix(uCS, uCL, clamp(top * 1.6 + pow(sunD, 4.0) * 0.6, 0.0, 1.0));
        cloud *= 0.94 + 0.12 * vnoise(q * vec2(14.0, 30.0));   // brush texture
        c = mix(c, cloud, cl * 0.92);
        // misty mountain ridge on the horizon (fades out when you fly high)
        float ridgeH = 0.025 + 0.035 * fbm2(vec2(atan(d.z, d.x) * 4.0, 1.3)) - uAlt * 0.00006;
        float ridge = (1.0 - smoothstep(ridgeH - 0.004, ridgeH + 0.004, e)) * smoothstep(-0.15, 0.0, e);
        c = mix(c, mix(uRidge, uHor, 0.45), ridge * 0.6);
        // below horizon: warm haze (hidden by the world most of the time)
        c = mix(c, uHor * 0.95, smoothstep(0.0, -0.08, e));
        // sun disc + halo (HDR so it blooms)
        c += uGlow * (pow(sunD, 600.0) * 6.0 + pow(sunD, 40.0) * 0.6 + pow(sunD, 6.0) * 0.18);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(5000, 48, 24), mat);
  dome.frustumCulled = false; dome.renderOrder = -10;
  scene.add(dome);

  // ---- far bird flocks (tiny "v" strokes drifting) ----
  const birds = new THREE.Group();
  const r = rng(77);
  const vGeo = new THREE.BufferGeometry();
  vGeo.setAttribute("position", new THREE.Float32BufferAttribute([-1, 0.35, 0, 0, 0, 0, 0, 0, 0, 1, 0.35, 0, -1, 0.35, 0.01, 0, -0.08, 0, 1, 0.35, 0.01, 0, -0.08, 0], 3));
  vGeo.setIndex([0, 1, 5, 2, 3, 6]);
  const bMat = new THREE.MeshBasicMaterial({ color: "#4a3b3a", side: THREE.DoubleSide, transparent: true, opacity: 0.75, fog: false });
  const flocks = [];
  for (let f = 0; f < 4; f++) {
    const g = new THREE.Group();
    const n = 6 + Math.floor(r() * 7);
    for (let i = 0; i < n; i++) {
      const b = new THREE.Mesh(vGeo, bMat);
      b.position.set((r() - 0.5) * 60, (r() - 0.5) * 18, (r() - 0.5) * 30);
      b.scale.setScalar(2.2 + r()); b.userData.ph = r() * TAU;
      g.add(b);
    }
    g.userData = { a: r() * TAU, rad: 900 + r() * 500, h: 260 + r() * 200, sp: 0.01 + r() * 0.012 };
    flocks.push(g); birds.add(g);
  }
  scene.add(birds);

  return {
    update(dt, camera) {
      dome.position.copy(camera.position);
      mat.uniforms.uAlt.value = camera.position.y;
      const t = SHARED.uTime.value;
      for (const g of flocks) {
        const u = g.userData; u.a += u.sp * dt;
        g.position.set(camera.position.x * 0.6 + Math.cos(u.a) * u.rad, u.h, camera.position.z * 0.6 + Math.sin(u.a) * u.rad);
        g.rotation.y = -u.a;
        for (const b of g.children) b.scale.y = (2.2 + Math.sin(t * 6 + b.userData.ph)) * 0.8;
      }
    },
  };
}
