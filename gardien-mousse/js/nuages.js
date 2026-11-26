// The sea of clouds above the forest. Thousands of puffy blobs, drawn in one call.
// They wrap around the camera (infinite sea) and "condense" as you climb, so the forest sky stays clear from below.
import * as THREE from "three";
import { CONFIG } from "./config.js";
import { SHARED, GLSL_NOISE, SUN_DIR, blobGeometry, rng, col } from "./commun.js";

export function createClouds(scene) {
  const C = CONFIG.clouds;
  const base = blobGeometry(2, 0.22, 8);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index; geo.attributes.position = base.attributes.position; geo.attributes.normal = base.attributes.normal;
  const r = rng(404), N = C.puffs, off = new Float32Array(N * 4);
  // clustered placement: puffs gather into big cloud masses with gaps between them
  const centers = Array.from({ length: 90 }, () => [(r() - 0.5) * C.area, (r() - 0.5) * C.area, 60 + r() * 140]);
  for (let i = 0; i < N; i++) {
    const c = centers[Math.floor(r() * centers.length)], a = r() * Math.PI * 2, d = Math.sqrt(r()) * c[2];
    off.set([c[0] + Math.cos(a) * d, c[1] + Math.sin(a) * d, 0, r()], i * 4);
    off[i * 4 + 2] = (1 - d / c[2]) * 0.8 + 0.4;          // bigger puffs in the middle of a mass
  }
  geo.setAttribute("aOff", new THREE.InstancedBufferAttribute(off, 4));
  geo.instanceCount = N;

  const mat = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uSun: { value: SUN_DIR }, uCond: { value: 0 },
      uTop: { value: col(C.top) }, uSide: { value: col(C.side) }, uUnder: { value: col(C.under) },
    }]),
    vertexShader: /* glsl */`
      #include <fog_pars_vertex>
      attribute vec4 aOff; uniform vec3 uCam; uniform float uTime, uCond; varying vec3 vN; varying vec3 vW; varying float vR;
      void main(){
        float area = ${C.area.toFixed(1)};
        vec2 p = aOff.xy + vec2(uTime * 1.5, uTime * 0.6);
        p = uCam.xz + mod(p - uCam.xz + area * 0.5, area) - area * 0.5;
        float edge = 1.0 - smoothstep(area * 0.38, area * 0.5, length(p - uCam.xz));
        float s = (14.0 + 22.0 * aOff.z) * uCond * edge;
        vec3 q = position * vec3(s, s * 0.78, s);
        vec3 w = vec3(p.x, ${C.altitude.toFixed(1)} + aOff.w * ${C.thickness.toFixed(1)} + aOff.z * 10.0, p.y) + q;
        w.y -= (1.0 - uCond) * 40.0;
        vN = normal; vW = w; vR = aOff.w;
        vec4 mvPosition = viewMatrix * vec4(w, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <fog_pars_fragment>
      ${GLSL_NOISE}
      uniform vec3 uSun, uTop, uSide, uUnder; varying vec3 vN; varying vec3 vW; varying float vR;
      void main(){
        vec3 n = normalize(vN);
        float l = dot(n, uSun) * 0.5 + 0.5 + (fbm3(vW * 0.05) - 0.5) * 0.35;
        // painted bands: lilac underside, peach side, cream top
        vec3 c = mix(uUnder, uSide, smoothstep(0.30, 0.36, l + n.y * 0.3));
        c = mix(c, uTop, smoothstep(0.52, 0.58, l * 0.7 + n.y * 0.45));
        c *= 0.95 + 0.1 * vnoise3(vW * 0.3);
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false;
  scene.add(mesh);

  return {
    update(dt, camera) {
      mat.uniforms.uTime.value = SHARED.uTime.value;
      mat.uniforms.uCam.value.copy(camera.position);
      const a = C.appearFrom;
      const k = Math.min(Math.max((camera.position.y - a) / 70, 0), 1);
      mat.uniforms.uCond.value = k * k * (3 - 2 * k);
      mesh.visible = k > 0.001;
    },
  };
}
