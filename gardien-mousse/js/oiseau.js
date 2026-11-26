// The little blue bird: perched on the sleeping keeper, it flies off when the keeper wakes,
// then follows it around and comes back to perch when the keeper stands still.
import * as THREE from "three";
import { paintMaterial, outlineMaterial, damp, lerp, TAU, SHARED } from "./commun.js";

export function createBird(scene) {
  const blue = paintMaterial({ color: "#4f86c9", brush: 0.3, rim: "#ffe2a8", patches: [{ color: "#2f5c9a", scale: 3, threshold: 0.6 }] });
  const white = paintMaterial({ color: "#f3efe6", brush: 0.2 });
  const dark = new THREE.MeshBasicMaterial({ color: "#1d1a22" });
  const line = outlineMaterial(0.025);
  const bird = new THREE.Group(); scene.add(bird);
  const inner = new THREE.Group(); bird.add(inner); inner.scale.setScalar(0.55);
  const add = (geo, mat, p, s = [1, 1, 1], o = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(...p); m.scale.set(...s); m.castShadow = true; inner.add(m); if (o) m.add(new THREE.Mesh(geo, line)); return m; };
  const sph = new THREE.SphereGeometry(1, 16, 12);
  add(sph, blue, [0, 0, 0], [0.55, 0.5, 0.8]);
  add(sph, white, [0, -0.12, 0.18], [0.45, 0.38, 0.55], false);
  const head = add(sph, blue, [0, 0.42, 0.55], [0.38, 0.36, 0.38]);
  add(new THREE.ConeGeometry(0.09, 0.3, 8).rotateX(Math.PI / 2), dark, [0, 0.4, 0.98], [1, 1, 1], false);
  add(sph, dark, [0.22, 0.5, 0.78], [0.06, 0.07, 0.04], false); add(sph, dark, [-0.22, 0.5, 0.78], [0.06, 0.07, 0.04], false);
  add(new THREE.BoxGeometry(0.4, 0.05, 0.7), blue, [0, 0.05, -0.85], [1, 1, 1]).rotation.x = 0.35;
  const wingGeo = new THREE.SphereGeometry(1, 12, 8); wingGeo.scale(0.75, 0.08, 0.42); wingGeo.translate(0.7, 0, 0);
  const wL = new THREE.Group(), wR = new THREE.Group(); wL.position.set(0.35, 0.15, 0); wR.position.set(-0.35, 0.15, 0); inner.add(wL, wR);
  const a = new THREE.Mesh(wingGeo, blue); a.add(new THREE.Mesh(wingGeo, line)); wL.add(a);
  const b = new THREE.Mesh(wingGeo, blue); b.add(new THREE.Mesh(wingGeo, line)); b.rotation.y = Math.PI; wR.add(b);
  for (const x of [0.15, -0.15]) add(new THREE.CylinderGeometry(0.025, 0.025, 0.35), dark, [x, -0.55, 0.05], [1, 1, 1], false);

  let mode = "perch", t0 = 0, peck = 0;
  const vel = new THREE.Vector3(), target = new THREE.Vector3(), look = new THREE.Vector3();
  bird.position.set(0, 12, 0);

  return {
    object: bird,
    flyAway() { if (mode === "perch") { mode = "away"; t0 = SHARED.uTime.value; vel.set(4, 10, 6); } },
    /** perch: world point to sit on; keeperPos: keeper position; still: keeper is not moving */
    update(dt, perch, keeperPos, still, awake) {
      const t = SHARED.uTime.value;
      if (mode === "perch") {
        bird.position.lerp(perch, damp(20, dt));
        peck -= dt; if (peck < -2 - Math.random() * 3) peck = 0.35;
        head.rotation.x = peck > 0 ? 0.6 : 0; head.rotation.y = Math.sin(t * 0.8) * 0.6;
        wL.rotation.z = lerp(wL.rotation.z, -0.1, damp(10, dt)); wR.rotation.z = -wL.rotation.z;
        inner.position.y = 0.3;
        if (awake && !still) { mode = "follow"; vel.set(0, 6, 0); }
        return;
      }
      // flying: steer towards a target, flap
      if (mode === "away") {
        target.set(keeperPos.x + 30, keeperPos.y + 30, keeperPos.z + 22);
        if (t - t0 > 6) mode = "follow";
      } else {
        const a = t * 0.5;
        target.set(keeperPos.x + Math.cos(a) * 12, keeperPos.y + 17 + Math.sin(t * 0.9) * 2, keeperPos.z + Math.sin(a) * 12);
        if (still && awake && bird.position.distanceTo(perch) < 6) target.copy(perch);
        if (still && awake && bird.position.distanceTo(perch) < 0.8) { mode = "perch"; return; }
        if (still && awake) target.lerp(perch, 0.7);
      }
      const desired = target.clone().sub(bird.position);
      const far = desired.length();
      desired.normalize().multiplyScalar(Math.min(60, 8 + far * 1.4));
      vel.lerp(desired, damp(2.5, dt));
      bird.position.addScaledVector(vel, dt);
      look.copy(bird.position).add(vel);
      bird.lookAt(look);
      const flap = Math.sin(t * 22) * 0.9;
      wL.rotation.z = flap; wR.rotation.z = -flap; head.rotation.set(0, 0, 0); inner.position.y = 0;
    },
  };
}
