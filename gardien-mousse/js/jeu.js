// Le Gardien de Mousse: the game loop.
// States: "title" -> "sleep" (hold to wake) -> "wake" (cinematic) -> "play" (walk, jump, fly).
// Controls are listed in index.html; tunable values are in config.js.
import * as THREE from "three";
import { CONFIG } from "./config.js";
import { SHARED, SUN_DIR, groundHeight, damp, lerp, clamp, smooth, TAU } from "./commun.js";
import { createSky } from "./ciel.js";
import { createForest } from "./foret.js";
import { createClouds } from "./nuages.js";
import { createKeeper } from "./gardien.js";
import { createBird } from "./oiseau.js";
import { createEffects } from "./effets.js";
import { createGoals } from "./objectifs.js";
import { createPost } from "./post.js";
import { Sound } from "./son.js";

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const coarse = matchMedia("(pointer: coarse)").matches;
let qualityName = params.get("q") || localStorage.getItem("gardien-q") || (coarse ? "moyenne" : "haute");
if (!CONFIG.quality[qualityName]) qualityName = "haute";
SHARED.quality = CONFIG.quality[qualityName];
const MV = CONFIG.move;

// ======================================================================= renderer, scene, lights
const canvas = $("c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(CONFIG.fog.color, CONFIG.fog.densityForest);
const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 1, 0.5, 9000);

const sun = new THREE.DirectionalLight(CONFIG.sun.color, CONFIG.sun.intensity);
sun.castShadow = true;
const sh = sun.shadow; sh.mapSize.set(SHARED.quality.shadows, SHARED.quality.shadows);
Object.assign(sh.camera, { left: -CONFIG.sun.shadowSize, right: CONFIG.sun.shadowSize, top: CONFIG.sun.shadowSize, bottom: -CONFIG.sun.shadowSize, near: 1, far: 600 });
sh.bias = -0.0004; sh.normalBias = 0.06;
scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight(CONFIG.sun.skyFill, CONFIG.sun.groundFill, CONFIG.sun.fillIntensity));

const post = createPost(renderer);
function resize() {
  const ratio = Math.min(window.devicePixelRatio || 1, SHARED.quality.pixelRatio);
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(ratio); renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  post.setSize(Math.floor(w * ratio), Math.floor(h * ratio));
}
addEventListener("resize", resize);

// ======================================================================= world
const setProgress = (p, txt) => { $("barre").firstElementChild.style.width = `${p * 100}%`; if (txt) $("chargeTxt").textContent = txt; };
const frame = () => new Promise(r => requestAnimationFrame(() => r()));
let sky, forest, clouds, keeper, bird, fx, goals;
async function build() {
  setProgress(0.1, "Le ciel se lève…"); await frame();
  sky = createSky(scene);
  setProgress(0.25, "La forêt pousse…"); await frame();
  forest = createForest(scene);
  setProgress(0.5, "Les nuages s'assemblent…"); await frame();
  clouds = createClouds(scene);
  setProgress(0.65, "La mousse recouvre le gardien…"); await frame();
  keeper = createKeeper(scene);
  bird = createBird(scene);
  fx = createEffects(scene);
  goals = createGoals(scene, forest.trees);
  setProgress(0.85, "Préparation des couleurs…"); await frame();
  resize();
  placeCamera(0.016, true);
  renderer.compile(scene, camera);
  post.render(scene, camera);
  setProgress(1); await frame();
}

// ======================================================================= player state
const P = {
  pos: new THREE.Vector3(0, 0, 0), vel: new THREE.Vector3(), yaw: Math.atan2(CONFIG.sun.direction[0], CONFIG.sun.direction[2]) - Math.PI,
  mode: "sleep",           // sleep | wake | ground | air | fly
  charge: 0, wakeT: 0, crouch: 0, crouchT: 0, pending: null, speedAnim: 0, turn: 0, lean: 0, climb: 0, boost: false,
  airTime: 0, landHard: 0,
};
let state = "title";
const cam = { yaw: P.yaw + Math.PI, pitch: 0.12, dist: CONFIG.camera.ground.dist, target: new THREE.Vector3(), lastDrag: -10, shake: 0, fovKick: 0 };

// ======================================================================= input
const keys = new Set();
let jumpPressed = false, flyPressed = false;
addEventListener("keydown", e => {
  if (e.repeat) { if (["Space", "ArrowUp", "ArrowDown"].includes(e.code)) e.preventDefault(); return; }
  keys.add(e.code);
  if (e.code === "Space") { jumpPressed = true; e.preventDefault(); }
  if (e.code === "KeyF" || e.code === "KeyE") flyPressed = true;
  if (e.code === "Escape" || e.code === "KeyP") togglePause();
  if (e.code === "KeyM") toggleSound();
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
});
addEventListener("keyup", e => keys.delete(e.code));
addEventListener("blur", () => keys.clear());
const k = (...c) => c.some(x => keys.has(x));

// mouse / touch drag on the canvas turns the camera; on touch, the left half is a joystick
const joy = { id: null, x0: 0, y0: 0, x: 0, y: 0 };
const look = { id: null, x: 0, y: 0 };
canvas.addEventListener("pointerdown", e => {
  if (e.pointerType === "touch" && e.clientX < innerWidth * 0.45 && joy.id === null) {
    joy.id = e.pointerId; joy.x0 = e.clientX; joy.y0 = e.clientY; joy.x = joy.y = 0;
    const el = $("joy"); el.style.display = "block"; el.style.left = e.clientX + "px"; el.style.top = e.clientY + "px";
  } else if (look.id === null) { look.id = e.pointerId; look.x = e.clientX; look.y = e.clientY; }
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", e => {
  if (e.pointerId === joy.id) {
    const dx = e.clientX - joy.x0, dy = e.clientY - joy.y0, l = Math.hypot(dx, dy), m = Math.min(l, 55) / (l || 1);
    joy.x = dx * m / 55; joy.y = dy * m / 55;
    $("joy").firstElementChild.style.transform = `translate(${dx * m}px, ${dy * m}px)`;
  } else if (e.pointerId === look.id) {
    const s = CONFIG.camera.mouseSensitivity * (e.pointerType === "touch" ? 1.6 : 1);
    cam.yaw -= (e.clientX - look.x) * s; cam.pitch = clamp(cam.pitch + (e.clientY - look.y) * s, -0.35, 1.2);
    look.x = e.clientX; look.y = e.clientY; cam.lastDrag = SHARED.uTime.value;
  }
});
const endPointer = e => {
  if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; $("joy").style.display = "none"; $("joy").firstElementChild.style.transform = ""; }
  if (e.pointerId === look.id) look.id = null;
};
canvas.addEventListener("pointerup", endPointer); canvas.addEventListener("pointercancel", endPointer);
canvas.addEventListener("wheel", e => { cam.dist = clamp(cam.dist * (1 + Math.sign(e.deltaY) * 0.08), 24, 120); e.preventDefault(); }, { passive: false });

// touch buttons: hold = key down
const holdBtn = (id, code, onPress) => {
  const b = $(id);
  b.addEventListener("pointerdown", e => { e.preventDefault(); keys.add(code); onPress && onPress(); b.classList.add("actif"); });
  const up = () => { keys.delete(code); b.classList.remove("actif"); };
  b.addEventListener("pointerup", up); b.addEventListener("pointerleave", up); b.addEventListener("pointercancel", up);
};
holdBtn("bSaut", "Space", () => { jumpPressed = true; });
holdBtn("bVol", "KeyF", () => { flyPressed = true; });
holdBtn("bTurbo", "ShiftLeft");
holdBtn("bBas", "KeyC");

/** Move input in [-1,1]: x = right, y = forward */
function moveInput() {
  let x = 0, y = 0;
  if (k("KeyW", "KeyZ", "ArrowUp")) y += 1;
  if (k("KeyS", "ArrowDown")) y -= 1;
  if (k("KeyD", "ArrowRight")) x += 1;
  if (k("KeyA", "KeyQ", "ArrowLeft")) x -= 1;
  x += joy.x; y -= joy.y;
  const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
  return { x, y };
}

// ======================================================================= HUD helpers
let toastTimer = 0;
function toast(msg, sec = 2.5) { const t = $("toast"); t.innerHTML = msg; t.style.opacity = 1; toastTimer = sec; }
function setHelp(txt) { if ($("aide").dataset.t !== txt) { $("aide").dataset.t = txt; $("aide").innerHTML = txt; } }
function updateHud() {
  const seeds = goals.list.filter(g => g.kind === "seed"), rings = goals.list.filter(g => g.kind === "ring");
  $("nbGraines").textContent = `${seeds.filter(g => g.done).length}/${seeds.length}`;
  $("nbAnneaux").textContent = `${rings.filter(g => g.done).length}/${rings.length}`;
  const n = goals.nearest(P.pos);
  if (n) {
    const dx = n.goal.pos.x - P.pos.x, dz = n.goal.pos.z - P.pos.z;
    const ang = Math.atan2(dx, dz) - cam.yaw;
    $("fleche").style.transform = `rotate(${-ang}rad)`;
    const dy = n.goal.pos.y - P.pos.y;
    $("objDist").textContent = `${Math.round(n.dist)} m${dy > 25 ? " · en haut ↑" : ""}`;
  } else { $("objDist").textContent = "tout est trouvé !"; }
}

// ======================================================================= pause / sound / screens
let paused = false;
function show(id, on) { $(id).classList.toggle("cache", !on); }
function togglePause(force) {
  if (state === "title") return;
  paused = force ?? !paused; show("pause", paused); show("reglages", false);
}
function toggleSound() { Sound.setMuted(!Sound.muted); $("bSon").innerHTML = `<svg><use href="#i-${Sound.muted ? "muet" : "son"}"/></svg>`; }
$("bSon").onclick = toggleSound;
$("bPause").onclick = () => togglePause(true);
$("bReprendre").onclick = () => togglePause(false);
$("bReglages").onclick = () => { show("reglages", true); };
$("bFermerReglages").onclick = () => show("reglages", false);
$("bRejouer").onclick = () => location.reload();
$("bContinuer").onclick = () => { show("victoire", false); paused = false; };
for (const b of $("cQualite").querySelectorAll("button")) {
  b.classList.toggle("on", b.dataset.v === qualityName);
  b.onclick = () => { localStorage.setItem("gardien-q", b.dataset.v); location.reload(); };
}
$("bJouer").onclick = () => {
  Sound.start();
  show("titre", false); show("hud", true);
  state = "sleep"; P.mode = "sleep";
  setHelp(coarse ? "Maintiens le bouton ▲ pour réveiller le gardien" : "Maintiens <b>Espace</b> pour réveiller le gardien");
  toast("Le gardien dort depuis cent ans…<br>Réveille-le !", 3.5);
};

// ======================================================================= game logic
const fwd = new THREE.Vector3(), right = new THREE.Vector3(), wish = new THREE.Vector3(), tmp = new THREE.Vector3();
let wakeEvents = {};

function startWake() {
  state = "wake"; P.mode = "wake"; P.wakeT = 0; wakeEvents = {};
  Sound.wake(); bird.flyAway();
  setHelp("");
}

function updateSleep(dt) {
  const holding = k("Space");
  P.charge = clamp(P.charge + (holding ? dt / MV.wakeHold : -dt * 0.8));
  Sound.setHum(P.charge);
  if (holding && Math.random() < dt * 14) fx.debris(keeper.points.head.clone().add(tmp.set(0, 2, 0)), 1, 6, 2);
  cam.shake = Math.max(cam.shake, P.charge * 0.25);
  $("eveil").style.width = `${P.charge * 100}%`; show("eveilBox", P.charge > 0.01);
  jumpPressed = flyPressed = false;
  if (P.charge >= 1) { show("eveilBox", false); startWake(); }
  return { mode: "sleep", stir: P.charge, glow: P.charge * 0.55, fan: P.charge * 2 };
}

const WAKE_LEN = 8.5;
function updateWake(dt) {
  P.wakeT += dt;
  const w = clamp(P.wakeT / WAKE_LEN), t = P.wakeT;
  const once = (name, at, fn) => { if (t >= at && !wakeEvents[name]) { wakeEvents[name] = 1; fn(); } };
  once("flash", 0.0, () => { fx.sparkle(keeper.points.chest, 40, 1.5, 6); cam.shake = 0.4; });
  once("shed1", 1.4, () => { fx.debris(keeper.points.head, 40, 6, 5); fx.dust(P.pos, 20, 6, 2); Sound.thump(); cam.shake = 0.5; });
  once("rise", 3.6, () => { fx.debris(keeper.points.chest, 70, 8, 6); fx.dust(P.pos, 40, 9, 3); Sound.thump(); cam.shake = 0.8; });
  once("stand", 5.6, () => { fx.dust(P.pos, 30, 8, 2); Sound.step(); });
  once("stretch", 6.2, () => { fx.sparkle(keeper.points.fanL, 25, 1, 5); fx.sparkle(keeper.points.fanR, 25, 1, 5); fx.debris(keeper.points.handL, 15, 3, 4); fx.debris(keeper.points.handR, 15, 3, 4); });
  Sound.setHum(1 - smooth(0.6, 1, w));
  jumpPressed = flyPressed = false;
  if (w >= 1) {
    state = "play"; P.mode = "ground";
    setHelp(coarse ? "Joystick : marcher · ▲ sauter · ✈ voler · glisser à droite : regarder"
      : "ZQSD / flèches : marcher · Maj : courir · Espace : sauter · <b>F : s'envoler</b> · souris : regarder");
    toast("Trouve les 6 graines d'or dans la forêt<br>et les 6 anneaux de lumière au-dessus des nuages", 5);
  }
  return { mode: "wake", w, glow: smooth(0, 0.12, w), fan: smooth(0.7, 0.85, w) * 3 };
}

function launch() {
  P.mode = "fly"; P.vel.y = 38; P.crouch = 0; P.pending = null;
  fx.dustWall(P.pos, 10, 110); fx.shock(P.pos, 55, 1.0); fx.beams(P.pos); fx.sparkle(keeper.points.chest, 40, 3, 10);
  fx.debris(keeper.points.chest, 30, 6, 8); fx.trails.forEach(t => t.reset());
  Sound.launch(); cam.shake = 1.0; cam.fovKick = 10;
  toast("Envole-toi au-dessus des nuages !", 2);
  setHelp(coarse ? "Joystick : diriger · ▲ monter · ▼ descendre · ⚡ turbo · ✈ atterrir"
    : "Z / ↑ : avancer · Q D : tourner · Espace : monter · C / Ctrl : descendre · Maj : turbo · <b>F : atterrir</b>");
}

function land(hard) {
  P.mode = "ground"; P.airTime = 0;
  P.vel.y = 0;
  const strength = hard ? 1 : 0.5;
  fx.dust(P.pos, hard ? 50 : 22, hard ? 9 : 5, 3); if (hard) { fx.shock(P.pos, 30, 0.7); fx.dustWall(P.pos, 6, 50); }
  Sound.thump(); cam.shake = Math.max(cam.shake, 0.4 + strength * 0.5);
  P.landHard = hard ? 0.55 : 0.3;
  setHelp(coarse ? "Joystick : marcher · ▲ sauter · ✈ voler · glisser à droite : regarder"
    : "ZQSD / flèches : marcher · Maj : courir · Espace : sauter · <b>F : s'envoler</b> · souris : regarder");
}

function updatePlay(dt) {
  const inp = moveInput();
  const run = k("ShiftLeft", "ShiftRight");
  const gy = groundHeight(P.pos.x, P.pos.z);
  fwd.set(Math.sin(cam.yaw), 0, Math.cos(cam.yaw)); right.set(-Math.cos(cam.yaw), 0, Math.sin(cam.yaw));
  let anim;

  if (P.mode === "ground" || P.mode === "air") {
    // ---- walking / jumping
    wish.set(0, 0, 0).addScaledVector(fwd, inp.y).addScaledVector(right, inp.x);
    const sp = (run ? MV.run : MV.walk) * Math.min(1, wish.length());
    if (wish.lengthSq() > 0.001) {
      wish.normalize();
      const targetYaw = Math.atan2(wish.x, wish.z);
      let d = ((targetYaw - P.yaw + Math.PI) % TAU + TAU) % TAU - Math.PI;
      const turn = clamp(d, -MV.turn * dt, MV.turn * dt);
      P.yaw += turn; P.turn = lerp(P.turn, clamp(d * 2, -1, 1), damp(6, dt));
      // heavy body: moves mostly where it faces
      const face = tmp.set(Math.sin(P.yaw), 0, Math.cos(P.yaw));
      const align = Math.max(0, face.dot(wish));
      wish.copy(face).multiplyScalar(sp * (0.25 + 0.75 * align));
    } else { wish.set(0, 0, 0); P.turn = lerp(P.turn, 0, damp(6, dt)); }
    if (P.crouchT > 0 || P.landHard > 0) wish.multiplyScalar(0.15);
    const acc = P.mode === "ground" ? MV.accel : 1.2;
    P.vel.x = lerp(P.vel.x, wish.x, damp(acc, dt)); P.vel.z = lerp(P.vel.z, wish.z, damp(acc, dt));

    // jump / take-off requests (with a crouch before)
    if (P.mode === "ground" && P.crouchT <= 0 && P.landHard <= 0) {
      if (jumpPressed) { P.pending = "jump"; P.crouchT = 0.22; }
      if (flyPressed) { P.pending = "fly"; P.crouchT = MV.takeoffTime; Sound.setHum(0.6); fx.dust(P.pos, 14, 6, 1); }
    } else if (P.mode === "air" && (flyPressed || (jumpPressed && P.airTime > 0.15))) { launch(); }
    if (P.crouchT > 0) {
      P.crouchT -= dt;
      P.crouch = P.pending === "fly" ? smooth(0, 0.6, MV.takeoffTime - P.crouchT) : 0.6;
      if (P.pending === "fly" && Math.random() < dt * 20) { fx.sparkle(keeper.points.chest, 2, 2, 3); fx.debris(keeper.points.chest, 1, 6, 3); }
      cam.shake = Math.max(cam.shake, P.pending === "fly" ? 0.25 : 0);
      if (P.crouchT <= 0) {
        if (P.pending === "jump") { P.mode = "air"; P.vel.y = MV.jump; P.airTime = 0; fx.dust(P.pos, 12, 4, 2); Sound.step(); }
        else if (P.pending === "fly") { Sound.setHum(0); launch(); }
        P.pending = null; P.crouch = 0;
      }
    } else P.crouch = lerp(P.crouch, P.landHard > 0 ? 0.55 : 0, damp(10, dt));
    P.landHard = Math.max(0, P.landHard - dt);

    if (P.mode === "air") {
      P.airTime += dt;
      P.vel.y -= MV.gravity * dt;
      P.pos.addScaledVector(P.vel, dt);
      if (P.pos.y <= gy && P.vel.y < 0) { const hard = P.vel.y < -24; P.pos.y = gy; land(hard); }
    } else if (P.mode === "ground") {
      P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt;
      P.pos.y = groundHeight(P.pos.x, P.pos.z);
    }
    const hs = Math.hypot(P.vel.x, P.vel.z);
    P.speedAnim = hs < MV.walk ? hs / MV.walk : 1 + (hs - MV.walk) / (MV.run - MV.walk);
    anim = P.mode === "ground"
      ? { mode: "ground", speed: P.speedAnim, turn: P.turn, crouch: P.crouch, glow: 1, fan: 1.5 + P.speedAnim }
      : { mode: "air", vy: P.vel.y, crouch: 0, glow: 1, fan: 6 };
    Sound.setThrust(0);
  } else if (P.mode === "fly") {
    // ---- flying: forward thrust, turn, climb / dive, boost
    P.boost = run;
    const turnIn = inp.x;
    P.turn = lerp(P.turn, turnIn, damp(3, dt));
    P.yaw -= P.turn * MV.flyTurn * dt;
    const face = tmp.set(Math.sin(P.yaw), 0, Math.cos(P.yaw));
    const thrust = Math.max(0, inp.y) + (P.boost ? 1 : 0);
    const target = face.multiplyScalar(P.boost ? MV.flyBoost : MV.flyCruise * Math.max(0, inp.y));
    let climb = (k("Space") ? 1 : 0) - (k("KeyC", "ControlLeft", "ControlRight") ? 1 : 0);
    if (inp.y < -0.3) target.multiplyScalar(0);                       // brake: hover in place
    target.y = climb * MV.flyClimb;
    P.climb = lerp(P.climb, climb, damp(3, dt));
    P.vel.lerp(target, damp(MV.flyAccel, dt));
    // soft world limits
    const dist = Math.hypot(P.pos.x, P.pos.z);
    if (dist > CONFIG.world.limit) { P.vel.x -= P.pos.x / dist * 30 * dt; P.vel.z -= P.pos.z / dist * 30 * dt; if (Math.random() < dt) toast("Le gardien ne veut pas quitter sa forêt…", 2); }
    if (P.pos.y > 600) P.vel.y = Math.min(P.vel.y, 0);
    P.pos.addScaledVector(P.vel, dt);
    const hs = Math.hypot(P.vel.x, P.vel.z);
    P.lean = lerp(P.lean, clamp(hs / MV.flyCruise), damp(2, dt));
    if (P.pos.y < gy + 0.2) {
      P.pos.y = gy;
      if (P.vel.y < -4 || (climb < 0 && hs < 15)) land(P.vel.y < -18);
      else P.vel.y = Math.max(P.vel.y, 0);
    }
    if (flyPressed) { P.mode = "air"; P.airTime = 1; toast("Atterrissage…", 1.2); }
    anim = { mode: "fly", lean: P.lean, turn: P.turn, climb: P.climb, boost: P.boost && thrust > 0, glow: 1, fan: 26 + (P.boost ? 20 : 0) };
    Sound.setThrust(clamp(0.3 + hs / MV.flyBoost), P.boost);
    cam.fovKick = Math.max(cam.fovKick, P.boost ? 8 : 0);
    // dust when skimming the ground
    if (P.pos.y - gy < 10 && Math.random() < dt * 30) fx.dust(tmp.copy(P.pos).setY(gy), 2, 3, 1);
  }
  forest.collide(P.pos, 5.5);
  jumpPressed = flyPressed = false;
  return anim;
}

// ======================================================================= camera
function placeCamera(dt, snap = false) {
  const flying = P.mode === "fly";
  const C = flying ? CONFIG.camera.fly : CONFIG.camera.ground;
  const t = SHARED.uTime.value;
  if (state === "title") {
    // debug framing: ?d=distance&a=angle (radians around the keeper)
    cam.yaw = P.yaw + Math.PI + (params.has("a") ? +params.get("a") : 0.35 + Math.sin(t * 0.07) * 0.35); cam.pitch = 0.06; cam.dist = +(params.get("d") || 54);
    cam.target.set(P.pos.x, 11, P.pos.z);
  } else if (state === "wake" || state === "sleep") {
    const w = state === "wake" ? clamp(P.wakeT / WAKE_LEN) : 0;
    const a = smooth(0.0, 1.0, w);
    cam.yaw = P.yaw + Math.PI + 0.55 - a * (Math.PI - 0.55) + (state === "sleep" ? 0.25 * Math.sin(t * 0.1) : 0);
    cam.pitch = lerp(0.1, 0.16, a); cam.dist = lerp(46, CONFIG.camera.ground.dist, a);
    cam.target.lerp(tmp.set(P.pos.x, lerp(9, C.height, a), P.pos.z), snap ? 1 : damp(4, dt));
  } else {
    // follow: auto-swing behind the keeper when the player is not steering the camera
    const idle = t - cam.lastDrag > 1.6;
    const moving = Math.hypot(P.vel.x, P.vel.z) > 2 || flying;
    if (idle && moving) {
      let d = ((P.yaw - cam.yaw + Math.PI) % TAU + TAU) % TAU - Math.PI;
      cam.yaw += d * damp(flying ? 2.2 : 1.0, dt);
      cam.pitch = lerp(cam.pitch, flying ? 0.18 - P.climb * 0.15 : 0.2, damp(1.5, dt));
    }
    const wantDist = flying ? Math.max(cam.dist, C.dist) : cam.dist;
    cam.curDist = lerp(cam.curDist ?? cam.dist, flying ? C.dist + (P.boost ? 10 : 0) : cam.dist, damp(2, dt));
    cam.target.lerp(tmp.set(P.pos.x, P.pos.y + C.height, P.pos.z), snap ? 1 : damp(CONFIG.camera.lag * (flying ? 1.6 : 1), dt));
    if (!flying && state === "play" && cam.dist < CONFIG.camera.ground.dist * 0.5) cam.dist = CONFIG.camera.ground.dist;
    void wantDist;
  }
  const dist = state === "play" ? cam.curDist ?? cam.dist : cam.dist;
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  camera.position.set(cam.target.x - Math.sin(cam.yaw) * dist * cp, cam.target.y + dist * sp, cam.target.z - Math.cos(cam.yaw) * dist * cp);
  const g = groundHeight(camera.position.x, camera.position.z) + 1.5;
  if (camera.position.y < g) camera.position.y = g;
  camera.lookAt(cam.target);
  // shake
  cam.shake = Math.max(0, cam.shake - dt * 1.6);
  const s = cam.shake * cam.shake;
  if (s > 0) { camera.rotation.x += (Math.random() - 0.5) * 0.03 * s; camera.rotation.y += (Math.random() - 0.5) * 0.03 * s; camera.position.y += (Math.random() - 0.5) * 0.6 * s; }
  cam.fovKick = lerp(cam.fovKick, 0, damp(1.5, dt));
  camera.fov = CONFIG.camera.fov + cam.fovKick; camera.updateProjectionMatrix();
}

// ======================================================================= main loop
const clock = new THREE.Clock();
const fogA = new THREE.Color(CONFIG.fog.color), fogB = new THREE.Color(CONFIG.fog.skyColor);
let fpsAcc = 0, fpsN = 0, slowFor = 0;
let won = false;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 1 / 20);
  if (paused) { post.render(scene, camera); return; }
  update(dt);
  post.render(scene, camera);
  measure(dt);
}

function update(dt) {
  SHARED.uTime.value += dt;

  let anim;
  if (state === "title") anim = { mode: "sleep", stir: 0, glow: 0, fan: 0 };
  else if (state === "sleep") anim = updateSleep(dt);
  else if (state === "wake") anim = updateWake(dt);
  else anim = updatePlay(dt);

  keeper.root.position.copy(P.pos);
  keeper.root.rotation.y = P.yaw;
  const res = keeper.update(dt, anim);
  if (res.step) {
    const foot = res.step === "L" ? keeper.points.footL : keeper.points.footR;
    Sound.step(); fx.dust(foot, P.speedAnim > 1 ? 8 : 5, 2.2, 1); cam.shake = Math.max(cam.shake, 0.18 + 0.12 * P.speedAnim);
    if (Math.random() < 0.3) fx.debris(keeper.points.chest, 2, 5, 2);
  }
  SHARED.uPlayer.value.copy(P.pos);

  const still = Math.hypot(P.vel.x, P.vel.z) < 0.5 && P.mode === "ground";
  bird.update(dt, keeper.perch(), P.pos, still, state === "play");

  placeCamera(dt);
  sky.update(dt, camera); forest.update(dt, camera); clouds.update(dt, camera);
  fx.update(dt, camera, keeper, P.mode === "fly", P.boost);

  // sun shadow follows the keeper; fog thins when flying high
  sun.position.copy(P.pos).addScaledVector(SUN_DIR, 250); sun.target.position.copy(P.pos);
  const hi = smooth(40, 160, camera.position.y);
  scene.fog.density = lerp(CONFIG.fog.densityForest, CONFIG.fog.densitySky, hi);
  scene.fog.color.copy(fogA).lerp(fogB, hi);
  Sound.setWind(clamp(hi * 0.6 + (P.mode === "fly" ? Math.hypot(P.vel.x, P.vel.z) / MV.flyBoost * 0.6 : 0)));

  if (state === "play") {
    goals.update(dt, P.pos, keeper.points.chest, g => {
      fx.sparkle(g.obj.position, 60, 3, 12, "#ffd27a", 2); g.kind === "ring" ? Sound.ring() : Sound.chime();
      const f = goals.found, n = goals.total;
      toast(g.kind === "ring" ? `Anneau de lumière ! (${f}/${n})` : `Une graine d'or ! (${f}/${n})`, 2);
      if (f === n && !won) { won = true; setTimeout(() => { show("victoire", true); paused = true; }, 1800); }
    });
    updateHud();
  }
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) $("toast").style.opacity = 0; }
}

// automatic quality drop if the device struggles
function measure(dt) {
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 2) {
    const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0;
    slowFor = fps < 38 ? slowFor + 1 : 0;
    if (slowFor >= 3 && qualityName !== "rapide" && !params.get("q")) {
      qualityName = qualityName === "haute" ? "moyenne" : "rapide";
      SHARED.quality = CONFIG.quality[qualityName];
      post.setPaint(SHARED.quality.paint, SHARED.quality.bloom); resize(); slowFor = 0;
      for (const b of $("cQualite").querySelectorAll("button")) b.classList.toggle("on", b.dataset.v === qualityName);
    }
    if (params.has("perf")) $("perf").textContent = `${fps.toFixed(0)} i/s · ${qualityName} · ${renderer.info.render.calls} appels · ${(renderer.info.render.triangles / 1000).toFixed(0)}k tri`;
  }
}

// ======================================================================= start
build().then(() => {
  $("charge").style.opacity = 0; setTimeout(() => $("charge").remove(), 800);
  show("titre", true);
  if (params.has("perf")) show("perf", true);
  // test hooks (used by automated screenshots): ?etat=vol / sol
  const e = params.get("etat");
  if (e) { $("bJouer").onclick(); state = "play"; P.mode = e === "vol" ? "fly" : "ground"; if (e === "vol") { P.pos.y = 190; P.lean = 1; } }
  window.__jeu = { P, cam, keeper, startWake, launch, goals, fly: () => { flyPressed = true; }, sim: (sec) => { for (let t = 0; t < sec; t += 1 / 30) update(1 / 30); }, setState: s => { state = s; }, get state() { return state; }, keys };
  clock.getDelta();
  tick();
});
