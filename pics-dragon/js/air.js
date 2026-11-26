// L'air de la vallée : bancs de brume qui dérivent, feuilles d'érable qui tombent autour de soi, vols d'oiseaux, halos des lampions.
import * as THREE from "three";
import { GLSL_ATMO_SEUL, G, rng, V, TAU } from "./commun.js";
import { H, LAC, platD } from "./monde.js";
import { LAMPIONS } from "./archi.js";

export function construireAir(scene) {
  const r = rng(321);
  // ---- brume : grands panneaux doux, tournés vers la caméra, effacés de près ----
  const NB = 34, g = new THREE.InstancedBufferGeometry(), q = new THREE.PlaneGeometry(1, 1);
  g.setAttribute("position", q.attributes.position); g.setAttribute("uv", q.attributes.uv); g.setIndex(q.index); g.instanceCount = NB;
  const a = new Float32Array(NB * 4), b = new Float32Array(NB * 4);
  for (let i = 0; i < NB; i++) { const an = r() * TAU, rr = 60 + r() * 520, x = LAC.x + Math.cos(an) * rr, z = LAC.z - 80 + Math.sin(an) * rr;
    const y = Math.max(H(x, z), 0) + 4 + r() * (platD(x, z) < 0 ? 10 : 22); a.set([x, y, z, 120 + r() * 160], i * 4); b.set([r(), r(), 25 + r() * 25, 0.06 + r() * 0.08], i * 4); }
  g.setAttribute("aP", new THREE.InstancedBufferAttribute(a, 4)); g.setAttribute("aQ", new THREE.InstancedBufferAttribute(b, 4));
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uTime: G.uTime },
    vertexShader: `uniform float uTime; attribute vec4 aP, aQ; varying vec2 vUv; varying vec3 vW; varying float vA, vS;
      void main(){ vec3 c = aP.xyz + vec3(sin(uTime * 0.01 + aQ.x * 6.0) * 30.0 - uTime * 0.6 * 0.0, 0.0, cos(uTime * 0.013 + aQ.y * 6.0) * 20.0);
        vec3 toC = cameraPosition - c; float d = length(toC); vec3 f = normalize(vec3(toC.x, 0.0, toC.z)), rt = normalize(cross(vec3(0.0, 1.0, 0.0), f));
        vW = c + rt * position.x * aP.w + vec3(0.0, 1.0, 0.0) * position.y * aQ.z; vUv = uv; vS = aQ.x;
        vA = aQ.w * smoothstep(30.0, 140.0, d) * smoothstep(2200.0, 900.0, d);
        gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }`,
    fragmentShader: `${GLSL_ATMO_SEUL} varying vec2 vUv; varying vec3 vW; varying float vA, vS;
      void main(){ float n = fbm2(vUv * vec2(3.0, 1.5) + vS * 10.0 + vec2(uTime * 0.01, 0.0));
        float a = smoothstep(0.0, 0.3, vUv.x) * smoothstep(1.0, 0.7, vUv.x) * smoothstep(0.0, 0.45, vUv.y) * smoothstep(1.0, 0.5, vUv.y) * smoothstep(0.3, 0.75, n);
        vec3 c = hazeCol(normalize(vW - cameraPosition)) * 1.05 + vec3(0.06, 0.05, 0.04) * cloudShade(vW);
        gl_FragColor = vec4(c, a * vA); }` });
  const brume = new THREE.Mesh(g, m); brume.frustumCulled = false; brume.layers.set(1); brume.renderOrder = 6; scene.add(brume);

  // ---- feuilles qui tombent (une boîte de 120 m qui suit la caméra ; jamais collées à l'œil) ----
  const NF = 1600, fg = new THREE.InstancedBufferGeometry(), fq = new THREE.PlaneGeometry(0.32, 0.32);
  fg.setAttribute("position", fq.attributes.position); fg.setAttribute("uv", fq.attributes.uv); fg.setIndex(fq.index); fg.instanceCount = NF;
  const fd = new Float32Array(NF * 4); for (let i = 0; i < NF * 4; i++) fd[i] = r();
  fg.setAttribute("aD", new THREE.InstancedBufferAttribute(fd, 4));
  const fm = new THREE.ShaderMaterial({ side: THREE.DoubleSide, uniforms: { uTime: G.uTime, uCam: { value: V() } },
    vertexShader: `uniform float uTime; uniform vec3 uCam; attribute vec4 aD; varying vec2 vUv; varying float vH; varying vec3 vN, vW;
      void main(){ float B = 120.0; vec3 p = aD.xyz * B + vec3(-uTime * (1.2 + aD.w), -uTime * (1.1 + aD.w * 0.8), sin(uTime * 0.3 + aD.x * 9.0) * 3.0);
        p = mod(p - uCam + B * 0.5, B) + uCam - B * 0.5;
        float a = uTime * (2.0 + 3.0 * aD.w) + aD.x * 30.0, b = uTime * 1.3 + aD.y * 20.0;
        mat3 R = mat3(cos(a), sin(a), 0.0, -sin(a), cos(a), 0.0, 0.0, 0.0, 1.0) * mat3(1.0, 0.0, 0.0, 0.0, cos(b), sin(b), 0.0, -sin(b), cos(b));
        vN = R * vec3(0.0, 0.0, 1.0); vec3 wp = p + R * position * (step(1.5, length(p - uCam)));
        vUv = uv; vH = aD.z; vW = wp; gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0); }`,
    fragmentShader: `varying vec2 vUv; varying float vH; varying vec3 vN, vW;
      void main(){ vec2 q = (vUv - 0.5) * 2.0; float a = atan(q.x, q.y), r = length(q); float lobes = 0.62 + 0.3 * pow(abs(cos(a * 2.5)), 0.6);
        if (r > lobes) discard;
        vec3 c = mix(vec3(0.62, 0.035, 0.02), vec3(0.85, 0.36, 0.04), vH); c *= 0.8 + 0.6 * abs(dot(normalize(vN), vec3(-0.46, 0.56, -0.69)));
        gl_FragColor = vec4(c * 1.6, 1.0); }` });
  const feuilles = new THREE.Mesh(fg, fm); feuilles.frustumCulled = false; feuilles.layers.set(1); scene.add(feuilles);

  // ---- oiseaux : quelques vols qui tournent haut dans la vallée ----
  const NO = 60, og = new THREE.InstancedBufferGeometry();
  const op = new Float32Array([0, 0, 0.3, -0.9, 0.05, -0.2, 0, 0, -0.3, 0, 0, 0.3, 0.9, 0.05, -0.2, 0, 0, -0.3]);
  og.setAttribute("position", new THREE.BufferAttribute(op, 3)); og.instanceCount = NO;
  const od = new Float32Array(NO * 4); for (let i = 0; i < NO; i++) od.set([Math.floor(i / 12), r(), r(), r()], i * 4);
  og.setAttribute("aD", new THREE.InstancedBufferAttribute(od, 4));
  const om = new THREE.ShaderMaterial({ side: THREE.DoubleSide, uniforms: { uTime: G.uTime },
    vertexShader: `uniform float uTime; attribute vec4 aD; void main(){ float g = aD.x, t = uTime * (0.05 + g * 0.007) + g * 1.7;
        vec3 c = vec3(${LAC.x.toFixed(1)} + cos(t) * (180.0 + g * 60.0), 90.0 + g * 25.0 + sin(t * 2.0) * 15.0, ${LAC.z.toFixed(1)} - 60.0 + sin(t) * (160.0 + g * 40.0));
        vec3 dir = normalize(vec3(-sin(t), 0.0, cos(t))), side = cross(vec3(0.0, 1.0, 0.0), dir);
        vec3 off = (aD.yzw - 0.5) * vec3(14.0, 5.0, 14.0); float flap = sin(uTime * 9.0 + aD.y * 20.0) * 0.7;
        vec3 p = position * 1.2; p.y += abs(p.x) * flap;
        vec3 wp = c + off + side * p.x + vec3(0.0, p.y, 0.0) + dir * p.z * -1.0;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0); }`,
    fragmentShader: `void main(){ gl_FragColor = vec4(0.03, 0.025, 0.025, 1.0); }` });
  const oiseaux = new THREE.Mesh(og, om); oiseaux.frustumCulled = false; oiseaux.layers.set(1); scene.add(oiseaux);

  // ---- halos des lampions ----
  const NL = LAMPIONS.length, lg = new THREE.InstancedBufferGeometry();
  lg.setAttribute("position", q.attributes.position); lg.setAttribute("uv", q.attributes.uv); lg.setIndex(q.index); lg.instanceCount = NL;
  const lp = new Float32Array(NL * 4); LAMPIONS.forEach((p, i) => lp.set([p.x, p.y, p.z, r()], i * 4));
  lg.setAttribute("aP", new THREE.InstancedBufferAttribute(lp, 4));
  const lm = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: G.uTime },
    vertexShader: `uniform float uTime; attribute vec4 aP; varying vec2 vUv; varying float vK;
      void main(){ vec3 cr = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), cu = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        float d = length(cameraPosition - aP.xyz); float s = 3.2 + d * 0.012; vK = (0.85 + 0.15 * sin(uTime * 3.0 + aP.w * 20.0)) * smoothstep(900.0, 200.0, d);
        vUv = uv; gl_Position = projectionMatrix * viewMatrix * vec4(aP.xyz + (cr * position.x + cu * position.y) * s, 1.0); }`,
    fragmentShader: `varying vec2 vUv; varying float vK; void main(){ float d = length(vUv - 0.5) * 2.0; float a = exp(-d * d * 5.0) * smoothstep(1.0, 0.6, d); gl_FragColor = vec4(vec3(1.4, 0.55, 0.18) * a * vK * 0.5, 1.0); }` });
  const halos = new THREE.Mesh(lg, lm); halos.frustumCulled = false; halos.layers.set(1); halos.renderOrder = 7; scene.add(halos);

  return { maj(cam) { fm.uniforms.uCam.value.copy(cam.position); } };
}
