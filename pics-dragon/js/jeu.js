// Les Pics du Dragon — le jeu : on est le dragon rouge et on vole librement dans la vallée.
import * as THREE from "three";
import { G, Q, SUN, SUN_COL, V, clamp, lerp, sm, attendre } from "./commun.js";
import { Post } from "./post.js";
import { Ciel } from "./ciel.js";
import { construireCarte, faireSol, Hc, H, WY, LAC, lacD, DEPART } from "./monde.js";
import { construireRoche, matRoche, dansPic, PICS } from "./roche.js";
import { construireFlore, majFlore, uDragon, Flore } from "./flore.js";
import { construireArchi, COLLIS, LANTERNES, CASCADES } from "./archi.js";
import { construireEau } from "./eau.js";
import { construireDragon, etatDragon, volerDragon, poserDragon, anneaux, LEN, NR } from "./dragon.js";
import { construireAir } from "./air.js";
import { Son } from "./son.js";

const $ = id => document.getElementById(id);
const CLE = "pics-dragon2:";
const lire = (k, d) => { try { const v = localStorage.getItem(CLE + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
const ecrire = (k, v) => { try { localStorage.setItem(CLE + k, JSON.stringify(v)); } catch (e) {} };
const tactile = matchMedia("(pointer: coarse)").matches;
const reglages = Object.assign({ qualite: tactile ? "moyenne" : "haute", inv: 0, son: 1, perf: 0 }, lire("reglages", {}));
if (Q.get("q")) reglages.qualite = Q.get("q");
if (Q.has("fps")) reglages.perf = 1;
G.qualite = reglages.qualite;
const barre = $("barre").firstElementChild;
const etape = async (txt, p) => { $("chargeTxt").textContent = txt; barre.style.width = (p * 100) + "%"; await attendre(); };

// ---------- rendu ----------
const canvas = $("c");
let R;
try { R = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", stencil: false, depth: true }); }
catch (e) { $("chargeTxt").textContent = "Ce jeu a besoin de WebGL 2."; throw e; }
R.outputColorSpace = THREE.LinearSRGBColorSpace; R.toneMapping = THREE.NoToneMapping;
R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.info.autoReset = false;
Post.init(R);
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xffffff, 0);              // allume la brume maison ; density porte le temps
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.4, 9000);
camera.layers.enable(1);
const soleil = new THREE.DirectionalLight(SUN_COL, 3.4); soleil.castShadow = true;
const sc = soleil.shadow.camera; sc.left = -140; sc.right = 140; sc.top = 140; sc.bottom = -140; sc.near = 10; sc.far = 1400;
soleil.shadow.bias = -0.0003; soleil.shadow.normalBias = 0.35; soleil.shadow.radius = 2;
scene.add(soleil, soleil.target);
const hemi = new THREE.HemisphereLight(new THREE.Color(0.42, 0.52, 0.78), new THREE.Color(0.30, 0.22, 0.16), 0.65); scene.add(hemi);

const M = {};
async function construire() {
  await etape("On peint le ciel…", 0.04);
  await Ciel.cuire(R, reglages.qualite);
  const ciel = Ciel.faire(); scene.add(ciel);
  // lumière du ciel pour les reflets (écailles, or, laque)
  { const s2 = new THREE.Scene(), c2 = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), ciel.material); s2.add(c2);
    const pm = new THREE.PMREMGenerator(R); scene.environment = pm.fromScene(s2, 0, 0.1, 200).texture; scene.environmentIntensity = 0.55; pm.dispose(); }
  await etape("On creuse la vallée…", 0.14);
  construireCarte();
  for (const m of faireSol()) scene.add(m);
  await etape("On taille les pics…", 0.24);
  const roches = construireRoche(reglages.qualite);
  const mr = matRoche();
  { const { mergeGeometries } = await import("three/addons/utils/BufferGeometryUtils.js");
    const pres = new THREE.Mesh(mergeGeometries(roches.pres), mr); pres.castShadow = pres.receiveShadow = true; scene.add(pres);
    const loin = new THREE.Mesh(mergeGeometries(roches.loin), mr); loin.receiveShadow = true; scene.add(loin); }
  await etape("On bâtit les temples…", 0.38);
  try { await Promise.race([document.fonts.load("150px 'Ma Shan Zheng'"), new Promise(r => setTimeout(r, 2500))]); } catch (e) {}
  M.archi = construireArchi(scene);
  await etape("On plante les érables…", 0.5);
  construireFlore(scene, reglages.qualite);
  await etape("On remplit le lac…", 0.66);
  M.eau = construireEau(scene, reglages.qualite);
  M.air = construireAir(scene);
  await etape("Le dragon s'éveille…", 0.74);
  M.dragon = construireDragon(scene);
  const p = lire("position", null);
  if (p && Number.isFinite(p.x)) etatDragon(M.dragon, p.x, p.y, p.z, p.yaw); else etatDragon(M.dragon, DEPART.x, 70, DEPART.z, 0.15);
  for (let i = 0; i < 3; i++) poserDragon(M.dragon, 0.016, camera);
  const allumees = lire("lanternes", []);
  LANTERNES.forEach((L, i) => { if (allumees.includes(i)) { L.allumee = true; L.anim = 1; } });
}

// ---------- monde physique pour le dragon ----------
const monde = {
  sol: (x, z) => Math.max(Hc(x, z), WY),
  repousser(p, r) {
    const hit = dansPic(p.x, p.y, p.z, r); if (hit) { const k = (hit.r) / Math.max(hit.d, 0.01); p.x = hit.c[0] + hit.dx * k; p.z = hit.c[1] + hit.dz * k; }
    for (const m of COLLIS) {
      if (p.y < m.y0 - r || p.y > m.y1 + r) continue;
      const c = Math.cos(m.a), s = Math.sin(m.a), dx = p.x - m.x, dz = p.z - m.z; let lx = dx * c - dz * s, lz = dx * s + dz * c; const hw = m.hw + r, hd = m.hd + r;
      if (Math.abs(lx) < hw && Math.abs(lz) < hd) { const up = m.y1 + r - p.y; if (up < Math.min(hw - Math.abs(lx), hd - Math.abs(lz))) p.y = m.y1 + r; else { if (hw - Math.abs(lx) < hd - Math.abs(lz)) lx = Math.sign(lx || 1) * hw; else lz = Math.sign(lz || 1) * hd; p.x = m.x + lx * c + lz * s; p.z = m.z - lx * s + lz * c; } }
    }
  }
};

// ---------- commandes ----------
const touches = new Set(), entree = { x: 0, y: 0, vite: 0, lent: 0, feu: 0 };
let enJeu = false, enPause = false, rugir = 0, camLibre = false;
addEventListener("keydown", e => {
  touches.add(e.code);
  if (!enJeu) return;
  if (e.code === "Escape" || e.code === "KeyP") enPause ? reprendre() : pause();
  if (e.code === "KeyM") basculerSon();
  if (e.code === "KeyR" && !e.repeat) { rugir = 1.6; Son.rugir(); }
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
});
addEventListener("keyup", e => touches.delete(e.code));
addEventListener("blur", () => touches.clear());
const orbite = { yaw: 0, pitch: 0, t: 0 };
let glisse = null, joy = null; const joyEl = $("joy"), joyDot = joyEl.firstElementChild;
canvas.addEventListener("pointerdown", e => {
  if (!enJeu || enPause) return; canvas.setPointerCapture?.(e.pointerId);
  if (e.pointerType !== "mouse" && e.clientX < innerWidth * 0.5 && !joy) { joy = { id: e.pointerId, x0: e.clientX, y0: e.clientY }; joyEl.style.display = "block"; joyEl.style.left = e.clientX + "px"; joyEl.style.top = e.clientY + "px"; joyDot.style.transform = ""; }
  else if (!glisse) glisse = { id: e.pointerId, x: e.clientX, y: e.clientY };
});
canvas.addEventListener("pointermove", e => {
  if (joy && e.pointerId === joy.id) { let dx = e.clientX - joy.x0, dy = e.clientY - joy.y0; const d = Math.hypot(dx, dy), m = 60; if (d > m) { dx *= m / d; dy *= m / d; } entree.x = dx / m; entree.y = -dy / m; joyDot.style.transform = `translate(${dx}px, ${dy}px)`; }
  else if (glisse && e.pointerId === glisse.id) { orbite.yaw -= (e.clientX - glisse.x) * 0.006; orbite.pitch = clamp(orbite.pitch + (e.clientY - glisse.y) * 0.004, -0.6, 1.0); orbite.t = 2.5; glisse.x = e.clientX; glisse.y = e.clientY; }
});
const fin = e => { if (joy && e.pointerId === joy.id) { joy = null; entree.x = entree.y = 0; joyEl.style.display = "none"; } if (glisse && e.pointerId === glisse.id) glisse = null; };
canvas.addEventListener("pointerup", fin); canvas.addEventListener("pointercancel", fin);
const appui = (id, cle) => { const b = $(id); b.addEventListener("pointerdown", e => { e.preventDefault(); entree[cle] = 1; b.setPointerCapture?.(e.pointerId); });
  const off = () => entree[cle] = 0; b.addEventListener("pointerup", off); b.addEventListener("pointercancel", off); b.addEventListener("lostpointercapture", off); };
appui("bFeu", "feu"); appui("bVite", "vite"); appui("bLent", "lent");
let padPrec = {};
function manette() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : []; const o = { x: 0, y: 0, cx: 0, cy: 0, feu: 0, vite: 0, lent: 0 };
  for (const p of pads) { if (!p) continue; const dz = v => Math.abs(v) < 0.15 ? 0 : v;
    o.x = dz(p.axes[0] || 0); o.y = -dz(p.axes[1] || 0); o.cx = dz(p.axes[2] || 0); o.cy = dz(p.axes[3] || 0);
    o.feu = p.buttons[0]?.pressed ? 1 : 0; o.vite = (p.buttons[7]?.value || 0) > 0.3 || p.buttons[5]?.pressed ? 1 : 0; o.lent = (p.buttons[6]?.value || 0) > 0.3 || p.buttons[4]?.pressed ? 1 : 0;
    const st = p.buttons[9]?.pressed, y = p.buttons[3]?.pressed;
    if (st && !padPrec.st) enPause ? reprendre() : pause(); if (y && !padPrec.y) { rugir = 1.6; Son.rugir(); }
    padPrec = { st, y }; break; }
  return o;
}

// ---------- caméra qui suit ----------
const camPos = V(), camVise = V(), tmp = V(), tmp2 = V();
function majCamera(dt, init) {
  const S = M.dragon.S, tete = M.dragon.tete.position;
  const dist = 22 + S.v * 0.22, haut = 6.5;
  const yaw = S.yaw + orbite.yaw, pitch = 0.40 + orbite.pitch - S.pitch * 0.35;
  const cible = tmp.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(dist).add(tete);
  cible.y += haut * 0.3;
  const sol = Math.max(Hc(cible.x, cible.z), WY) + 2.5; if (cible.y < sol) cible.y = sol;
  if (init) camPos.copy(cible); else camPos.lerp(cible, 1 - Math.exp(-dt * 5));
  const v = tmp2.copy(tete).addScaledVector(S.fwd, 22); v.y += 1.0;
  if (init) camVise.copy(v); else camVise.lerp(v, 1 - Math.exp(-dt * 8));
  camera.position.copy(camPos); camera.up.set(0, 1, 0); camera.lookAt(camVise);
  camera.rotateZ(-S.roll * 0.25);
  if (orbite.t > 0) orbite.t -= dt; else { orbite.yaw *= Math.exp(-dt * 1.5); orbite.pitch *= Math.exp(-dt * 1.5); }
  camera.fov = lerp(camera.fov, 58 + clamp((S.v - 24) / 22, 0, 1) * 10, 1 - Math.exp(-dt * 2)); camera.updateProjectionMatrix();
}

// ---------- lanternes ----------
let victoire = lire("victoire", false), toastT = 0;
function toast(t) { const el = $("toast"); el.textContent = t; el.style.opacity = 1; toastT = 2.6; }
const halos = [];
function majLanternes(dt) {
  const D = M.dragon, S = D.S; let proche = null, dmin = 1e9, nb = 0;
  LANTERNES.forEach((L, i) => {
    const p = L.mesh.position;
    if (!L.allumee && S.feu > 0.3 && D.bouche) {
      // distance de la lanterne au jet de feu (segment de 40 m devant la gueule)
      tmp.subVectors(p, D.bouche); const t = clamp(tmp.dot(D.dirFeu), 0, 40), dd = tmp.addScaledVector(D.dirFeu, -t).length();
      if (dd < 5 + t * 0.12) { L.allumee = true; ecrire("lanternes", LANTERNES.map((l, k) => l.allumee ? k : -1).filter(k => k >= 0)); Son.carillon(false);
        const n = LANTERNES.filter(l => l.allumee).length; toast(n < 6 ? `Tu as rallumé ${L.nom} ! ${n}/6` : "Les 6 lanternes brillent !");
        if (n === 6 && !victoire) { victoire = true; ecrire("victoire", true); setTimeout(() => { Son.carillon(true); pause(true); $("victoire").classList.remove("cache"); }, 1800); } }
    }
    L.anim = lerp(L.anim, L.allumee ? 1 : 0, 1 - Math.exp(-dt * 2));
    const pulse = L.allumee ? 1 + Math.sin(G.uTime.value * 3 + i) * 0.08 : 0.5 + 0.5 * Math.sin(G.uTime.value * 2.5 + i);
    L.mat.emissiveIntensity = L.anim * 9 * pulse + (1 - L.anim) * pulse * 0.25;
    if (halos[i]) { halos[i].material.opacity = L.anim; halos[i].quaternion.copy(camera.quaternion); }
    const d = camera.position.distanceTo(p); if (L.allumee) nb++; else if (d < dmin) { dmin = d; proche = L; }
  });
  $("objNb").textContent = nb + "/6";
  if (proche) { $("objDist").textContent = Math.round(dmin) + " m"; const ang = Math.atan2(proche.mesh.position.x - camera.position.x, proche.mesh.position.z - camera.position.z);
    const fwd = camera.getWorldDirection(tmp), cy = Math.atan2(fwd.x, fwd.z); $("fleche").style.transform = `rotate(${cy - ang}rad)`; $("fleche").style.visibility = "visible"; }
  else { $("objDist").textContent = "toutes !"; $("fleche").style.visibility = "hidden"; }
}

// ---------- qualité, taille, résolution qui s'adapte ----------
let prBase = 1, prEch = 1, baisses = 0;
function appliquerQualite() {
  const q = reglages.qualite;
  prBase = q === "haute" ? Math.min(devicePixelRatio, 1.6) : q === "moyenne" ? Math.min(devicePixelRatio, 1.15) : 0.85;
  Post.ao = q !== "rapide"; Post.rays = q !== "rapide";
  M.eau && M.eau.mettreQualite(q);
  const taille = q === "haute" ? (tactile ? 2048 : 4096) : q === "moyenne" ? 2048 : 1024;
  if (soleil.shadow.mapSize.x !== taille) { soleil.shadow.mapSize.set(taille, taille); if (soleil.shadow.map) { soleil.shadow.map.dispose(); soleil.shadow.map = null; } }
  redim();
}
function redim() {
  const pr = prBase * prEch, w = Math.round(innerWidth * pr), h = Math.round(innerHeight * pr);
  R.setPixelRatio(1); R.setSize(w, h, false); canvas.style.width = innerWidth + "px"; canvas.style.height = innerHeight + "px";
  Post.size(w, h, reglages.qualite === "rapide" ? 0 : 4);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener("resize", redim);
const mesures = []; let mesT = 0;
function adapter(dt) {
  if (dt > 0.25) return; mesures.push(dt); mesT += dt; if (mesT < 2) return;
  const moy = mesures.reduce((a, b) => a + b, 0) / mesures.length; mesures.length = 0; mesT = 0;
  if (moy > 1 / 40 && prEch > 0.55) { prEch = Math.max(0.55, prEch - 0.12); baisses++; redim(); }
  else if (moy < 1 / 57 && prEch < 1 && baisses < 4) { prEch = Math.min(1, prEch + 0.06); redim(); }
}

// ---------- écrans ----------
function pause(silence) { if (!enJeu) return; enPause = true; $("hud").classList.add("cache"); if (!silence) $("pause").classList.remove("cache"); touches.clear(); entree.x = entree.y = entree.feu = entree.vite = entree.lent = 0; joy = glisse = null; joyEl.style.display = "none"; sauver(); }
function reprendre() { enPause = false; ["pause", "reglages", "victoire"].forEach(i => $(i).classList.add("cache")); $("hud").classList.remove("cache"); }
function sauver() { const S = M.dragon && M.dragon.S; if (S) ecrire("position", { x: S.p.x, y: S.p.y, z: S.p.z, yaw: S.yaw }); }
$("bJouer").addEventListener("click", () => { Son.demarrer(!!reglages.son); $("titre").classList.add("cache"); $("hud").classList.remove("cache"); enJeu = true; enPause = false; toast(lire("position", null) ? "Bon retour, dragon !" : "Rallume les 6 lanternes avec ton feu !"); });
$("bPause").addEventListener("click", () => pause());
$("bReprendre").addEventListener("click", reprendre);
$("bContinuer").addEventListener("click", reprendre);
$("bDepart").addEventListener("click", () => { etatDragon(M.dragon, DEPART.x, 70, DEPART.z, 0.15); majCamera(0, true); reprendre(); });
let conf = 0;
$("bRejouer").addEventListener("click", e => { const b = e.currentTarget;
  if (Date.now() - conf > 2500) { conf = Date.now(); b.textContent = "Sûr ? Appuie encore"; setTimeout(() => b.textContent = "Rejouer", 2500); return; }
  LANTERNES.forEach(L => L.allumee = false); ecrire("lanternes", []); victoire = false; ecrire("victoire", false); etatDragon(M.dragon, DEPART.x, 70, DEPART.z, 0.15); majCamera(0, true); b.textContent = "Rejouer"; reprendre(); });
$("bReglages").addEventListener("click", () => { $("pause").classList.add("cache"); $("reglages").classList.remove("cache"); majChoix(); });
$("bFermerReglages").addEventListener("click", () => { $("reglages").classList.add("cache"); $("pause").classList.remove("cache"); });
const CHOIX = [["cQualite", "qualite"], ["cInv", "inv"], ["cSon", "son"], ["cPerf", "perf"]];
function majChoix() { for (const [id, k] of CHOIX) for (const b of $(id).children) b.classList.toggle("on", String(reglages[k]) === b.dataset.v); }
for (const [id, k] of CHOIX) $(id).addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; reglages[k] = k === "qualite" ? b.dataset.v : Number(b.dataset.v); ecrire("reglages", reglages); majChoix();
  if (k === "qualite") appliquerQualite(); if (k === "son") { Son.couper(!!reglages.son); majSon(); } if (k === "perf") $("perf").classList.toggle("cache", !reglages.perf); });
function basculerSon() { reglages.son = reglages.son ? 0 : 1; ecrire("reglages", reglages); Son.couper(!!reglages.son); majSon(); }
function majSon() { $("bSon").querySelector("use").setAttribute("href", reglages.son ? "#i-son" : "#i-muet"); }
$("bSon").addEventListener("click", basculerSon);
document.addEventListener("visibilitychange", () => { if (document.hidden) { sauver(); if (enJeu && !enPause) pause(); } });
setInterval(() => { if (enJeu && !enPause) sauver(); }, 10000);

// ---------- boucle ----------
const horloge = new THREE.Clock(); let temps = 0, perfT = 0, perfN = 0, perfMax = 0, autoT = 0;
function entreesVol(dt) {
  const pad = manette(); const inp = { yaw: 0, pitch: 0, vite: 0, lent: 0, feu: 0, rugir: rugir > 0 ? 1 : 0 };
  if (!enJeu) {      // écran titre : le dragon fait de grands cercles tout seul
    autoT += dt; inp.yaw = 0.32 + 0.15 * Math.sin(autoT * 0.2); const S = M.dragon.S; inp.pitch = clamp((75 - S.p.y) * 0.03, -0.5, 0.5); return inp;
  }
  let x = entree.x + pad.x, y = entree.y + pad.y;
  if (touches.has("ArrowLeft") || touches.has("KeyA") || touches.has("KeyQ")) x -= 1;
  if (touches.has("ArrowRight") || touches.has("KeyD")) x += 1;
  if (touches.has("ArrowUp") || touches.has("KeyW") || touches.has("KeyZ")) y += 1;
  if (touches.has("ArrowDown") || touches.has("KeyS")) y -= 1;
  if (reglages.inv) y = -y;
  inp.yaw = clamp(x, -1, 1); inp.pitch = clamp(y, -1, 1);
  inp.vite = touches.has("ShiftLeft") || touches.has("ShiftRight") || entree.vite || pad.vite ? 1 : 0;
  inp.lent = touches.has("ControlLeft") || touches.has("ControlRight") || touches.has("KeyC") || entree.lent || pad.lent ? 1 : 0;
  inp.feu = touches.has("Space") || touches.has("KeyF") || touches.has("Enter") || entree.feu || pad.feu ? 1 : 0;
  if (pad.cx || pad.cy) { orbite.yaw -= pad.cx * dt * 2; orbite.pitch = clamp(orbite.pitch + pad.cy * dt * 1.5, -0.6, 1); orbite.t = 1.5; }
  return inp;
}
function boucle() {
  requestAnimationFrame(boucle);
  const dtv = Math.min(horloge.getDelta(), 0.1), dt = enPause ? 0 : dtv;
  temps += dt; G.uTime.value = temps; scene.fog.density = temps;
  if (rugir > 0) rugir -= dt;
  const D = M.dragon;
  if (!window.__gel) volerDragon(D, entreesVol(dt), dt, monde);
  poserDragon(D, dt, camera);
  if (!camLibre) majCamera(dt, false);
  majLanternes(dt);
  majFlore(camera, false);
  if (Flore.herbe) Flore.herbe.u.uCam.value.copy(camera.position);
  M.air.maj(camera);
  // le dragon pousse l'air : arbres, herbe, eau
  const S = D.S, k = clamp(S.v / 30, 0.3, 1.6);
  for (let i = 0; i < 4; i++) { const R0 = anneaux[Math.min(NR - 1, i * 50)]; uDragon.value[i].set(R0.p.x, R0.p.y, R0.p.z, k * sm(26, 6, R0.p.y - Hc(R0.p.x, R0.p.z))); }
  { const h = S.p.y - WY; M.eau.uDrag.value.set(S.p.x, 0, S.p.z, lacD(S.p.x, S.p.z) < 0 ? sm(16, 3, h) * k : 0); }
  // l'ombre du soleil suit le dragon (calée sur une grille pour ne pas scintiller)
  const f = D.tete.position, gx = Math.round(f.x / 8) * 8, gz = Math.round(f.z / 8) * 8, gy = Math.round(f.y / 8) * 8 - 20;
  soleil.target.position.set(gx, gy, gz); soleil.position.set(gx, gy, gz).addScaledVector(SUN, 650);
  // sons
  let eau = 0; for (const C of CASCADES) eau = Math.max(eau, clamp(1 - camera.position.distanceTo(C.p) / 200, 0, 1));
  Son.maj(dt, enJeu ? S.v : 10, S.feu, eau);
  if (toastT > 0) { toastT -= dtv; if (toastT <= 0) $("toast").style.opacity = 0; }
  R.info.reset();
  Post.render(scene, camera, { exposure: 1.0 });
  if (enJeu && !enPause) adapter(dtv);
  if (reglages.perf) { perfT += dtv; perfN++; perfMax = Math.max(perfMax, dtv); if (perfT > 0.5) { $("perf").textContent = `${Math.round(perfN / perfT)} i/s  pire ${(perfMax * 1000).toFixed(0)} ms\nappels ${R.info.render.calls}  triangles ${(R.info.render.triangles / 1000).toFixed(0)} k\nrésolution ×${(prBase * prEch).toFixed(2)}  ${reglages.qualite}`; perfT = perfN = perfMax = 0; } }
}

// ---------- démarrage ----------
(async () => {
  try {
    await construire();
    await etape("On prépare la lumière…", 0.9);
    appliquerQualite(); majSon(); $("perf").classList.toggle("cache", !reglages.perf);
    majCamera(0, true); majFlore(camera, true);
    if (R.compileAsync) await R.compileAsync(scene, camera);
    G.uTime.value = 0.01; scene.fog.density = 0.01;
    Post.render(scene, camera);
    await etape("Prêt !", 1);
    $("charge").style.opacity = 0; setTimeout(() => $("charge").classList.add("cache"), 800);
    $("titre").classList.remove("cache");
    horloge.getDelta(); boucle();
    window.__PRET = true;
  } catch (e) { console.error(e); $("chargeTxt").textContent = "Oups : " + e.message; window.__ERREUR = String(e && e.stack || e); }
})();

// pour les tests : se placer et regarder
window.__jeu = { M, camera, scene, R, reglages, entree, touches, orbite,
  jouer() { $("bJouer").click(); },
  placer(x, y, z, yaw, pitch = 0) { camLibre = false; etatDragon(M.dragon, x, y, z, yaw); M.dragon.S.pitch = pitch; for (let i = 0; i < 3; i++) poserDragon(M.dragon, 0.016, camera); majCamera(0, true); majFlore(camera, true); },
  vue(px, py, pz, tx, ty, tz) { camLibre = true; camera.position.set(px, py, pz); camera.lookAt(tx, ty, tz); majFlore(camera, true); },
  etat() { return { p: M.dragon.S.p.toArray().map(Math.round), appels: R.info.render.calls, tri: R.info.render.triangles, lanternes: LANTERNES.map(l => l.allumee) }; },
};
