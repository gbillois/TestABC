// Visual effects: cartoon dust clouds, falling moss debris, golden sparkles, light beams,
// shock rings and the glowing flight trails. All pooled, nothing is allocated during play.
import * as THREE from "three";
import { SHARED, dabTexture, glowTexture, puffTexture, blobGeometry, paintMaterial, groundHeight, rng, col, TAU, lerp } from "./commun.js";
import { CONFIG } from "./config.js";

// ------------------------------------------------------------------ billboard particle pool
function particlePool(scene, max, { additive = false, cartoon = false } = {}) {
  const geo = new THREE.InstancedBufferGeometry();
  const q = new THREE.PlaneGeometry(1, 1);
  geo.index = q.index; geo.attributes.position = q.attributes.position; geo.attributes.uv = q.attributes.uv;
  const aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage); // xyz + size
  const aCol = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage); // rgb + alpha
  geo.setAttribute("aPos", aPos); geo.setAttribute("aCol", aCol); geo.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { uMap: { value: additive ? glowTexture() : cartoon ? puffTexture() : dabTexture() } },
    vertexShader: `attribute vec4 aPos, aCol; varying vec2 vUv; varying vec4 vC; varying float vR;
      void main(){ vUv = uv; vC = aCol; vR = fract(aPos.x * 0.37 + aPos.z * 0.71);
        vec4 mv = viewMatrix * vec4(aPos.xyz, 1.0);
        float a = vR * 6.2831; vec2 p = mat2(cos(a), -sin(a), sin(a), cos(a)) * position.xy;
        mv.xy += p * aPos.w; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D uMap; varying vec2 vUv; varying vec4 vC; varying float vR;
      void main(){ vec4 t = texture2D(uMap, vUv);
        ${cartoon
          ? `float a = t.a * min(vC.a * 1.6, 1.0);
             if (a < 0.03) discard; gl_FragColor = vec4(vC.rgb * t.rgb * 0.95, a);`
          : `gl_FragColor = vec4(vC.rgb * t.a * vC.a, t.a * vC.a);`}
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = additive ? 5 : 4;
  scene.add(mesh);
  const parts = [];
  return {
    spawn(p) { if (parts.length < max) parts.push(p); },
    update(dt) {
      let n = 0;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.age += dt;
        if (p.age >= p.life) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
        p.vel.y -= (p.grav ?? 0) * dt; p.vel.multiplyScalar(Math.exp(-(p.drag ?? 1.5) * dt));
        p.pos.addScaledVector(p.vel, dt);
        const k = p.age / p.life;
        const size = lerp(p.s0, p.s1, 1 - (1 - k) * (1 - k));
        aPos.setXYZW(n, p.pos.x, p.pos.y, p.pos.z, size);
        aCol.setXYZW(n, p.c.r, p.c.g, p.c.b, (p.a ?? 1) * (k < 0.1 ? k / 0.1 : 1 - (k - 0.1) / 0.9));
        n++;
      }
      geo.instanceCount = n; aPos.needsUpdate = aCol.needsUpdate = true;
    },
  };
}

// ------------------------------------------------------------------ flight trail (camera-facing ribbon)
function trail(scene, n = 70, width = 0.9, color = "#ffe2a0") {
  const pos = new Float32Array(n * 2 * 3), a = new Float32Array(n * 2);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("aA", new THREE.BufferAttribute(a, 1));
  const idx = []; for (let i = 0; i < n - 1; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } geo.setIndex(idx);
  for (let i = 0; i < n; i++) { a[i * 2] = a[i * 2 + 1] = 1 - i / (n - 1); }
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uC: { value: col(color) }, uO: { value: 0 } },
    vertexShader: "attribute float aA; varying float vA; void main(){ vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "uniform vec3 uC; uniform float uO; varying float vA; void main(){ gl_FragColor = vec4(uC * 1.25 * vA * vA * vA * uO, 1.0); }",
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 6; scene.add(mesh);
  const hist = Array.from({ length: n }, () => new THREE.Vector3());
  let primed = false;
  const side = new THREE.Vector3(), dir = new THREE.Vector3(), toCam = new THREE.Vector3();
  return {
    update(head, camera, on, dt) {
      if (!primed) { hist.forEach(h => h.copy(head)); primed = true; }
      mat.uniforms.uO.value = lerp(mat.uniforms.uO.value, on ? 1 : 0, 1 - Math.exp(-4 * dt));
      for (let i = n - 1; i > 0; i--) hist[i].lerp(hist[i - 1], Math.min(1, dt * 26));
      hist[0].copy(head);
      for (let i = 0; i < n; i++) {
        const p = hist[i], q = hist[Math.min(i + 1, n - 1)];
        dir.subVectors(p, q); if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
        toCam.subVectors(camera.position, p);
        side.crossVectors(dir, toCam).normalize().multiplyScalar(width * (1 - i / n));
        pos.set([p.x + side.x, p.y + side.y, p.z + side.z, p.x - side.x, p.y - side.y, p.z - side.z], i * 6);
      }
      geo.attributes.position.needsUpdate = true;
    },
    reset() { primed = false; },
  };
}

// ------------------------------------------------------------------ all effects
export function createEffects(scene) {
  const r = rng(99);
  const dust = particlePool(scene, 700, { cartoon: true });
  const light = particlePool(scene, 500, { additive: true });

  // debris: little moss and earth lumps that fall off the keeper
  const debGeo = blobGeometry(1, 0.4, 5);
  const debMat = paintMaterial({ color: "#6f8f34", brush: 0.5, patches: [{ color: "#5a4632", scale: 2, threshold: 0.5 }] });
  const DMAX = 220, deb = new THREE.InstancedMesh(debGeo, debMat, DMAX); deb.count = 0; deb.castShadow = true; scene.add(deb);
  const debris = [];
  const M = new THREE.Matrix4(), Qt = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3();

  // light beams (launch) and shock rings (impact, launch)
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uO: { value: 0 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform float uO; varying vec2 vUv;
      void main(){ float s = sin(vUv.x * 6.2831 * 7.0) * 0.5 + 0.5; s = pow(s, 6.0);
        float v = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
        gl_FragColor = vec4(vec3(1.0, 0.78, 0.38) * 1.5 * s * v * uO, 1.0); }`,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(6, 9, 160, 48, 1, true), beamMat); beam.visible = false; scene.add(beam);
  const ringMat = new THREE.MeshBasicMaterial({ color: "#fff1cf", transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const rings = Array.from({ length: 4 }, () => { const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 64), ringMat.clone()); m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); return m; });

  const trails = [trail(scene, 80, 0.55, "#ffd890"), trail(scene, 80, 0.55, "#ffd890"), trail(scene, 60, 1.4, "#fff1d0")];
  let beamT = -1, beamPos = new THREE.Vector3();

  const dustCol = col("#e3c59a"), dustCol2 = col("#d2ad80");

  const api = {
    /** Cartoon dust cloud on the ground. */
    dust(pos, amount = 20, radius = 3, up = 2) {
      for (let i = 0; i < amount; i++) {
        const a = r() * TAU, d = r() * radius;
        const p = new THREE.Vector3(pos.x + Math.cos(a) * d, 0, pos.z + Math.sin(a) * d); p.y = Math.max(pos.y, groundHeight(p.x, p.z)) + 0.5;
        dust.spawn({ pos: p, vel: new THREE.Vector3(Math.cos(a) * (2 + r() * 6) * radius * 0.25, r() * up, Math.sin(a) * (2 + r() * 6) * radius * 0.25),
          s0: 1 + r() * 1.5, s1: 3 + r() * 4 * (radius / 3), life: 1.0 + r() * 1.4, c: r() < 0.5 ? dustCol : dustCol2, drag: 2.2, grav: -0.6 });
      }
    },
    /** A ring wall of dust (launch / heavy landing), like the film's take-off. */
    dustWall(pos, radius = 8, amount = 90) {
      for (let i = 0; i < amount; i++) {
        const a = i / amount * TAU + r() * 0.1;
        const p = new THREE.Vector3(pos.x + Math.cos(a) * radius * 0.4, 0, pos.z + Math.sin(a) * radius * 0.4); p.y = groundHeight(p.x, p.z) + 0.5 + r() * 2;
        dust.spawn({ pos: p, vel: new THREE.Vector3(Math.cos(a) * (14 + r() * 14), 1 + r() * 5, Math.sin(a) * (14 + r() * 14)),
          s0: 2.5, s1: 7 + r() * 7, life: 1.6 + r() * 1.2, c: r() < 0.5 ? dustCol : dustCol2, drag: 1.8, grav: -0.3 });
      }
    },
    /** Moss / earth chunks falling from a point. */
    debris(pos, amount = 12, spread = 3, speed = 4) {
      for (let i = 0; i < amount && debris.length < DMAX; i++) {
        debris.push({ p: pos.clone().add(new THREE.Vector3((r() - 0.5) * spread, (r() - 0.5) * spread, (r() - 0.5) * spread)),
          v: new THREE.Vector3((r() - 0.5) * speed, r() * speed * 0.6, (r() - 0.5) * speed), s: 0.12 + r() * 0.28, rot: r() * TAU, life: 3 + r() * 2 });
      }
    },
    /** Golden sparkles. */
    sparkle(pos, amount = 20, spread = 2, speed = 4, color = "#ffd27a", size = 1.2) {
      const c = col(color);
      for (let i = 0; i < amount; i++) {
        const v = new THREE.Vector3(r() - 0.5, r() - 0.3, r() - 0.5).normalize().multiplyScalar(speed * (0.3 + r()));
        light.spawn({ pos: pos.clone().add(new THREE.Vector3((r() - 0.5) * spread, (r() - 0.5) * spread, (r() - 0.5) * spread)), vel: v,
          s0: size * (0.6 + r()), s1: 0.05, life: 0.7 + r() * 0.9, c, drag: 1.2, grav: -1.5, a: 1.4 });
      }
    },
    /** Pillar of golden light at take-off. */
    beams(pos) { beamPos.copy(pos); beamT = 0; beam.visible = true; },
    /** Expanding ring on the ground. */
    shock(pos, size = 30, life = 0.8) {
      const m = rings.find(x => !x.visible) || rings[0];
      m.visible = true; m.position.set(pos.x, groundHeight(pos.x, pos.z) + 0.3, pos.z); m.userData = { t: 0, size, life };
    },
    trails,
    update(dt, camera, keeper, flying, boosting) {
      dust.update(dt); light.update(dt);
      // debris physics with ground bounce
      let n = 0;
      for (let i = debris.length - 1; i >= 0; i--) {
        const d = debris[i]; d.life -= dt;
        if (d.life <= 0) { debris[i] = debris[debris.length - 1]; debris.pop(); continue; }
        d.v.y -= 22 * dt; d.p.addScaledVector(d.v, dt); d.rot += dt * 4;
        const g = groundHeight(d.p.x, d.p.z) + d.s * 0.5;
        if (d.p.y < g) { d.p.y = g; d.v.y *= -0.3; d.v.x *= 0.6; d.v.z *= 0.6; }
        Qt.setFromEuler(E.set(d.rot, d.rot * 0.7, 0));
        M.compose(d.p, Qt, S.setScalar(d.s * Math.min(1, d.life))); deb.setMatrixAt(n++, M);
      }
      deb.count = n; deb.instanceMatrix.needsUpdate = true;
      // beams
      if (beamT >= 0) {
        beamT += dt;
        const k = beamT / 1.8;
        beam.position.set(beamPos.x, beamPos.y + 70, beamPos.z);
        beam.scale.set(1 + k * 0.6, 1, 1 + k * 0.6); beam.rotation.y += dt * 0.3;
        beamMat.uniforms.uO.value = Math.sin(Math.min(k, 1) * Math.PI) * 1.0;
        if (k >= 1) { beamT = -1; beam.visible = false; }
      }
      for (const m of rings) {
        if (!m.visible) continue;
        const u = m.userData; u.t += dt; const k = u.t / u.life;
        m.scale.setScalar(2 + u.size * (1 - (1 - k) * (1 - k))); m.material.opacity = (1 - k) * 0.55;
        if (k >= 1) m.visible = false;
      }
      // trails: from both feet + a soft wake behind the chest
      const P = keeper.points;
      trails[0].update(P.footL, camera, flying, dt);
      trails[1].update(P.footR, camera, flying, dt);
      trails[2].update(P.chest, camera, flying && boosting, dt);
    },
  };
  return api;
}
