// The forest: ground, tall trees with vine curtains, grass and flowers that follow the player,
// a far canopy carpet, mist, sun shafts and falling leaves.
// createForest() returns { trees, update(dt, camera), collide(pos, radius) }.
import * as THREE from "three";
import { CONFIG } from "./config.js";
import { SHARED, GLSL_GROUND, GLSL_NOISE, groundHeight, paintMaterial, outlineMaterial, blobGeometry, canvasTexture, dabTexture, glowTexture, rng, col, TAU, lerp, SUN_DIR } from "./commun.js";

const W = CONFIG.world;

export function createForest(scene) {
  const r = rng(W.seed);
  const group = new THREE.Group(); scene.add(group);
  const Q = SHARED.quality;

  // ------------------------------------------------------------ ground
  {
    const size = W.farRadius * 2.2, seg = 240;
    const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, groundHeight(p.getX(i), p.getZ(i)));
    g.computeVertexNormals();
    const m = paintMaterial({
      color: "#4d7a2c", space: "world", brush: 0.25,
      patches: [{ color: "#2f5524", scale: 0.035, threshold: 0.55 }, { color: "#8fae3e", scale: 0.05, threshold: 0.62 }, { color: "#6b5a3a", scale: 0.08, threshold: 0.7 }],
    });
    const ground = new THREE.Mesh(g, m); ground.receiveShadow = true; group.add(ground);
  }

  // ------------------------------------------------------------ trees
  const trees = [];
  const minGap = 15;
  let tries = 0;
  while (trees.length < W.treeCount && tries++ < W.treeCount * 40) {
    const a = r() * TAU, d = W.clearingRadius + 6 + Math.pow(r(), 0.8) * (W.forestRadius - W.clearingRadius);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (trees.some(t => (t.x - x) ** 2 + (t.z - z) ** 2 < minGap * minGap)) continue;
    const h = lerp(W.treeHeight[0], W.treeHeight[1], r()), rad = lerp(W.trunkRadius[0], W.trunkRadius[1], r());
    trees.push({ x, z, y: groundHeight(x, z) - 0.5, h, r: rad, lean: (r() - 0.5) * 0.05, rot: r() * TAU });
  }

  // trunk: tapered cylinder with flared roots, base at y = 0, height 1
  const trunkGeo = new THREE.CylinderGeometry(0.62, 1, 1, 12, 10); trunkGeo.translate(0, 0.5, 0);
  {
    const p = trunkGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), a = Math.atan2(p.getZ(i), p.getX(i));
      const flare = 1 + 0.9 * Math.exp(-y * 22) * (0.6 + 0.4 * Math.sin(a * 5));
      p.setX(i, p.getX(i) * flare); p.setZ(i, p.getZ(i) * flare);
    }
    trunkGeo.computeVertexNormals();
  }
  const trunkMat = paintMaterial({
    color: W.trunkColor, space: "world", brush: 0.5, rim: "#ffcf8a",
    patches: [{ color: W.trunkDark, scale: 0.22, threshold: 0.58 }, { color: "#4f6e2c", scale: 0.12, threshold: 0.6 }, { color: "#7d6650", scale: 0.4, threshold: 0.66 }],
  });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
  const trunkLines = new THREE.InstancedMesh(trunkGeo, outlineMaterial(0.09, "#1f1a18"), trees.length);
  const M = new THREE.Matrix4(), Qn = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(), P = new THREE.Vector3();
  trees.forEach((t, i) => {
    E.set(t.lean, t.rot, t.lean * 0.7); Qn.setFromEuler(E);
    M.compose(P.set(t.x, t.y, t.z), Qn, S.set(t.r, t.h, t.r));
    trunks.setMatrixAt(i, M); trunkLines.setMatrixAt(i, M);
    trunks.setColorAt(i, col("#ffffff").multiplyScalar(0.8 + r() * 0.35));
  });
  trunks.castShadow = true; trunks.receiveShadow = true;
  group.add(trunks, trunkLines);

  // canopy: lumpy foliage blobs at the top of every tree
  const leafMat = paintMaterial({
    color: W.leaf[1], space: "world", brush: 0.45, rim: "#ffe3a0", rimPower: 2.2, wind: 0.6,
    patches: [{ color: W.leaf[0], scale: 0.09, threshold: 0.6 }, { color: W.leaf[2], scale: 0.14, threshold: 0.62 }],
  });
  const leafGeo = blobGeometry(2, 0.3, 3);
  const canopy = [];
  for (const t of trees) {
    const n = 8 + Math.floor(r() * 6);
    for (let k = 0; k < n; k++) {
      const a = r() * TAU, d = Math.sqrt(r()) * 11;
      canopy.push({ x: t.x + Math.cos(a) * d, y: t.y + t.h * lerp(0.74, 1.0, r()) - d * 0.4, z: t.z + Math.sin(a) * d, s: 5 + r() * 6, sy: 0.55 + r() * 0.3 });
    }
    // a few clumps of ivy along the trunk
    const ivy = 2 + Math.floor(r() * 4);
    for (let k = 0; k < ivy; k++) {
      const a = r() * TAU, y = t.h * lerp(0.15, 0.7, r());
      canopy.push({ x: t.x + Math.cos(a) * t.r * 0.9, y: t.y + y, z: t.z + Math.sin(a) * t.r * 0.9, s: 0.9 + r() * 1.4, sy: 1.4 });
    }
  }
  // far canopy carpet (seen when flying, and as the misty wall around the forest)
  for (let i = 0; i < 2600; i++) {
    const a = r() * TAU, d = W.forestRadius + 10 + Math.sqrt(r()) * (W.farRadius - W.forestRadius);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    canopy.push({ x, y: groundHeight(x, z) + 66 + r() * 22, z, s: 16 + r() * 16, sy: 0.6 + r() * 0.35 });
  }
  // two levels of detail: smooth blobs near the glade, lighter ones further away
  const nearR = W.nearDetailRadius;
  for (const [list, geo] of [[canopy.filter(c => Math.hypot(c.x, c.z) < nearR), blobGeometry(3, 0.3, 3)], [canopy.filter(c => Math.hypot(c.x, c.z) >= nearR), leafGeo]]) {
    const leaves = new THREE.InstancedMesh(geo, leafMat, list.length);
    list.forEach((c, i) => {
      E.set(r() * 0.3, r() * TAU, r() * 0.3); Qn.setFromEuler(E);
      M.compose(P.set(c.x, c.y, c.z), Qn, S.set(c.s, c.s * c.sy, c.s));
      leaves.setMatrixAt(i, M);
      leaves.setColorAt(i, col("#ffffff").lerp(col(r() < 0.5 ? "#d8e88a" : "#7fa070"), r() * 0.5));
    });
    leaves.castShadow = true; leaves.receiveShadow = true;
    group.add(leaves);
  }

  // vines: hanging leafy strips under the canopy
  {
    const tex = canvasTexture(64, 512, (g, w, h) => {
      const rr = rng(9);
      g.strokeStyle = "#3b5a25"; g.lineWidth = 3; g.beginPath(); g.moveTo(32, 0);
      for (let y = 0; y < h; y += 16) g.lineTo(32 + Math.sin(y * 0.05) * 6, y); g.stroke();
      for (let i = 0; i < 160; i++) {
        const y = rr() * h * (0.3 + 0.7 * rr()), x = 32 + Math.sin(y * 0.05) * 6 + (rr() - 0.5) * 34 * (1 - y / h * 0.5);
        g.fillStyle = ["#355a24", "#5f8b31", "#8fb544", "#4b7a2a"][Math.floor(rr() * 4)];
        g.beginPath(); g.ellipse(x, y, 5 + rr() * 5, 3 + rr() * 3, rr() * TAU, 0, TAU); g.fill();
      }
    });
    const vMat = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
    vMat.onBeforeCompile = sh => {
      sh.uniforms.uTime = SHARED.uTime;
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nuniform float uTime;")
        .replace("#include <begin_vertex>", `#include <begin_vertex>
          float k = (1.0 - uv.y);
          transformed.x += sin(uTime * 1.2 + instanceMatrix[3].x * 0.3) * k * k * 0.6;`);
    };
    const vGeo = new THREE.PlaneGeometry(1, 1); vGeo.translate(0, -0.5, 0);
    const list = [];
    for (const t of trees) {
      if (Math.hypot(t.x, t.z) > W.forestRadius * 0.75) continue;
      const n = 3 + Math.floor(r() * 7);
      for (let k = 0; k < n; k++) {
        const a = r() * TAU, d = 2 + r() * 7;
        list.push([t.x + Math.cos(a) * d, t.y + t.h * 0.76, t.z + Math.sin(a) * d, 1.6 + r() * 1.4, 10 + r() * 24, r() * TAU]);
      }
    }
    const vines = new THREE.InstancedMesh(vGeo, vMat, list.length);
    list.forEach((v, i) => { Qn.setFromEuler(E.set(0, v[5], 0)); M.compose(P.set(v[0], v[1], v[2]), Qn, S.set(v[3], v[4], 1)); vines.setMatrixAt(i, M); });
    vines.castShadow = true;
    group.add(vines);
  }

  // ------------------------------------------------------------ grass (follows the player, wraps around)
  function makeGrassLike({ count, patch, bladeGeo, colors, extra = "", seed }) {
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = bladeGeo.index; geo.attributes.position = bladeGeo.attributes.position; geo.attributes.uv = bladeGeo.attributes.uv;
    geo.attributes.normal = bladeGeo.attributes.normal;
    const off = new Float32Array(count * 4), rr = rng(seed);
    for (let i = 0; i < count; i++) off.set([(rr() - 0.5) * patch, (rr() - 0.5) * patch, rr(), rr()], i * 4);
    geo.setAttribute("aOff", new THREE.InstancedBufferAttribute(off, 4));
    geo.instanceCount = count;
    const m = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
    m.onBeforeCompile = sh => {
      sh.uniforms.uTime = SHARED.uTime; sh.uniforms.uPlayer = SHARED.uPlayer;
      sh.uniforms.uA = { value: col(colors[0]) }; sh.uniforms.uB = { value: col(colors[1]) };
      sh.vertexShader = sh.vertexShader.replace("#include <common>", `#include <common>
          ${GLSL_NOISE} ${GLSL_GROUND}
          attribute vec4 aOff; uniform float uTime; uniform vec3 uPlayer, uA, uB; varying vec3 vCol;`)
        .replace("#include <beginnormal_vertex>", `vec3 objectNormal = vec3(0.0, 1.0, 0.0);`)
        .replace("#include <begin_vertex>", `
          float hp = ${(patch / 2).toFixed(1)};
          vec2 base = uPlayer.xz + mod(aOff.xy - uPlayer.xz + hp, ${patch.toFixed(1)}) - hp;
          float edge = 1.0 - smoothstep(hp * 0.7, hp, max(abs(base.x - uPlayer.x), abs(base.y - uPlayer.z)));
          float clump = smoothstep(0.25, 0.6, fbm2(base * 0.06));
          float t = position.y;
          float ang = aOff.z * 6.2831;
          vec3 transformed = vec3(position.x * cos(ang), position.y, position.x * sin(ang));
          transformed *= (0.55 + 0.9 * aOff.w) * edge * (0.45 + 0.75 * clump);
          ${extra}
          // wind + push away from the keeper's feet
          float w = sin(uTime * 1.7 + base.x * 0.15 + base.y * 0.11) * 0.35 + sin(uTime * 3.1 + base.x * 0.7) * 0.1;
          vec2 away = base - uPlayer.xz; float dp = length(away);
          vec2 push = dp > 0.01 ? away / dp * smoothstep(12.0, 3.0, dp) * 1.3 : vec2(0.0);
          transformed.xz += (vec2(w, w * 0.4) + push) * t * t;
          transformed.y -= length(push) * t * t * 0.6;
          transformed += vec3(base.x, groundHeight(base), base.y);
          // colour: dark root -> sunny tip, dappled by passing light under the trees
          float sunny = mix(0.62, 1.0, smoothstep(${(W.clearingRadius * 0.8).toFixed(1)}, ${(W.clearingRadius * 0.3).toFixed(1)}, length(base)));
          float dap = 0.75 + 0.5 * smoothstep(0.42, 0.6, fbm2(base * 0.045 + uTime * 0.01));
          vCol = mix(uA, uB, t * (0.6 + 0.4 * aOff.w)) * mix(sunny * dap, 1.0, 0.25);`);
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vCol;")
        .replace("#include <color_fragment>", "#include <color_fragment>\n diffuseColor.rgb *= vCol;");
    };
    const mesh = new THREE.Mesh(geo, m); mesh.frustumCulled = false; mesh.receiveShadow = true;
    return mesh;
  }
  {
    const blade = new THREE.BufferGeometry();
    const pts = [], idx = [], uvs = [], nrm = [];
    const seg = 4;
    for (let i = 0; i <= seg; i++) { const t = i / seg, w = 0.16 * (1 - t * 0.92); pts.push(-w, t, 0, w, t, 0); uvs.push(0, t, 1, t); nrm.push(0, 0, 1, 0, 0, 1); }
    for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    blade.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3)); blade.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    blade.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3)); blade.setIndex(idx);
    blade.scale(0.8, 1.05, 0.8);
    const grass = makeGrassLike({ count: Math.floor(W.grass.count * Q.grass), patch: W.grass.patch, bladeGeo: blade, colors: [W.grass.base, W.grass.tip], seed: 11 });
    group.add(grass);

    // flowers: small star discs on short stems (white, lilac, yellow)
    const fl = new THREE.BufferGeometry();
    const fp = [0, 0, 0, 0.03, 0.75, 0, -0.03, 0.75, 0], fi = [0, 1, 2], fu = [0, 0, 0, 0.5, 0, 0.5];
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * TAU, b = a + 0.5, c = a - 0.5, i0 = fp.length / 3;
      fp.push(0, 0.8, 0, Math.cos(b) * 0.12, 0.8, Math.sin(b) * 0.12, Math.cos(a) * 0.3, 0.84, Math.sin(a) * 0.3, Math.cos(c) * 0.12, 0.8, Math.sin(c) * 0.12);
      fi.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3); fu.push(1, 1, 1, 1, 1, 1, 1, 1);
    }
    fl.setAttribute("position", new THREE.Float32BufferAttribute(fp, 3)); fl.setAttribute("uv", new THREE.Float32BufferAttribute(fu, 2));
    fl.setAttribute("normal", new THREE.Float32BufferAttribute(new Array(fp.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3)); fl.setIndex(fi);
    fl.scale(1.6, 1.2, 1.6);
    const flowers = makeGrassLike({
      count: Math.floor(W.flowers * Q.grass), patch: W.grass.patch * 0.8, bladeGeo: fl, colors: ["#3f6a2a", "#ffffff"], seed: 23,
      extra: "transformed *= step(0.55, fbm2(base * 0.08 + 3.0)) + 0.0;",
    });
    // petal colour: uv.x = 1 on petals; lilac / yellow variants by instance
    flowers.material.onBeforeCompile = (orig => sh => {
      orig(sh);
      sh.vertexShader = sh.vertexShader.replace("vCol = mix(uA, uB", `vec3 pet = aOff.w < 0.45 ? vec3(1.0) : aOff.w < 0.8 ? vec3(0.78, 0.7, 0.98) : vec3(1.0, 0.92, 0.55);
          vCol = uv.x > 0.9 ? pet * 1.15 : uA; vec3 unused = mix(uA, uB`);
    })(flowers.material.onBeforeCompile);
    flowers.material.defines = { USE_UV: "" };
    group.add(flowers);
  }

  // ------------------------------------------------------------ mist sprites (soft painted fog between trunks)
  const mistMat = new THREE.SpriteMaterial({ map: glowTexture(), color: CONFIG.fog.color, transparent: true, opacity: 0.2, depthWrite: false, fog: true });
  const mists = [];
  for (let i = 0; i < 70; i++) {
    const a = r() * TAU, d = W.clearingRadius + 70 + r() * (W.forestRadius * 0.9);
    const s = new THREE.Sprite(mistMat);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    s.position.set(x, groundHeight(x, z) + 4 + r() * 10, z);
    s.scale.set(110 + r() * 80, 30 + r() * 20, 1);
    s.userData.v = (r() - 0.5) * 0.8;
    mists.push(s); group.add(s);
  }

  // ------------------------------------------------------------ sun shafts in the glade
  {
    const tex = canvasTexture(64, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(255,240,200,0.0)"); gr.addColorStop(0.25, "rgba(255,236,190,0.9)"); gr.addColorStop(1, "rgba(255,236,190,0)");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      const gx = g.createLinearGradient(0, 0, w, 0); gx.addColorStop(0, "rgba(0,0,0,1)"); gx.addColorStop(0.5, "rgba(0,0,0,0)"); gx.addColorStop(1, "rgba(0,0,0,1)");
      g.globalCompositeOperation = "destination-out"; g.fillStyle = gx; g.fillRect(0, 0, w, h);
    });
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const geo = new THREE.PlaneGeometry(1, 1); geo.translate(0, -0.5, 0);
    for (let i = 0; i < 9; i++) {
      const s = new THREE.Mesh(geo, m);
      const a = r() * TAU, d = 10 + r() * W.clearingRadius * 1.4;
      s.position.set(Math.cos(a) * d + SUN_DIR.x * 30, 70, Math.sin(a) * d + SUN_DIR.z * 30);
      s.scale.set(6 + r() * 10, 95, 1);
      s.lookAt(s.position.x - SUN_DIR.z, 70, s.position.z + SUN_DIR.x);
      s.rotateZ(-0.45);
      group.add(s);
    }
  }

  // ------------------------------------------------------------ falling leaves (wrap around the player)
  {
    const N = 500, box = 110;
    const geo = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(0.35, 0.6);
    geo.index = base.index; geo.attributes.position = base.attributes.position; geo.attributes.uv = base.attributes.uv; geo.attributes.normal = base.attributes.normal;
    const off = new Float32Array(N * 4), rr = rng(31);
    for (let i = 0; i < N; i++) off.set([(rr() - 0.5) * box, rr() * 60, (rr() - 0.5) * box, rr()], i * 4);
    geo.setAttribute("aOff", new THREE.InstancedBufferAttribute(off, 4)); geo.instanceCount = N;
    const m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true });
    m.onBeforeCompile = sh => {
      sh.uniforms.uTime = SHARED.uTime; sh.uniforms.uPlayer = SHARED.uPlayer;
      sh.vertexShader = sh.vertexShader.replace("#include <common>", `#include <common>
          attribute vec4 aOff; uniform float uTime; uniform vec3 uPlayer; varying vec3 vC;`)
        .replace("#include <begin_vertex>", `
          float tt = uTime * (0.6 + aOff.w * 0.5) + aOff.w * 40.0;
          vec3 p = aOff.xyz; p.y = 60.0 - mod(p.y + tt * 2.2, 60.0);
          p.x += sin(tt * 0.9 + aOff.w * 9.0) * 3.0 + tt * 1.2; p.z += cos(tt * 0.7) * 2.0;
          vec3 c = vec3(uPlayer.x, 0.0, uPlayer.z);
          p.xz = c.xz + mod(p.xz - c.xz + ${box / 2}.0, ${box}.0) - ${box / 2}.0;
          p.y += uPlayer.y * 0.6;
          float a = tt * 2.3, b = tt * 1.7;
          vec3 q = position;
          q = vec3(q.x * cos(a) - q.z * sin(a), q.y, q.x * sin(a) + q.z * cos(a));
          q = vec3(q.x, q.y * cos(b) - q.z * sin(b), q.y * sin(b) + q.z * cos(b));
          vec3 transformed = p + q;
          vC = aOff.w < 0.4 ? vec3(0.85, 0.62, 0.25) : aOff.w < 0.75 ? vec3(0.55, 0.65, 0.25) : vec3(0.75, 0.42, 0.22);`);
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vC;")
        .replace("#include <color_fragment>", `#include <color_fragment>
          vec2 e = vUv * 2.0 - 1.0; if (dot(e * vec2(1.0, 0.65), e * vec2(1.0, 0.65)) > 0.55) discard; diffuseColor.rgb = vC;`);
    };
    m.defines = { USE_UV: "" };
    const mesh = new THREE.Mesh(geo, m); mesh.frustumCulled = false; group.add(mesh);
  }

  // ------------------------------------------------------------ collision helpers
  const cell = 30, grid = new Map();
  const key = (i, j) => i * 10007 + j;
  trees.forEach(t => { const k = key(Math.floor(t.x / cell), Math.floor(t.z / cell)); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(t); });

  /** Pushes pos (Vector3) out of tree trunks. Only below the canopy. */
  function collide(pos, radius) {
    const ci = Math.floor(pos.x / cell), cj = Math.floor(pos.z / cell);
    for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) {
      const list = grid.get(key(i, j)); if (!list) continue;
      for (const t of list) {
        if (pos.y > t.y + t.h * 0.85) continue;
        const dx = pos.x - t.x, dz = pos.z - t.z, d = Math.hypot(dx, dz), min = radius + t.r * 1.3;
        if (d < min && d > 1e-4) { pos.x = t.x + dx / d * min; pos.z = t.z + dz / d * min; }
      }
    }
  }

  return {
    trees,
    collide,
    update(dt, camera) {
      for (const s of mists) s.position.x += s.userData.v * dt;
    },
  };
}
