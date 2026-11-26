// The Moss Keeper: a big round robot overgrown with moss, flowers and a little tree.
// Built from simple shapes, rigged with a hierarchy of pivots, animated procedurally.
//
//   createKeeper(scene) -> keeper
//     keeper.root            Object3D placed on the ground (position + yaw are set by the game)
//     keeper.update(dt, s)   s = animation state (see ANIMATION STATE below)
//     keeper.points          world-space helpers: chest, feet, hands, fans (for effects and camera)
//
// To change the look: colours and moss amount are in config.js (CONFIG.robot).
// To change a pose: edit the POSES section, each pose is a list of joint angles in radians.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { MeshSurfaceSampler } from "three/addons/math/MeshSurfaceSampler.js";
import { CONFIG } from "./config.js";
import { paintMaterial, outlineMaterial, blobGeometry, canvasTexture, glowTexture, rng, col, damp, lerp, clamp, smooth, TAU, SHARED } from "./commun.js";

const R = CONFIG.robot;

// ======================================================================= materials
function makeMaterials() {
  const metal = paintMaterial({
    color: R.metal, brush: 0.4, rim: "#ffd59a",
    patches: [{ color: R.panel, scale: 0.42, threshold: 0.58 }, { color: R.teal, scale: 0.55, threshold: 0.63 }, { color: "#7b5a4a", scale: 1.9, threshold: 0.72 }],
  });
  return {
    metal,
    panel: paintMaterial({ color: R.panel, brush: 0.35, rim: "#ffd59a", patches: [{ color: R.metal, scale: 0.6, threshold: 0.62 }, { color: "#b9874f", scale: 1.6, threshold: 0.7 }] }),
    teal: paintMaterial({ color: R.teal, brush: 0.35, rim: "#ffe0a8", patches: [{ color: "#4f7f78", scale: 0.9, threshold: 0.6 }, { color: R.panel, scale: 0.7, threshold: 0.7 }] }),
    rust: paintMaterial({ color: R.rust, brush: 0.4, rim: "#ffc08a", patches: [{ color: "#7a2f22", scale: 1.2, threshold: 0.6 }] }),
    dark: paintMaterial({ color: R.dark, brush: 0.3 }),
    wood: paintMaterial({ color: "#6a4a33", brush: 0.5, patches: [{ color: "#3f2c22", scale: 1.5, threshold: 0.58 }] }),
    mossCoat: paintMaterial({
      color: R.moss[1], brush: 0.5, rim: "#f4e79a", rimPower: 2.0, mossCoat: true, coatAmount: 0.24 * R.mossDensity,
      patches: [{ color: R.moss[0], scale: 1.1, threshold: 0.58 }, { color: R.moss[2], scale: 1.4, threshold: 0.64 }],
    }),
    moss: paintMaterial({
      color: R.moss[1], brush: 0.55, rim: "#f4e79a", rimPower: 2.0,
      patches: [{ color: R.moss[0], scale: 1.3, threshold: 0.6 }, { color: R.moss[2], scale: 1.6, threshold: 0.62 }],
    }),
    leaf: paintMaterial({
      color: CONFIG.world.leaf[1], brush: 0.45, rim: "#ffe3a0", rimPower: 2.2,
      patches: [{ color: CONFIG.world.leaf[0], scale: 0.7, threshold: 0.6 }, { color: CONFIG.world.leaf[2], scale: 0.9, threshold: 0.62 }],
    }),
    flower: new THREE.MeshLambertMaterial({ vertexColors: false }),
    outline: outlineMaterial(),
  };
}

// ======================================================================= geometry helpers
const rbox = (w, h, d, r = 0.35) => new RoundedBoxGeometry(w, h, d, 3, r);
const ellipsoid = (sx, sy, sz, seg = 28) => { const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7)); g.scale(sx, sy, sz); return g; };
const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 6, 16);
const cyl = (r1, r2, h, seg = 20) => new THREE.CylinderGeometry(r1, r2, h, seg, 2);
const ring = (r, tube) => new THREE.TorusGeometry(r, tube, 10, 32);
function tube(points, radius) {
  const c = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(c, 24, radius, 10, false);
}

// small star flower geometry (5 petals) and grass tuft geometry, used on the moss
function flowerGeometry() {
  const p = [], idx = [];
  p.push(0, 0.02, 0);
  for (let k = 0; k < 10; k++) { const a = k / 10 * TAU, rr = k % 2 ? 0.18 : 0.5; p.push(Math.cos(a) * rr, 0, Math.sin(a) * rr); }
  for (let k = 0; k < 10; k++) idx.push(0, 1 + ((k + 1) % 10), 1 + k);
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function tuftGeometry() {
  const p = [], idx = []; const rr = rng(3);
  for (let b = 0; b < 7; b++) {
    const a = rr() * TAU, lean = 0.25 + rr() * 0.35, h = 0.7 + rr() * 0.7, i0 = p.length / 3;
    const dx = Math.cos(a), dz = Math.sin(a), w = 0.07;
    p.push(-dz * w, 0, dx * w, dz * w, 0, -dx * w, dx * lean * h, h, dz * lean * h);
    idx.push(i0, i0 + 1, i0 + 2);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// pinwheel texture for the fans (red / cream swirl, like the film)
function fanTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = R.fanB; g.fillRect(0, 0, w, h);
    g.translate(128, 128);
    for (let k = 0; k < 6; k++) {
      g.rotate(TAU / 6);
      g.fillStyle = k % 2 ? R.fanA : "#d9a07a";
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(70, -30, 120, 20); g.quadraticCurveTo(60, 10, 0, 0); g.fill();
    }
    g.fillStyle = "#8a7a7e"; g.beginPath(); g.arc(0, 0, 18, 0, TAU); g.fill();
  });
}

// ======================================================================= POSES
// Joint angles in radians. Axes: x = forward/back swing, y = twist, z = sideways.
// Legs: negative x = leg forward. Knees: positive = bend. Torso: positive x = lean forward.
// Arms: negative x = arm forward, z = away from the body (mirrored for the right side in code).
const STAND = {
  hipsY: 4.55, pitch: 0, roll: 0,
  torso: [0, 0, 0], head: [0, 0, 0],
  shL: [0, 0, 0.12], shR: [0, 0, 0.12], elL: -0.3, elR: -0.3,
  thL: [0, 0, 0.05], thR: [0, 0, 0.05], knL: 0.06, knR: 0.06,
};
const SLEEP = {
  hipsY: 1.45, pitch: 0, roll: 0,
  torso: [0.52, 0.05, 0.04], head: [0.6, -0.15, 0.05],
  shL: [-0.45, 0, 0.42], shR: [-0.3, 0, 0.35], elL: -0.7, elR: -0.5,
  thL: [-1.5, 0.15, 0.3], thR: [-1.45, -0.1, 0.25], knL: 0.85, knR: 1.0,
};
const CROUCH = {
  hipsY: 3.25, pitch: 0, roll: 0,
  torso: [0.38, 0, 0], head: [-0.2, 0, 0],
  shL: [-0.45, 0, 0.4], shR: [-0.45, 0, 0.4], elL: -0.7, elR: -0.7,
  thL: [-0.95, 0, 0.12], thR: [-0.95, 0, 0.12], knL: 1.65, knR: 1.65,
};
const STRETCH = {
  hipsY: 4.65, pitch: 0, roll: 0,
  torso: [-0.18, 0, 0], head: [-0.38, 0, 0],
  shL: [-0.35, 0, 1.55], shR: [-0.35, 0, 1.55], elL: -0.25, elR: -0.25,
  thL: [0, 0, 0.1], thR: [0, 0, 0.1], knL: 0.02, knR: 0.02,
};
const AIR = {
  hipsY: 4.55, pitch: 0, roll: 0,
  torso: [0.12, 0, 0], head: [-0.12, 0, 0],
  shL: [-0.25, 0, 0.75], shR: [-0.25, 0, 0.75], elL: -0.5, elR: -0.5,
  thL: [-0.65, 0, 0.12], thR: [-0.35, 0, 0.12], knL: 1.05, knR: 0.7,
};
const FLY = {
  hipsY: 4.55, pitch: 0.95, roll: 0,
  torso: [0.05, 0, 0], head: [-0.75, 0, 0],
  shL: [0.65, 0, 0.3], shR: [0.65, 0, 0.3], elL: -0.15, elR: -0.15,
  thL: [0.28, 0, 0.08], thR: [0.12, 0, 0.08], knL: 0.55, knR: 0.35,
};
const HOVER = {
  hipsY: 4.55, pitch: 0.12, roll: 0,
  torso: [0.04, 0, 0], head: [-0.15, 0, 0],
  shL: [0.1, 0, 0.55], shR: [0.1, 0, 0.55], elL: -0.35, elR: -0.35,
  thL: [-0.12, 0, 0.1], thR: [0.05, 0, 0.1], knL: 0.45, knR: 0.3,
};

const KEYS = ["torso", "head", "shL", "shR", "thL", "thR"], SCAL = ["hipsY", "pitch", "roll", "elL", "elR", "knL", "knR"];
const clone = p => JSON.parse(JSON.stringify(p));
function mix(a, b, t) {
  const o = {};
  for (const k of SCAL) o[k] = lerp(a[k], b[k], t);
  for (const k of KEYS) o[k] = a[k].map((v, i) => lerp(v, b[k][i], t));
  return o;
}
const add = (p, k, i, v) => { p[k][i] += v; };

// ======================================================================= build
export function createKeeper(scene) {
  const M = makeMaterials();
  const rnd = rng(2024);
  const root = new THREE.Group(); root.scale.setScalar(R.scale); scene.add(root);
  const body = new THREE.Group(); root.add(body);                  // pitch / roll for flight
  const allMeshes = [];

  const J = {};
  const pivot = (name, parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); J[name] = g; return g; };

  /** Adds a part: mesh + outline + moss coat + moss clumps / flowers / grass tufts. */
  function part(parent, geo, mat, pos = [0, 0, 0], opt = {}) {
    const m = new THREE.Mesh(geo, mat); m.position.set(...pos); if (opt.rot) m.rotation.set(...opt.rot);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); allMeshes.push(m);
    if (opt.outline !== false) { const o = new THREE.Mesh(geo, M.outline); m.add(o); }
    const moss = (opt.moss ?? 0.6) * R.mossDensity;
    if (moss > 0) addMoss(m, moss, opt);
    return m;
  }

  const clumpGeo = blobGeometry(1, 0.35, 12), flowerGeo = flowerGeometry(), tuftGeo = tuftGeometry();
  const tuftMat = paintMaterial({ color: R.moss[2], brush: 0.2, side: THREE.DoubleSide });
  const flowerMat = new THREE.MeshLambertMaterial({ color: "#ffffff", side: THREE.DoubleSide, emissive: "#3a3530" });

  function addMoss(mesh, amount, opt) {
    const geo = mesh.geometry;
    // 1. a moss coat: the same shape, slightly inflated, cut by noise (keeps the tops)
    const coat = geo.clone();
    const p = coat.attributes.position, n = coat.attributes.normal;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * 0.07, p.getY(i) + n.getY(i) * 0.07, p.getZ(i) + n.getZ(i) * 0.07);
    const cm = new THREE.Mesh(coat, M.mossCoat); cm.castShadow = true; mesh.add(cm);
    // 2. clumps, flowers and grass tufts sampled on the surface, mostly facing up
    geo.computeBoundingBox(); const s = new THREE.Vector3(); geo.boundingBox.getSize(s);
    const area = (s.x * s.y + s.y * s.z + s.x * s.z) * 2;
    const count = Math.min(90, Math.floor(area * amount * 0.45));
    if (count < 1) return;
    const sampler = new MeshSurfaceSampler(new THREE.Mesh(geo)).build();
    const P = new THREE.Vector3(), N = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), Qt = new THREE.Quaternion(), Mx = new THREE.Matrix4(), S = new THREE.Vector3();
    const clumps = [], flowers = [], tufts = [];
    let guard = 0;
    while (clumps.length < count && guard++ < count * 12) {
      sampler.sample(P, N);
      const upness = N.y + (opt.mossBias ?? 0);
      if (rnd() > clamp(upness * 1.1 + 0.05)) continue;
      Qt.setFromUnitVectors(up, N);
      const sc = (0.18 + rnd() * 0.34) * (opt.clumpScale ?? 1);
      clumps.push(Mx.compose(P.clone().addScaledVector(N, sc * 0.25), Qt.clone(), S.set(sc, sc * 0.6, sc).clone()).clone());
      if (rnd() < 0.18) {
        const f = 0.35 + rnd() * 0.25;
        flowers.push([Mx.compose(P.clone().addScaledVector(N, sc * 0.6), Qt.clone(), new THREE.Vector3(f, f, f)).clone(), R.flower[Math.floor(rnd() * R.flower.length)]]);
      }
      if (N.y > 0.45 && rnd() < 0.3) { const t = 0.8 + rnd() * 1.1; tufts.push(Mx.compose(P.clone(), Qt.clone(), new THREE.Vector3(t, t, t)).clone()); }
    }
    const im = new THREE.InstancedMesh(clumpGeo, M.moss, clumps.length);
    clumps.forEach((m, i) => { im.setMatrixAt(i, m); im.setColorAt(i, col("#ffffff").multiplyScalar(0.85 + rnd() * 0.3)); });
    im.castShadow = true; mesh.add(im);
    if (flowers.length) {
      const fm = new THREE.InstancedMesh(flowerGeo, flowerMat, flowers.length);
      flowers.forEach(([m, c], i) => { fm.setMatrixAt(i, m); fm.setColorAt(i, col(c)); });
      mesh.add(fm);
    }
    if (tufts.length) {
      const tm = new THREE.InstancedMesh(tuftGeo, tuftMat, tufts.length);
      tufts.forEach((m, i) => tm.setMatrixAt(i, m)); mesh.add(tm);
    }
  }

  // ---------------------------------------------------------------- skeleton + parts
  const hips = pivot("hips", body, 0, STAND.hipsY, 0);
  part(hips, rbox(4.3, 1.6, 3.1, 0.6), M.metal, [0, 0, 0], { moss: 0.4 });
  part(hips, ring(2.2, 0.34), M.rust, [0, 0.45, 0], { rot: [Math.PI / 2, 0, 0], moss: 0.15 });

  for (const side of [1, -1]) {
    const L = side === 1 ? "L" : "R";
    const th = pivot("th" + L, hips, side * 1.75, -0.35, 0);
    part(th, new THREE.SphereGeometry(1.1, 18, 14), M.dark, [0, 0, 0], { moss: 0.1 });
    part(th, capsule(1.02, 0.8), M.metal, [0, -1.05, 0], { moss: 0.5 });
    const kn = pivot("kn" + L, th, 0, -2.0, 0);
    part(kn, new THREE.SphereGeometry(1.0, 16, 12), M.teal, [0, 0, 0.1], { moss: 0.2 });
    part(kn, cyl(1.35, 1.62, 1.8, 22), M.metal, [0, -1.0, 0], { moss: 0.8 });
    part(kn, ring(1.55, 0.2), M.rust, [0, -0.7, 0], { rot: [Math.PI / 2, 0, 0], moss: 0 });
    const foot = part(kn, rbox(2.9, 0.9, 3.7, 0.4), M.panel, [0, -1.75, 0.4], { moss: 0.45 });
    J["foot" + L] = foot;
  }

  const torso = pivot("torso", hips, 0, 0.7, 0);
  const chest = part(torso, ellipsoid(3.45, 3.25, 2.85, 36), M.metal, [0, 3.0, 0], { moss: 1.0, mossBias: 0.15 });
  part(torso, ring(3.2, 0.3), M.rust, [0, 1.2, 0], { rot: [Math.PI / 2, 0, 0], moss: 0.2 });
  part(torso, ring(2.85, 0.22), M.rust, [0, 5.05, 0], { rot: [Math.PI / 2, 0, 0], moss: 0.2 });
  part(torso, rbox(3.9, 3.6, 1.9, 0.5), M.panel, [0, 3.6, -2.45], { moss: 1.0 });            // back pack
  part(torso, rbox(4.0, 0.45, 2.0, 0.15), M.rust, [0, 2.4, -2.45], { moss: 0 });             // back pack stripe
  part(torso, ring(0.95, 0.2), M.teal, [0, 3.9, -3.42], { moss: 0, outline: false });          // vent
  part(torso, new THREE.CircleGeometry(0.9, 24).rotateY(Math.PI), M.dark, [0, 3.9, -3.4], { moss: 0, outline: false });

  // chest porthole: ring, dark glass that lights up, eight spokes
  const port = new THREE.Group(); port.position.set(0, 3.25, 2.74); port.rotation.x = -0.08; torso.add(port);
  part(port, ring(1.12, 0.24), M.teal, [0, 0, 0], { moss: 0.05 });
  part(port, ring(1.42, 0.12), M.dark, [0, 0, -0.08], { moss: 0, outline: false });
  const glassMat = new THREE.ShaderMaterial({
    uniforms: { uGlow: { value: 0 }, uTime: SHARED.uTime, uCol: { value: col(R.glow) } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform float uGlow, uTime; uniform vec3 uCol; varying vec2 vUv;
      void main(){ float r = length(vUv - 0.5) * 2.0;
        vec3 dark = vec3(0.07, 0.07, 0.09) + vec3(0.12, 0.1, 0.08) * (1.0 - r);
        float flick = 0.92 + 0.08 * sin(uTime * 13.0) * sin(uTime * 7.3);
        vec3 lit = mix(uCol * 1.25, vec3(1.0, 0.95, 0.75), smoothstep(0.7, 0.0, r)) * (1.2 + 2.6 * uGlow) * flick;
        gl_FragColor = vec4(mix(dark, lit, uGlow), 1.0); }`,
  });
  const glass = new THREE.Mesh(new THREE.CircleGeometry(1.05, 40), glassMat); glass.position.z = -0.05; port.add(glass);
  for (let k = 0; k < 8; k++) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.05, 0.08), M.dark);
    sp.rotation.z = k / 8 * TAU; sp.position.set(Math.sin(-k / 8 * TAU) * 0.52, Math.cos(k / 8 * TAU) * 0.52, 0.02); port.add(sp);
  }
  port.add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 16).rotateX(Math.PI / 2), M.dark));
  const chestLight = new THREE.PointLight(R.glow, 0, 22, 1.6); chestLight.position.set(0, 3.2, 3.6); torso.add(chestLight);

  // head: low between the shoulders, a visor with two round teal eyes
  const head = pivot("head", torso, 0, 5.6, 0.75);
  part(head, rbox(2.1, 1.55, 1.9, 0.5), M.metal, [0, 0.55, 0], { moss: 0.9, mossBias: 0.3 });
  part(head, rbox(2.25, 0.45, 0.6, 0.18), M.panel, [0, 1.25, 0.65], { moss: 0.4 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: "#2f5752" });
  const eyes = [];
  for (const sx of [-0.5, 0.5]) {
    part(head, new THREE.SphereGeometry(0.5, 20, 14, 0, TAU, 0, Math.PI / 2).rotateX(Math.PI / 2), M.teal, [sx, 0.5, 0.82], { moss: 0, outline: true });
    const e = new THREE.Mesh(new THREE.CircleGeometry(0.22, 20), eyeMat); e.position.set(sx, 0.5, 1.33); head.add(e); eyes.push(e);
  }

  // shoulders, arms, fists
  for (const side of [1, -1]) {
    const L = side === 1 ? "L" : "R";
    const sh = pivot("sh" + L, torso, side * 3.55, 4.55, 0);
    part(sh, new THREE.SphereGeometry(1.85, 26, 18), M.metal, [side * 0.3, 0.15, 0], { moss: 1.0, mossBias: 0.2 });
    part(sh, ring(1.65, 0.22), M.rust, [side * 0.3, 0.15, 0], { rot: [0, 0, Math.PI / 2], moss: 0 });
    part(sh, capsule(0.9, 1.0), M.teal, [side * 0.45, -1.7, 0], { moss: 0.4 });
    const el = pivot("el" + L, sh, side * 0.45, -2.75, 0);
    part(el, cyl(1.2, 1.4, 2.0, 20), M.metal, [0, -1.0, 0], { moss: 0.7 });
    part(el, ring(1.33, 0.18), M.rust, [0, -0.45, 0], { rot: [Math.PI / 2, 0, 0], moss: 0 });
    const fist = part(el, ellipsoid(1.35, 1.15, 1.3, 20), M.panel, [0, -2.55, 0.1], { moss: 0.4 });
    J["hand" + L] = fist;
  }

  // the frame on the back with two fans (they spin when the keeper is awake)
  const fanTex = fanTexture();
  const fans = [];
  for (const side of [1, -1]) {
    const pts = [[side * 1.2, 4.6, -2.9], [side * 1.5, 7.3, -2.8], [side * 2.4, 8.7, -1.8], [side * 2.8, 8.8, -0.7]];
    part(torso, tube(pts, 0.24), M.teal, [0, 0, 0], { moss: 0.5, clumpScale: 0.6 });
    const housing = new THREE.Group(); housing.position.set(side * 2.8, 8.8, -0.5); torso.add(housing);
    part(housing, cyl(0.95, 0.95, 0.55, 26).rotateX(Math.PI / 2), M.metal, [0, 0, 0], { moss: 0.35, clumpScale: 0.6 });
    part(housing, ring(0.95, 0.12), M.rust, [0, 0, 0.29], { moss: 0, outline: false });
    const fan = new THREE.Mesh(new THREE.CircleGeometry(0.85, 32), new THREE.MeshToonMaterial({ map: fanTex, gradientMap: M.metal.gradientMap }));
    fan.position.z = 0.29; housing.add(fan); fans.push(fan);
    J["fan" + (side === 1 ? "L" : "R")] = housing;
  }
  part(torso, tube([[2.8, 9.0, -1.1], [1.0, 9.7, -1.6], [-1.0, 9.7, -1.6], [-2.8, 9.0, -1.1]], 0.2), M.teal, [0, 0, 0], { moss: 0.6, clumpScale: 0.6 });

  // a little tree growing out of the right shoulder
  let shoulderTree = null;
  if (R.shoulderTree) {
    shoulderTree = new THREE.Group(); shoulderTree.position.set(-0.6, 1.2, -0.3); J.shR.add(shoulderTree);
    part(shoulderTree, tube([[0, 0, 0], [-0.3, 1.6, 0.1], [0.2, 3.2, -0.2], [0.1, 4.6, 0]], 0.2), M.wood, [0, 0, 0], { moss: 0.2, clumpScale: 0.5 });
    part(shoulderTree, tube([[-0.1, 2.4, 0], [-1.0, 3.2, 0.2], [-1.4, 3.8, 0.1]], 0.1), M.wood, [0, 0, 0], { moss: 0 });
    const lg = blobGeometry(2, 0.3, 21);
    for (const [x, y, z, s] of [[0.1, 5.0, 0, 1.4], [-0.9, 4.6, 0.3, 1.0], [0.9, 4.5, -0.2, 1.0], [-1.5, 3.9, 0.2, 0.8], [0.3, 5.8, 0.1, 0.9], [0.6, 4.0, 0.5, 0.7]]) {
      const b = new THREE.Mesh(lg, M.leaf); b.position.set(x, y, z); b.scale.set(s, s * 0.8, s); b.castShadow = true; shoulderTree.add(b);
    }
  }

  // thruster glows under the feet, visible while flying
  const glowMat = new THREE.SpriteMaterial({ map: glowTexture(), color: "#ffd38a", blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 });
  const thrusters = ["footL", "footR"].map(k => { const s = new THREE.Sprite(glowMat); s.position.set(0, -0.8, -0.2); s.scale.setScalar(4); J[k].add(s); return s; });

  // ---------------------------------------------------------------- animation
  const cur = clone(SLEEP);
  let phase = 0, lastCos = 1, fanSpin = 0, glow = 0;
  const tmp = new THREE.Vector3();
  const points = { chest: new THREE.Vector3(), footL: new THREE.Vector3(), footR: new THREE.Vector3(), handL: new THREE.Vector3(), handR: new THREE.Vector3(), fanL: new THREE.Vector3(), fanR: new THREE.Vector3(), head: new THREE.Vector3() };

  /** Builds the target pose for the current state. */
  function targetPose(s, t) {
    let p;
    switch (s.mode) {
      case "sleep": {
        p = clone(SLEEP);
        const b = Math.sin(t * 0.6) * 0.015 + s.stir * Math.sin(t * 23) * 0.02;   // slow breathing, shiver when you try to wake it
        add(p, "torso", 0, b); add(p, "head", 0, b * 1.5 + s.stir * -0.25);
        break;
      }
      case "wake": {
        const w = s.w;                                                        // 0..1 over the wake-up sequence
        const lift = smooth(0.15, 0.4, w), rise = smooth(0.42, 0.7, w), stretch = smooth(0.7, 0.82, w) * (1 - smooth(0.88, 1.0, w));
        const sitUp = clone(SLEEP); sitUp.torso = [0.1, 0, 0]; sitUp.head = [-0.3, 0.2, 0]; sitUp.shL = [-0.5, 0, 0.6]; sitUp.shR = [-0.5, 0, 0.6];
        p = mix(SLEEP, sitUp, lift);
        p = mix(p, rise < 0.5 ? mix(p, CROUCH, rise * 2) : mix(CROUCH, STAND, rise * 2 - 1), rise > 0 ? 1 : 0);
        p = mix(p, STRETCH, stretch);
        add(p, "head", 1, Math.sin(w * 18) * 0.12 * lift * (1 - rise));          // looks around while sitting up
        break;
      }
      case "ground": {
        const a = s.speed;                                                    // 0 idle .. 1 walk .. 2 run
        const aw = Math.min(a, 1), ar = Math.max(a - 1, 0);
        p = clone(STAND);
        add(p, "torso", 0, Math.sin(t * 1.3) * 0.02 * (1 - aw));                // breathing
        add(p, "head", 1, Math.sin(t * 0.35) * 0.25 * (1 - aw));                // looks around when idle
        const sp = Math.sin(phase), cp = Math.cos(phase), A = 0.5 * aw + 0.2 * ar;
        p.thL[0] = -A * sp; p.thR[0] = A * sp;
        p.knL = 0.08 + (0.85 * aw + 0.4 * ar) * Math.max(0, cp); p.knR = 0.08 + (0.85 * aw + 0.4 * ar) * Math.max(0, -cp);
        p.hipsY = STAND.hipsY - (0.32 * aw + 0.25 * ar) * sp * sp - 0.15 * ar;
        p.torso[0] += 0.06 * aw + 0.22 * ar; p.torso[1] = 0.1 * aw * sp; p.torso[2] = 0.05 * aw * sp;
        p.head[0] -= 0.1 * aw + 0.2 * ar; p.head[1] -= p.torso[1] * 0.8;
        p.shL[0] = (0.45 * aw + 0.25 * ar) * sp; p.shR[0] = -(0.45 * aw + 0.25 * ar) * sp;
        p.elL = -0.35 - 0.3 * aw - 0.4 * ar; p.elR = p.elL;
        p.roll = s.turn * -0.12 * aw;
        if (s.crouch > 0) p = mix(p, CROUCH, s.crouch);
        break;
      }
      case "air": {
        p = clone(AIR);
        const up = clamp(s.vy / 20, -1, 1);
        add(p, "shL", 2, up * 0.4); add(p, "shR", 2, up * 0.4);
        add(p, "thL", 0, -up * 0.2); add(p, "thR", 0, up * 0.15);
        if (s.crouch > 0) p = mix(p, CROUCH, s.crouch);
        break;
      }
      case "fly": {
        const L = clamp(s.lean, 0, 1);
        p = mix(HOVER, FLY, L);
        const bob = Math.sin(t * 2.2);
        add(p, "thL", 0, bob * 0.08); add(p, "thR", 0, -bob * 0.08);
        add(p, "shL", 2, bob * 0.05); add(p, "shR", 2, bob * 0.05);
        p.hipsY += bob * 0.25 * (1 - L);
        p.pitch += s.climb * -0.35 * L;
        p.roll = -s.turn * 0.55;
        add(p, "head", 1, -s.turn * 0.3);
        if (s.boost) { p = mix(p, FLY, 0.5); p.pitch += 0.12; add(p, "shL", 0, 0.3); add(p, "shR", 0, 0.3); }
        break;
      }
      default: p = clone(STAND);
    }
    return p;
  }

  function apply(p) {
    J.hips.position.y = p.hipsY;
    body.rotation.set(p.pitch, 0, p.roll);
    // keep the feet roughly under the robot when it pitches in flight: rotate around the chest
    body.position.set(0, 0, 0);
    if (Math.abs(p.pitch) > 0.001) { const c = 8.5; body.position.y = c - c * Math.cos(p.pitch); body.position.z = -c * Math.sin(p.pitch); }
    J.torso.rotation.set(...p.torso); J.head.rotation.set(...p.head);
    J.shL.rotation.set(p.shL[0], p.shL[1], p.shL[2]); J.shR.rotation.set(p.shR[0], -p.shR[1], -p.shR[2]);
    J.elL.rotation.x = p.elL; J.elR.rotation.x = p.elR;
    J.thL.rotation.set(p.thL[0], p.thL[1], p.thL[2]); J.thR.rotation.set(p.thR[0], -p.thR[1], -p.thR[2]);
    J.knL.rotation.x = p.knL; J.knR.rotation.x = p.knR;
  }

  /**
   * ANIMATION STATE (s):
   *   mode: "sleep" | "wake" | "ground" | "air" | "fly"
   *   stir (sleep, 0..1)  w (wake, 0..1)  speed (ground, 0..2)  turn (-1..1)  crouch (0..1)
   *   vy (air)  lean, climb, boost (fly)  glow (0..1 chest light)  fan (fan speed)
   * Returns { step: "L" | "R" | null } when a foot hits the ground (for sound, dust, shake).
   */
  function update(dt, s) {
    const t = SHARED.uTime.value;
    let step = null;
    if (s.mode === "ground" && s.speed > 0.05) {
      phase += dt * (2.1 + 1.6 * Math.max(s.speed - 1, 0)) * Math.min(s.speed, 1.2) * 1.0;
      const c = Math.cos(phase);
      if (Math.sign(c) !== Math.sign(lastCos)) step = c < 0 ? "L" : "R";
      lastCos = c;
    } else if (s.mode === "ground") {
      // settle the legs back to standing
      phase = Math.round(phase / Math.PI) * Math.PI * 0.0 + lerp(phase, Math.round(phase / Math.PI) * Math.PI, damp(5, dt));
    }
    const target = targetPose(s, t);
    const k = damp(s.mode === "wake" ? 14 : s.mode === "fly" ? 5 : 9, dt);
    for (const key of SCAL) cur[key] = lerp(cur[key], target[key], k);
    for (const key of KEYS) for (let i = 0; i < 3; i++) cur[key][i] = lerp(cur[key][i], target[key][i], k);
    apply(cur);

    // fans, glow, eyes, shoulder tree
    fanSpin += dt * (s.fan ?? 0);
    fans.forEach((f, i) => { f.rotation.z = (i ? -1 : 1) * fanSpin; });
    glow = lerp(glow, s.glow ?? 0, damp(6, dt));
    glassMat.uniforms.uGlow.value = glow;
    chestLight.intensity = glow * 40;
    eyeMat.color.set("#2f5752").lerp(col(R.glow).multiplyScalar(2.2), glow);
    if (shoulderTree) shoulderTree.rotation.z = Math.sin(t * 1.4) * 0.03 + (s.mode === "fly" ? Math.sin(t * 9) * 0.05 * (s.lean + 0.3) : 0);
    glowMat.opacity = lerp(glowMat.opacity, s.mode === "fly" ? (s.boost ? 1 : 0.65) : 0, damp(5, dt));
    thrusters.forEach(th => th.scale.setScalar((s.boost ? 7 : 4.5) * (0.9 + 0.2 * Math.sin(t * 40 + th.id))));

    // world-space helper points
    root.updateMatrixWorld(true);
    points.chest.setFromMatrixPosition(glass.matrixWorld);
    points.footL.setFromMatrixPosition(J.footL.matrixWorld); points.footR.setFromMatrixPosition(J.footR.matrixWorld);
    points.handL.setFromMatrixPosition(J.handL.matrixWorld); points.handR.setFromMatrixPosition(J.handR.matrixWorld);
    points.fanL.setFromMatrixPosition(J.fanL.matrixWorld); points.fanR.setFromMatrixPosition(J.fanR.matrixWorld);
    points.head.setFromMatrixPosition(J.head.matrixWorld);
    return { step };
  }

  update(0, { mode: "sleep", stir: 0 });
  return { root, body, joints: J, points, update, meshes: allMeshes, perch: () => tmp.set(-0.1, 1.85, 0.55).applyMatrix4(J.shR.matrixWorld) };
}
