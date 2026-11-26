// Goals: golden seeds hidden in the forest (some on the canopy, reachable only by flying)
// and rings of light above the clouds. Counts and heights are in config.js (CONFIG.goals).
import * as THREE from "three";
import { CONFIG } from "./config.js";
import { glowTexture, groundHeight, rng, TAU, SHARED } from "./commun.js";

export function createGoals(scene, trees) {
  const G = CONFIG.goals, r = rng(CONFIG.world.seed + 7);
  const list = [];

  // ---- seeds
  const seedGeo = new THREE.SphereGeometry(0.9, 18, 14); seedGeo.scale(1, 1.4, 1);
  const seedMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffcf6a").multiplyScalar(2.4) });
  const haloMat = new THREE.SpriteMaterial({ map: glowTexture(), color: "#ffc860", blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 });
  const sorted = trees.slice().sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
  for (let i = 0; i < G.seeds; i++) {
    const high = i % 2 === 1;                               // every other seed sits on top of a tree
    const t = sorted[Math.floor((0.08 + 0.85 * (i / G.seeds) + r() * 0.05) * sorted.length)];
    const a = r() * TAU;
    const pos = high
      ? new THREE.Vector3(t.x, t.y + t.h * 1.06 + 4, t.z)
      : new THREE.Vector3(t.x + Math.cos(a) * 8, 0, t.z + Math.sin(a) * 8);
    if (!high) pos.y = groundHeight(pos.x, pos.z) + 3.2;
    const g = new THREE.Group(); g.position.copy(pos);
    g.add(new THREE.Mesh(seedGeo, seedMat));
    const halo = new THREE.Sprite(haloMat); halo.scale.setScalar(9); g.add(halo);
    const light = new THREE.PointLight("#ffc260", 30, 26, 1.5); g.add(light);
    scene.add(g);
    list.push({ kind: "seed", obj: g, pos, radius: 6.5, done: false, ph: r() * TAU });
  }

  // ---- rings above the clouds, in a loose loop
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffe1a0").multiplyScalar(2.2) });
  const ringGeo = new THREE.TorusGeometry(G.ringRadius, 0.7, 12, 64);
  for (let i = 0; i < G.rings; i++) {
    const a = i / G.rings * TAU + 0.6, d = 260 + r() * 160;
    const pos = new THREE.Vector3(Math.cos(a) * d, G.ringAltitude[0] + r() * (G.ringAltitude[1] - G.ringAltitude[0]), Math.sin(a) * d);
    const g = new THREE.Group(); g.position.copy(pos);
    g.add(new THREE.Mesh(ringGeo, ringMat));
    const halo = new THREE.Sprite(haloMat); halo.scale.setScalar(G.ringRadius * 3.2); halo.material = haloMat.clone(); halo.material.opacity = 0.35; g.add(halo);
    g.lookAt(Math.cos(a + 1.2) * d, pos.y, Math.sin(a + 1.2) * d);   // face along the loop
    scene.add(g);
    list.push({ kind: "ring", obj: g, pos, radius: G.ringRadius, done: false, ph: r() * TAU });
  }

  const tmp = new THREE.Vector3(), seg = new THREE.Line3();
  const distToSegment = (p, a, b) => { seg.set(a, b); seg.closestPointToPoint(p, true, tmp); return tmp.distanceTo(p); };
  return {
    list,
    get found() { return list.filter(x => x.done).length; },
    get total() { return list.length; },
    /** Calls onCollect(goal) when the keeper's body (segment from its feet to its chest) touches a goal. */
    update(dt, feet, chest, onCollect) {
      const t = SHARED.uTime.value;
      for (const g of list) {
        if (g.done) {
          g.obj.scale.multiplyScalar(Math.exp(-6 * dt));
          if (g.obj.scale.x < 0.02) g.obj.visible = false;
          continue;
        }
        if (g.kind === "seed") { g.obj.position.y = g.pos.y + Math.sin(t * 1.6 + g.ph) * 0.6; g.obj.rotation.y += dt; }
        else g.obj.rotateZ(dt * 0.4);
        const d = distToSegment(g.obj.position, feet, chest);
        if (d < g.radius + (g.kind === "seed" ? 4 : 2)) { g.done = true; onCollect(g); }
      }
    },
    nearest(p) {
      let best = null, bd = Infinity;
      for (const g of list) { if (g.done) continue; const d = p.distanceTo(g.pos); if (d < bd) { bd = d; best = g; } }
      return best ? { goal: best, dist: bd } : null;
    },
  };
}
