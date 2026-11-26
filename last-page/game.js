/* The Last Page: a platform game made from the paintings, drawings and sound of
   ChetasLua's film "The Last Page" (see AUDIT.md). Flip-screen rooms, one painting each. */
(() => {
'use strict';

// ------------------------------------------------------------------ setup
const W = 1280, H = 720;
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const Q = new URLSearchParams(location.search);
const DEBUG = Q.has('debug');
let SCALE = 1;

function fit() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const s = Math.min(innerWidth / W, innerHeight / H);
  cv.style.width = Math.round(W * s) + 'px';
  cv.style.height = Math.round(H * s) + 'px';
  cv.width = Math.round(W * s * dpr); cv.height = Math.round(H * s * dpr);
  SCALE = cv.width / W;
}
addEventListener('resize', fit); fit();

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t * t * (3 - 2 * t);

// ------------------------------------------------------------------ assets
const PLATES = ['s1_0150', 's2_0030', 's2_0150', 's5_0010', 's5_0100', 's6_0060', 's6_0120', 's6_0160',
                's7_0030', 's8_0060', 's8_0120', 's9_0020', 's9_0060', 's9_0140'];
const SPRITES = ['fox_lantern', 'fox_gold', 'books_lantern', 'books_moon', 'books_gold', 'birds', 'pages', 'lantern',
                 'blank_page', 'rafts', 'ink_line', 'ink_line_time', 'ink_title', 'ink_title_time', 'ink_press', 'ink_press_time', 'seal'];
const SOUNDS = ['film', 'music', 'step_wood0', 'step_wood1', 'step_wood2', 'step_wood3', 'step_paper0', 'step_paper1', 'step_paper2',
                'jump', 'land', 'lantern', 'flame', 'page', 'snap', 'flap', 'jolt', 'slap', 'whoomph',
                'piano69', 'piano72', 'piano74', 'piano76', 'piano79', 'piano81', 'piano_end'];
const IMG = {};
const BOOK_TOPS = [[10, 15, 287, 92], [25, 18, 275, 93], [15, 15, 289, 98], [26, 16, 274, 96], [29, 13, 268, 98], [13, 18, 293, 92],
                   [7, 22, 296, 84], [14, 14, 285, 96], [17, 15, 276, 91], [16, 16, 281, 92], [7, 16, 292, 91], [20, 19, 284, 91]];
const RAFTS = { w: 280, h: 110, pals: ['cream', 'violet', 'gold', 'dawn'],
  boxes: [[24, 40, 255, 90], [24, 36, 255, 98], [26, 31, 256, 96], [23, 47, 255, 86], [24, 40, 256, 89], [27, 37, 255, 95], [27, 26, 254, 103], [24, 38, 255, 96],
          [23, 42, 256, 87], [24, 37, 255, 96], [25, 27, 254, 100], [24, 37, 255, 99], [24, 35, 255, 95], [25, 38, 255, 94], [24, 36, 255, 91], [24, 41, 255, 95]] };
const CARRIER = { cream: 0, violet: 2, gold: 3, dawn: 4 };
const FOX = { w: 340, h: 230, gx: 175, gy: 205, cols: 8, S: .62,
  run: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], idle: [12, 13, 14, 15], crouch: 16, jump: [17, 18, 19], land: 20, look: 21 };

function loadImg(name, dir) {
  return new Promise((ok, no) => {
    const im = new Image();
    im.onload = () => { IMG[name] = im; ok(); };
    im.onerror = () => no(new Error('missing ' + name));
    im.src = dir + name + (dir === 'img/plates/' ? '.jpg' : name === 'paper' ? '.jpg' : '.png');
  });
}

// ------------------------------------------------------------------ audio
let AC = null, master = null, musicBus = null, sfxBus = null, muted = false;
const BUF = {};
const rawAudio = {};
async function fetchAudio(name) {
  const r = await fetch('audio/' + name + '.mp3');
  rawAudio[name] = await r.arrayBuffer();
}
async function startAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  AC = new (window.AudioContext || window.webkitAudioContext)();
  master = AC.createGain(); master.connect(AC.destination);
  musicBus = AC.createGain(); musicBus.gain.value = .9; musicBus.connect(master);
  sfxBus = AC.createGain(); sfxBus.gain.value = .8; sfxBus.connect(master);
  await Promise.all(Object.keys(rawAudio).map(async n => {
    try { BUF[n] = await AC.decodeAudioData(rawAudio[n].slice(0)); } catch (e) { /* skip */ }
  }));
  if (pendingMusic) setMusic(pendingMusic, true);
}
function sfx(name, vol = 1, rate = 1, pan = 0) {
  if (!AC || !BUF[name]) return;
  const s = AC.createBufferSource(); s.buffer = BUF[name]; s.playbackRate.value = rate;
  const g = AC.createGain(); g.gain.value = vol;
  let node = g;
  if (AC.createStereoPanner) { const p = AC.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p); node = p; }
  node.connect(sfxBus); s.connect(g); s.start();
}
// music: windows of the film's score, looped with a crossfade
const TRACKS = {
  title:   { buf: 'film',  a: 0.4, b: 7.0,  gain: 1.0 },
  hall:    { buf: 'music', a: 7.0, b: 20.4, gain: 1.7 },
  stirs:   { buf: 'music', a: 22.2, b: 31.8, gain: 1.25 },
  burst:   { buf: 'music', a: 32.0, b: 39.0, gain: .95 },
  sunrise: { buf: 'music', a: 39.0, b: 52.0, gain: .9 },
  sky:     { buf: 'music', a: 44.0, b: 52.0, gain: .9 },
  ending:  { buf: 'music', a: 52.0, b: 64.0, gain: 1.1, once: true },
};
let curMusic = null, pendingMusic = null, voices = [], nextLoopAt = 0;
function voice(tr, when, fadeIn) {
  const s = AC.createBufferSource(); s.buffer = BUF[tr.buf];
  const g = AC.createGain(); g.gain.setValueAtTime(fadeIn ? 0 : tr.gain, when);
  if (fadeIn) g.gain.linearRampToValueAtTime(tr.gain, when + fadeIn);
  s.connect(g); g.connect(musicBus); s.start(when, tr.a, tr.b - tr.a + .05);
  return { s, g };
}
function fadeOutVoices(at, dur) {
  for (const v of voices) {
    try { v.g.gain.cancelScheduledValues(at); v.g.gain.setValueAtTime(v.g.gain.value, at); v.g.gain.linearRampToValueAtTime(0, at + dur); v.s.stop(at + dur + .05); } catch (e) { }
  }
  voices = [];
}
function setMusic(name, force) {
  if (!AC || !BUF.music) { pendingMusic = name; return; }
  pendingMusic = null;
  if (name === curMusic && !force) return;
  const now = AC.currentTime;
  fadeOutVoices(now, 1.6);
  curMusic = name;
  if (!name) return;
  const tr = TRACKS[name];
  voices.push(voice(tr, now + .05, 1.4));
  nextLoopAt = now + .05 + (tr.b - tr.a) - 1.6;
}
function musicTick() {
  if (!AC || !curMusic) return;
  const tr = TRACKS[curMusic];
  if (tr.once) return;
  if (AC.currentTime >= nextLoopAt) {
    const at = nextLoopAt;
    const old = voices.slice(); voices = [];
    for (const v of old) { v.g.gain.setValueAtTime(tr.gain, at); v.g.gain.linearRampToValueAtTime(0, at + 1.6); }
    voices.push(voice(tr, at, 1.6));
    nextLoopAt = at + (tr.b - tr.a) - 1.6;
  }
}

// ------------------------------------------------------------------ input
const keys = {};
const pressed = new Set();
addEventListener('keydown', e => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Space'].includes(e.key) || e.code === 'Space') e.preventDefault();
  if (!keys[e.code]) pressed.add(e.code);
  keys[e.code] = true;
  anyKey();
  if (e.code === 'KeyM') { muted = !muted; if (master) master.gain.value = muted ? 0 : 1; }
});
addEventListener('keyup', e => { keys[e.code] = false; });
const touch = { left: false, right: false, jump: false, used: false };
let jumpTouchEdge = false;
function touchUpdate(e) {
  e.preventDefault(); touch.used = true; anyKey();
  const r = cv.getBoundingClientRect();
  let l = false, rt = false, j = false;
  for (const t of e.touches) {
    const x = (t.clientX - r.left) / r.width * W, y = (t.clientY - r.top) / r.height * H;
    if (x > W * .62) j = true; else if (x < 150) l = true; else if (x < 320) rt = true;
    void y;
  }
  if (j && !touch.jump) jumpTouchEdge = true;
  touch.left = l; touch.right = rt; touch.jump = j;
}
cv.addEventListener('touchstart', touchUpdate, { passive: false });
cv.addEventListener('touchmove', touchUpdate, { passive: false });
cv.addEventListener('touchend', touchUpdate, { passive: false });
cv.addEventListener('mousedown', () => anyKey());
let padJumpPrev = false;
function input() {
  let gx = 0, gj = false, gd = false, gu = false;
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) {
    if (!p) continue;
    if (Math.abs(p.axes[0]) > .3) gx = p.axes[0];
    if (p.buttons[14] && p.buttons[14].pressed) gx = -1;
    if (p.buttons[15] && p.buttons[15].pressed) gx = 1;
    gj = gj || (p.buttons[0] && p.buttons[0].pressed) || (p.buttons[1] && p.buttons[1].pressed);
    gd = gd || (p.buttons[13] && p.buttons[13].pressed) || p.axes[1] > .6;
    gu = gu || (p.buttons[12] && p.buttons[12].pressed) || p.axes[1] < -.6;
  }
  const left = keys.ArrowLeft || keys.KeyA || keys.KeyQ || touch.left || gx < 0;
  const right = keys.ArrowRight || keys.KeyD || touch.right || gx > 0;
  const jumpHeld = keys.Space || keys.ArrowUp || keys.KeyW || keys.KeyZ || keys.KeyK || touch.jump || gj;
  let jumpEdge = pressed.has('Space') || pressed.has('ArrowUp') || pressed.has('KeyW') || pressed.has('KeyZ') || pressed.has('KeyK') || jumpTouchEdge || (gj && !padJumpPrev);
  if (gj && !padJumpPrev) anyKey();
  padJumpPrev = gj; jumpTouchEdge = false;
  pressed.clear();
  return { x: (right ? 1 : 0) - (left ? 1 : 0), jumpHeld, jumpEdge, down: keys.ArrowDown || keys.KeyS || gd, up: keys.ArrowUp || keys.KeyW || gu };
}
let anyKeyFn = null;
function anyKey() { if (anyKeyFn) { const f = anyKeyFn; anyKeyFn = null; f(); } }

// ------------------------------------------------------------------ ink that writes itself (per-pixel write time from the film's brush)
class Ink {
  constructor(ink, time, color) {
    const w = ink.width, h = ink.height;
    this.c = document.createElement('canvas'); this.c.width = w; this.c.height = h;
    const g = this.c.getContext('2d', { willReadFrequently: true });
    g.drawImage(ink, 0, 0); const A = g.getImageData(0, 0, w, h);
    g.clearRect(0, 0, w, h); g.drawImage(time, 0, 0); const T = g.getImageData(0, 0, w, h);
    this.n = w * h; this.alpha = new Uint8ClampedArray(this.n); this.time = new Uint8ClampedArray(this.n);
    for (let i = 0; i < this.n; i++) { this.alpha[i] = A.data[i * 4 + 3]; this.time[i] = T.data[i * 4]; }
    this.out = g.createImageData(w, h);
    const [r, gg, b] = color;
    for (let i = 0; i < this.n; i++) { this.out.data[i * 4] = r; this.out.data[i * 4 + 1] = gg; this.out.data[i * 4 + 2] = b; }
    this.g = g; this.t = -1; g.clearRect(0, 0, w, h);
  }
  at(t) {  // t in 0..1
    const q = Math.round(clamp(t, 0, 1) * 260);
    if (q === this.t) return this.c;
    this.t = q;
    const d = this.out.data, A = this.alpha, T = this.time;
    for (let i = 0; i < this.n; i++) {
      const a = A[i]; if (!a) { d[i * 4 + 3] = 0; continue; }
      const k = clamp((q - T[i]) / 6, 0, 1);
      d[i * 4 + 3] = a * k;
    }
    this.g.putImageData(this.out, 0, 0);
    return this.c;
  }
}

// ------------------------------------------------------------------ film finish: grain and vignette
let GRAIN = [], VIGNETTE = null;
function makeFinish() {
  for (let k = 0; k < 4; k++) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'); const d = g.createImageData(256, 256);
    for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (Math.random() + Math.random() + Math.random() - 1.5) * 70; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0); GRAIN.push(c);
  }
  VIGNETTE = document.createElement('canvas'); VIGNETTE.width = W; VIGNETTE.height = H;
  const g = VIGNETTE.getContext('2d');
  const gr = g.createRadialGradient(W * .5, H * .48, H * .35, W * .5, H * .5, W * .72);
  gr.addColorStop(0, 'rgba(10,6,20,0)'); gr.addColorStop(1, 'rgba(10,6,20,.42)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
}

// ------------------------------------------------------------------ rooms
// Platforms: book (a loose book lying flat), stack (books piled up from a floor), ghost (an invisible ledge on a painted shape),
// bird (a big paper bird you can ride), row (a floor of books across the room).
// Coordinates are in the 1280x720 room; y of a platform is its walking surface.
const ROOMS = [
  { id: 'hallA', bg: 's2_0030', fox: 'lantern', books: 'lantern', music: 'hall', ground: 650, exit: 'right', surf: 'wood',
    enter: { x: 70, y: 650 }, glow: .5, motes: 'moon',
    lanterns: [{ x: 150, y: 650 }],
    plats: [
      { k: 'stack', x: 330, y: 650, n: 3, i: 0 },
      { k: 'book', x: 480, y: 470, i: 3 },
      { k: 'book', x: 650, y: 380, i: 5 },
      { k: 'book', x: 850, y: 300, i: 8 },
      { k: 'stack', x: 1010, y: 650, n: 2, i: 6 },
    ],
    pages: [[560, 420], [910, 240], [720, 600], [1140, 520]] },
  { id: 'hallB', bg: 's2_0150', fox: 'lantern', books: 'lantern', music: 'hall', ground: 650, exit: 'right', back: true, surf: 'wood',
    enter: { x: 40, y: 650 }, glow: .5, motes: 'moon',
    lanterns: [{ x: 620, y: 650 }],
    plats: [
      { k: 'book', x: 180, y: 520, i: 1 },
      { k: 'book', x: 330, y: 410, i: 4 },
      { k: 'book', x: 170, y: 300, i: 9 },
      { k: 'book', x: 360, y: 200, i: 2 },
      { k: 'book', x: 560, y: 240, i: 7 },
      { k: 'stack', x: 860, y: 650, n: 4, i: 10 },
      { k: 'book', x: 1030, y: 420, i: 11 },
    ],
    pages: [[240, 250], [430, 150], [640, 190], [1100, 360], [500, 600]] },
  { id: 'shelf', bg: 's5_0010', fox: 'lantern', books: 'moon', music: 'stirs', ground: 572, exit: 'right', back: true, surf: 'wood',
    enter: { x: 40, y: 572 }, glow: .35, motes: 'dust', falling: 1.7, tremor: true, still: true,
    lanterns: [{ x: 110, y: 572 }],
    plats: [
      { k: 'book', x: 300, y: 450, i: 0 },
      { k: 'book', x: 520, y: 360, i: 3 },
      { k: 'book', x: 760, y: 430, i: 6 },
      { k: 'book', x: 980, y: 340, i: 9 },
    ],
    pages: [[380, 400], [600, 300], [840, 380], [1060, 280], [1200, 520]] },
  { id: 'lantern', bg: 's5_0100', fox: 'lantern', books: 'lantern', music: 'stirs', ground: 668, exit: 'right', back: true, surf: 'wood',
    enter: { x: 40, y: 668 }, glow: .25, motes: 'dust', falling: 2.4, tremor: true, still: true,
    lanterns: [],
    plats: [
      { k: 'ghost', x: 48, y: 532, w: 260 },     // the big book lying on the floor, left
      { k: 'ghost', x: 120, y: 420, w: 160 },    // painted pile, middle
      { k: 'ghost', x: 120, y: 308, w: 150 },    // painted pile, top
      { k: 'ghost', x: 482, y: 338, w: 130 },    // the lantern's cap
      { k: 'ghost', x: 748, y: 440, w: 220 },    // the open book on the right
      { k: 'ghost', x: 790, y: 300, w: 120 },    // the far pile
      { k: 'ghost', x: 940, y: 386, w: 120 },    // the purple pile
    ],
    pages: [[190, 250], [545, 280], [850, 240], [1000, 330], [650, 600]] },
  { id: 'stairA', bg: 's6_0060', fox: 'lantern', books: 'moon', raft: 'cream', music: 'burst', ground: null, exit: 'up', surf: 'paper',
    enter: { x: 120, y: 690 }, glow: .15, motes: 'scraps', flock: true,
    lanterns: [{ x: 200, y: 690 }],
    plats: [
      { k: 'row', y: 690, x: 0, w: 1280 },
      { k: 'bird', x: 450, y: 590, ax: 120, ay: 0, T: 4.2, ph: 0, row: 0 },
      { k: 'bird', x: 780, y: 470, ax: 0, ay: 60, T: 3.6, ph: 1, row: 1 },
      { k: 'bird', x: 520, y: 350, ax: 140, ay: 0, T: 5.0, ph: 2, row: 2 },
      { k: 'bird', x: 860, y: 230, ax: 90, ay: 30, T: 4.4, ph: .5, row: 0 },
      { k: 'bird', x: 600, y: 120, ax: 0, ay: 0, T: 3.0, ph: 0, row: 4 },
    ],
    pages: [[450, 520], [780, 360], [380, 290], [1000, 170], [600, 40]] },
  { id: 'stairB', bg: 's6_0120', fox: 'lantern', books: 'moon', raft: 'cream', music: 'burst', ground: null, exit: 'up', surf: 'paper',
    enter: { x: 640, y: 690 }, glow: .1, motes: 'scraps', flock: true,
    lanterns: [],
    plats: [
      { k: 'bird', x: 640, y: 690, ax: 0, ay: 0, T: 3, ph: 0, row: 4, big: 1.25 },
      { k: 'bird', x: 380, y: 590, ax: 0, ay: 50, T: 3.4, ph: 0, row: 1 },
      { k: 'bird', x: 200, y: 450, ax: 90, ay: 0, T: 4.0, ph: 1, row: 2 },
      { k: 'bird', x: 470, y: 330, ax: 110, ay: 0, T: 4.6, ph: 2, row: 0 },
      { k: 'bird', x: 880, y: 380, ax: 0, ay: 70, T: 3.8, ph: 0, row: 3 },
      { k: 'bird', x: 1080, y: 250, ax: 80, ay: 0, T: 4.2, ph: 1.5, row: 1 },
      { k: 'bird', x: 760, y: 130, ax: 120, ay: 0, T: 5.2, ph: 0, row: 3 },
    ],
    pages: [[200, 380], [470, 250], [1080, 180], [880, 290], [760, 50]] },
  { id: 'burst', bg: 's6_0160', fox: 'gold', books: 'gold', raft: 'violet', music: 'burst', ground: null, exit: 'up', surf: 'paper',
    enter: { x: 640, y: 690 }, glow: 0, motes: 'gold', flock: true, updraft: [360, 920],
    lanterns: [],
    plats: [
      { k: 'bird', x: 640, y: 690, ax: 0, ay: 0, T: 3, ph: 0, row: 3, big: 1.25 },
      { k: 'bird', x: 240, y: 560, ax: 60, ay: 0, T: 3.6, ph: 0, row: 3 },
      { k: 'bird', x: 1040, y: 560, ax: 60, ay: 0, T: 3.6, ph: 1.5, row: 3 },
    ],
    pages: [[240, 480], [1040, 480], [640, 300]] },
  { id: 'balcony', bg: 's7_0030', fox: 'gold', books: 'gold', raft: 'cream', music: 'sunrise', ground: 568, groundSpan: [0, 560], exit: 'right', surf: 'stone',
    enter: { x: 120, y: 568 }, glow: 0, motes: 'gold', wind: true, flock: true,
    lanterns: [{ x: 200, y: 568 }],
    plats: [
      { k: 'bird', x: 680, y: 520, ax: 0, ay: 50, T: 3.4, ph: 0, row: 3 },
      { k: 'bird', x: 900, y: 440, ax: 90, ay: 0, T: 4.2, ph: 1, row: 4 },
      { k: 'bird', x: 1100, y: 360, ax: 0, ay: 0, T: 3, ph: 2, row: 3 },
      { k: 'bird', x: 1210, y: 560, ax: 0, ay: 0, T: 3, ph: 0, row: 3, big: 1.25 },
    ],
    pages: [[380, 430], [680, 400], [900, 330], [1150, 290]] },
  { id: 'skyA', bg: 's8_0060', fox: 'gold', books: 'gold', raft: 'cream', music: 'sky', ground: null, exit: 'right', surf: 'paper',
    enter: { x: 90, y: 560 }, glow: 0, motes: 'gold', flock: true,
    lanterns: [],
    plats: [
      { k: 'bird', x: 90, y: 560, ax: 0, ay: 0, T: 3, ph: 0, row: 3, big: 1.25 },
      { k: 'bird', x: 330, y: 500, ax: 0, ay: 60, T: 3.2, ph: 0, row: 4 },
      { k: 'bird', x: 560, y: 420, ax: 100, ay: 0, T: 4.2, ph: 1, row: 3 },
      { k: 'bird', x: 820, y: 520, ax: 0, ay: 80, T: 3.6, ph: 2, row: 0 },
      { k: 'bird', x: 1050, y: 430, ax: 90, ay: 0, T: 4.0, ph: .3, row: 4 },
      { k: 'bird', x: 1210, y: 560, ax: 0, ay: 0, T: 3, ph: 0, row: 3, big: 1.25 },
    ],
    pages: [[330, 400], [560, 330], [820, 420], [1050, 340], [700, 250]] },
  { id: 'skyB', bg: 's8_0120', fox: 'gold', books: 'gold', raft: 'cream', music: 'sky', ground: null, exit: 'right', back: true, surf: 'paper',
    enter: { x: 70, y: 560 }, glow: 0, motes: 'gold', flock: true,
    lanterns: [],
    plats: [
      { k: 'bird', x: 70, y: 560, ax: 0, ay: 0, T: 3, ph: 0, row: 3, big: 1.25 },
      { k: 'bird', x: 300, y: 470, ax: 80, ay: 40, T: 4.0, ph: 0, row: 0 },
      { k: 'bird', x: 540, y: 370, ax: 0, ay: 90, T: 3.4, ph: 1, row: 4 },
      { k: 'bird', x: 790, y: 300, ax: 110, ay: 0, T: 4.8, ph: 2, row: 3 },
      { k: 'bird', x: 1020, y: 450, ax: 0, ay: 70, T: 3.6, ph: .5, row: 0 },
      { k: 'bird', x: 1210, y: 580, ax: 0, ay: 0, T: 3, ph: 0, row: 4, big: 1.25 },
    ],
    pages: [[300, 380], [540, 230], [790, 220], [1020, 360], [660, 520]] },
  { id: 'last', bg: 's9_0020', fox: 'gold', books: 'gold', music: 'sunrise', ground: 640, exit: 'end', back: true, surf: 'stone',
    enter: { x: 50, y: 640 }, glow: 0, motes: 'gold', wind: false, flock: false, blank: { x: 820, y: 640 },
    lanterns: [],
    plats: [],
    pages: [] },
];

// ------------------------------------------------------------------ world state
const fox = { x: 0, y: 0, vx: 0, vy: 0, ground: false, face: 1, coyote: 0, buffer: 0, dist: 0, landT: 0, idleT: 0, ride: null,
              stepPh: 0, hurt: 0, blink: 0, lookT: 0, prevY: 0 };
let room = null, roomIdx = 0, plats = [], pages = [], lanterns = [], falling = [], motes = [], flock = [], streaks = [];
let checkpoint = null, collected = {}, totalPages = 0, shake = 0, tremorT = 0, windT = 0, windF = 0, fallT = 0;
let state = 'load', T = 0, roomT = 0, fade = 0, xfade = null, xfadeT = 0, hudT = 0, pianoStep = 0, endT = 0;
let inkTitle, inkPress, inkPressDark, inkLine;
for (const r of ROOMS) totalPages += r.pages.length;

function makePlats(r) {
  const out = [];
  for (const p of r.plats) {
    if (p.k === 'book') {
      const s = p.s || .55, t = BOOK_TOPS[p.i];
      out.push({ ...p, s, w: (t[2] - t[0]) * s - 34, dx: 0, dy: 0 });
    } else if (p.k === 'stack') {
      const s = .55; const books = [];
      for (let j = 0; j < p.n; j++) books.push({ i: (p.i + j * 5) % 12, off: Math.sin(p.x * .1 + j * 2.3) * 10, rot: Math.sin(p.x + j) * .02 });
      out.push({ ...p, s, books, y: p.y - p.n * 27, base: p.y, w: 120, dx: 0, dy: 0 });
    } else if (p.k === 'bird') {
      const s = (p.big || 1) * .62, v = (p.v != null ? p.v : Math.round(Math.abs(p.x * 7 + p.y * 3)) % 4);
      const w = 200 * s;
      out.push({ ...p, s, v, cx: p.x, cy: p.y, x: p.x - w / 2, w, dx: 0, dy: 0 });
    } else out.push({ ...p, dx: 0, dy: 0 });
  }
  return out;
}

function enterRoom(i, from) {
  const prev = room;
  roomIdx = i; room = ROOMS[i]; roomT = 0; hudT = 3;
  plats = makePlats(room);
  pages = room.pages.map(([x, y], k) => ({ x, y, k, got: !!collected[room.id + k], seed: k * 7 + i }));
  lanterns = room.lanterns.map(l => ({ ...l, lit: !!collected['L' + room.id + l.x], litT: 9 }));
  falling = []; streaks = []; flock = [];
  motes = [];
  for (let k = 0; k < 46; k++) motes.push(newMote(true));
  if (from === 'back') { fox.x = W - 40; fox.y = room.ret ? room.ret.y : (room.ground != null && onGroundSpan(W - 40) ? room.ground : room.enter.y); if (room.ret) fox.x = room.ret.x; }
  else { fox.x = room.enter.x; fox.y = room.enter.y; }
  fox.vx = from === 'back' ? -1 : fox.vx * .5; fox.vy = 0; fox.ride = null;
  checkpoint = { x: fox.x, y: fox.y };
  for (const l of lanterns) if (l.lit) checkpoint = { x: l.x + 20, y: l.y };
  setMusic(room.music);
  if (prev && prev !== room) { xfade = snapshot(); xfadeT = 0; }
}

let snapCanvas = null;
function snapshot() {
  if (!snapCanvas) snapCanvas = document.createElement('canvas');
  snapCanvas.width = cv.width; snapCanvas.height = cv.height;
  snapCanvas.getContext('2d').drawImage(cv, 0, 0);
  return snapCanvas;
}

function newMote(any) {
  const kind = room.motes;
  if (kind === 'scraps' || kind === 'gold') return { kind, x: rnd(-40, W + 40), y: any ? rnd(-40, H) : -30, vx: rnd(-30, 30), vy: rnd(14, 46), r: rnd(0, 6.28), vr: rnd(-1.5, 1.5), s: rnd(.12, .26), pg: (Math.random() * 8) | 0, ph: rnd(0, 6) };
  return { kind, x: rnd(0, W), y: any ? rnd(0, H) : -10, vx: rnd(-6, 6), vy: rnd(4, 14), sz: rnd(.6, 1.8), a: rnd(.25, .8), ph: rnd(0, 6) };
}

// ------------------------------------------------------------------ physics
const G = 2350, RUN = 330, ACC = 2600, AIR = 1700, FRIC = 3000, JUMP = 860, MAXF = 1150;
const HB = { w: 44, h: 64 };

function platTop(p) { return p.y; }

function stepFox(dt, inp) {
  if (fox.hurt > 0) { fox.hurt -= dt; if (fox.hurt <= 0) respawn(); return; }
  // ride
  if (fox.ride) { fox.x += fox.ride.dx; fox.y += fox.ride.dy; }
  const want = inp.x * RUN + (room.wind ? windF : 0);
  const a = fox.ground ? ACC : AIR;
  if (inp.x) { fox.vx += clamp(want - fox.vx, -a * dt, a * dt); fox.face = inp.x; }
  else { const f = fox.ground ? FRIC : 500; fox.vx -= clamp(fox.vx - (room.wind ? windF * .55 : 0), -f * dt, f * dt); }
  if (inp.jumpEdge) fox.buffer = .13;
  fox.buffer -= dt; fox.coyote -= dt;
  if (fox.buffer > 0 && (fox.ground || fox.coyote > 0)) {
    fox.vy = -JUMP; fox.ground = false; fox.coyote = 0; fox.buffer = 0; fox.ride = null;
    sfx('jump', .55, rnd(.95, 1.08), pan());
  }
  if (!inp.jumpHeld && fox.vy < -320) fox.vy = -320;
  let g = G;
  if (room.updraft && fox.x > room.updraft[0] && fox.x < room.updraft[1] && !fox.ground) { g = -900; if (fox.vy < -720) fox.vy = -720; }
  fox.vy = Math.min(fox.vy + g * dt, MAXF);
  const px = fox.x, py = fox.y;
  fox.x += fox.vx * dt; fox.y += fox.vy * dt;
  // room edges
  const canBack = room.back && roomIdx > 0 && ROOMS[roomIdx - 1].exit === 'right';
  if (fox.x < 18 && !canBack) { fox.x = 18; fox.vx = Math.max(0, fox.vx); }
  if (room.exit !== 'right' && fox.x > W - 18) { fox.x = W - 18; fox.vx = Math.min(0, fox.vx); }
  // landing
  const wasGround = fox.ground; fox.ground = false; const oldRide = fox.ride; fox.ride = null;
  if (fox.vy >= 0) {
    let best = null;
    for (const p of plats) {
      const top = platTop(p);
      if (p.k === 'row' || (fox.x + 14 > p.x && fox.x - 14 < p.x + p.w)) {
        const prevTop = top - p.dy;
        if (py <= prevTop + 2 && fox.y >= top && (!best || top < best.y)) best = { y: top, p };
      }
    }
    if (room.ground != null && onGroundSpan(fox.x) && py <= room.ground + 2 && fox.y >= room.ground && (!best || room.ground < best.y)) best = { y: room.ground, p: null };
    if (best) {
      fox.y = best.y; if (!wasGround && fox.vy > 380) { fox.landT = .12; sfx('land', clamp(fox.vy / 1400, .2, .8), rnd(.9, 1.1), pan()); }
      fox.vy = 0; fox.ground = true; fox.coyote = .1;
      if (best.p && best.p.k === 'bird') fox.ride = best.p;
    }
  }
  if (wasGround && !fox.ground && fox.vy >= 0) fox.coyote = .1;
  void oldRide;
  // run cycle tied to distance: the trot drawings cover 88 units per stride at 150 px -> 82 px here
  if (fox.ground && Math.abs(fox.vx) > 20) {
    const d = Math.abs(fox.x - px); fox.dist += d;
    const ph = (fox.dist / 82) % 1, prevPh = fox.stepPh; fox.stepPh = ph;
    if ((prevPh < .18 && ph >= .18) || (prevPh < .68 && ph >= .68)) footstep();
    fox.idleT = 0;
  } else fox.idleT += dt;
  fox.landT -= dt;
  if (fox.y > H + 120) hurt(true);
  // exits
  if (room.exit === 'right' && fox.x > W + 12) return next();
  if (room.exit === 'up' && fox.y < 16) return next();
  if (canBack && fox.x < -12) return enterRoom(roomIdx - 1, 'back');
  if (room.blank && Math.abs(fox.x - room.blank.x) < 40 && fox.ground) startEnding();
}
function onGroundSpan(x) { const g = room.groundSpan; return !g || (x > g[0] && x < g[1]); }
function pan() { return (fox.x / W - .5) * 1.2; }
function footstep() {
  const s = room.surf;
  if (s === 'paper') sfx('step_paper' + ((Math.random() * 3) | 0), .32, rnd(.9, 1.1), pan());
  else sfx('step_wood' + ((Math.random() * 4) | 0), s === 'stone' ? .26 : .36, s === 'stone' ? rnd(1.25, 1.4) : rnd(.92, 1.08), pan());
}
function hurt(fell) {
  if (fox.hurt > 0) return;
  fox.hurt = fell ? .55 : .8; fox.vx = 0;
  if (!fell) { fox.vy = -420; shake = .35; sfx('slap', .7, 1, pan()); }
  else sfx('whoomph', .35, 1.4, pan());
}
function respawn() {
  fox.x = checkpoint.x; fox.y = checkpoint.y; fox.vx = 0; fox.vy = 0; fox.hurt = 0; fox.ride = null; fox.ground = false;
  falling = [];
}
function next() {
  if (roomIdx + 1 < ROOMS.length) enterRoom(roomIdx + 1, 'next');
}

// ------------------------------------------------------------------ world update
function update(dt) {
  T += dt; roomT += dt; hudT -= dt;
  const inp = input();
  // moving platforms
  for (const p of plats) {
    if (p.k !== 'bird') continue;
    const w = 2 * Math.PI / p.T, a = T * w + p.ph;
    const nx = p.cx + p.ax * Math.sin(a), ny = p.cy + p.ay * Math.sin(a * (p.ax && p.ay ? 2 : 1));
    const ox = p.x + p.w / 2, oy = p.y;
    p.dx = nx - ox; p.dy = ny - oy;
    p.x = nx - p.w / 2; p.y = ny;
  }
  stepFox(dt, inp);
  if (state !== 'play') return;
  // pages
  for (const pg of pages) {
    if (pg.got) continue;
    if (Math.hypot(fox.x - pg.x, fox.y - 34 - pg.y) < 46) {
      pg.got = true; collected[room.id + pg.k] = true; hudT = 2.5;
      const notes = [69, 72, 74, 76, 79, 81];
      sfx('page', .55, rnd(.95, 1.1), pan()); sfx('piano' + notes[pianoStep % notes.length], .5, 1, pan());
      pianoStep++;
    }
  }
  // lanterns
  for (const l of lanterns) {
    if (!l.lit && Math.abs(fox.x - l.x) < 50 && Math.abs(fox.y - l.y) < 60) {
      l.lit = true; l.litT = 0; collected['L' + room.id + l.x] = true; checkpoint = { x: l.x + 20, y: l.y };
      sfx('lantern', .6); sfx('flame', .35);
    }
    l.litT += dt;
  }
  // falling books
  if (room.falling) {
    fallT -= dt;
    if (fallT <= 0) {
      fallT = room.falling * rnd(.7, 1.3);
      const x = clamp(fox.x + rnd(-260, 260) + fox.vx * .5, 60, W - 60);
      falling.push({ x, y: -60, vy: 0, warn: .75, r: rnd(0, 6), vr: rnd(-4, 4), i: (Math.random() * 12) | 0, land: 0 });
    }
    for (const b of falling) {
      if (b.warn > 0) { b.warn -= dt; continue; }
      if (b.land) { b.land += dt; continue; }
      b.vy += 1800 * dt; b.y += b.vy * dt; b.r += b.vr * dt;
      if (Math.abs(b.x - fox.x) < 44 && b.y > fox.y - 80 && b.y < fox.y + 6 && fox.hurt <= 0) hurt(false);
      if (room.ground != null && b.y > room.ground - 10) { b.y = room.ground - 10; b.land = .001; shake = Math.max(shake, .18); sfx('jolt', .45, rnd(.9, 1.2), (b.x / W - .5)); }
      if (b.y > H + 100) b.land = 9;
    }
    falling = falling.filter(b => b.land < 2.2);
  }
  if (room.tremor) {
    tremorT -= dt;
    if (tremorT <= 0) { tremorT = rnd(5, 8); shake = .7; sfx('jolt', .8, .7); }
  }
  if (room.wind) {
    windT -= dt;
    if (windT <= 0) { windT = rnd(3.5, 5.5); windF = 0; }
    const g = windT > 2.0 ? 0 : windT > .4 ? -260 : -260 * windT / .4;
    windF = lerp(windF, g, clamp(dt * 4, 0, 1));
    if (windF < -60 && Math.random() < dt * 30) streaks.push({ x: W + 20, y: rnd(80, 640), v: rnd(900, 1400), len: rnd(80, 220), a: rnd(.2, .5) });
  }
  for (const s of streaks) s.x -= s.v * dt;
  streaks = streaks.filter(s => s.x > -300);
  // ambient
  for (const m of motes) {
    m.x += m.vx * dt + (room.wind ? windF * dt * .9 : 0); m.y += m.vy * dt;
    if (m.r !== undefined) m.r += m.vr * dt;
  }
  motes = motes.map(m => (m.y > H + 40 || m.x < -60 || m.x > W + 60) ? newMote(false) : m);
  if (room.flock && Math.random() < dt * .35 && flock.length < 3) {
    const dir = Math.random() < .5 ? 1 : -1, y = rnd(60, 360), n = 3 + ((Math.random() * 5) | 0);
    for (let k = 0; k < n; k++) flock.push({ x: dir > 0 ? -60 - k * rnd(30, 60) : W + 60 + k * rnd(30, 60), y: y + rnd(-50, 50), v: dir * rnd(150, 230), s: rnd(.22, .38), ph: Math.random() * 7, row: (Math.random() * 5) | 0 });
  }
  for (const b of flock) { b.x += b.v * dt; b.y += Math.sin(T * 2 + b.ph) * 10 * dt; }
  flock = flock.filter(b => b.x > -400 && b.x < W + 400);
  shake = Math.max(0, shake - dt);
}

// ------------------------------------------------------------------ drawing
const on2 = t => Math.floor(t * 12);       // drawings change on twos (12 a second)

function drawPlate(name, alpha = 1, ox = 0, oy = 0) {
  const im = IMG[name]; if (!im) return;
  ctx.globalAlpha = alpha;
  const z = 1.035;
  ctx.drawImage(im, -W * (z - 1) / 2 + ox, -H * (z - 1) / 2 + oy, W * z, H * z);
  ctx.globalAlpha = 1;
}

function drawBook(sheet, i, x, y, s, rot = 0, alpha = 1) {
  const im = IMG['books_' + sheet]; if (!im) return;
  const t = BOOK_TOPS[i], cw = 300, ch = 110;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.translate(x, y); if (rot) ctx.rotate(rot);
  ctx.drawImage(im, (i % 4) * cw, ((i / 4) | 0) * ch, cw, ch, -(t[0] + 16) * s, -(t[1] + 9) * s, cw * s, ch * s);
  ctx.restore();
}
function shadowEllipse(x, y, w, a) {
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#1a1230';
  ctx.beginPath(); ctx.ellipse(x, y, w, w * .16, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}

function drawBird(row, phase, cx, cy, s, flip, alpha = 1) {
  const im = IMG.birds; if (!im) return;
  const S = 150;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(cx, cy); if (flip) ctx.scale(-1, 1);
  ctx.drawImage(im, (phase % 7) * S, row * S, S, S, -S / 2 * s, -S / 2 * s, S * s, S * s);
  ctx.restore();
}

function drawRaft(p) {
  const pal = room.raft || 'cream', r = RAFTS.pals.indexOf(pal), b = RAFTS.boxes[r * 4 + p.v], s = p.s;
  const cx = p.x + p.w / 2, surf = (b[1] + b[3]) / 2 - 4;
  // two paper birds carry the sheet; they beat on twos, a little out of step
  const row = CARRIER[pal];
  const ph1 = on2(T * 1.1 + p.ph) % 7, ph2 = (on2(T * 1.1 + p.ph) + 3) % 7;
  drawBird(row, ph1, cx - 74 * s, p.y - 70 * s, .9 * s, false);
  if (IMG.rafts) ctx.drawImage(IMG.rafts, p.v * RAFTS.w, r * RAFTS.h, RAFTS.w, RAFTS.h, cx - RAFTS.w / 2 * s, p.y - surf * s, RAFTS.w * s, RAFTS.h * s);
  drawBird(row, ph2, cx + 70 * s, p.y - 66 * s, .9 * s, false);
}
function drawPlats() {
  for (const p of plats) {
    if (p.k === 'book') {
      shadowEllipse(p.x + p.w / 2, (room.ground || p.y + 200), p.w * .4, room.ground ? .12 : 0);
      drawBook(room.books, p.i, p.x, p.y, p.s);
    } else if (p.k === 'stack') {
      shadowEllipse(p.x + 60, p.base + 2, 80, .35);
      p.books.forEach((b, j) => drawBook(room.books, b.i, p.x + b.off - 8, p.base - (j + 1) * 27, p.s, b.rot));
    } else if (p.k === 'row') {
      for (let x = -20, j = 0; x < W + 40; x += 140, j++) drawBook(room.books, (j * 5) % 12, x + Math.sin(j * 3.1) * 8, p.y + Math.sin(j * 1.7) * 3, .55, Math.sin(j * 2.3) * .03);
    } else if (p.k === 'bird') {
      drawRaft(p);
    }
    if (DEBUG) { ctx.strokeStyle = '#0f0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.k === 'row' ? 0 : p.x, p.y); ctx.lineTo(p.k === 'row' ? W : p.x + p.w, p.y); ctx.stroke(); }
  }
  if (DEBUG && room.ground != null) { ctx.strokeStyle = '#ff0'; ctx.beginPath(); ctx.moveTo(0, room.ground); ctx.lineTo(W, room.ground); ctx.stroke(); }
}

function drawLanterns() {
  const im = IMG.lantern; if (!im) return;
  for (const l of lanterns) {
    const fr = l.lit ? 1 + on2(T * .5 + l.x) % 4 : 0;
    shadowEllipse(l.x, l.y + 1, 26, .4);
    ctx.drawImage(im, fr * 110, 0, 110, 110, l.x - 33, l.y - 64, 66, 66);
  }
}
function drawGlow() {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const l of lanterns) {
    if (!l.lit) continue;
    const k = Math.min(1, l.litT / .4) * (1 + .05 * Math.sin(on2(T) * 1.7));
    const g = ctx.createRadialGradient(l.x, l.y - 30, 4, l.x, l.y - 30, 260);
    g.addColorStop(0, `rgba(255,180,88,${.42 * k})`); g.addColorStop(.25, `rgba(255,160,80,${.16 * k})`); g.addColorStop(1, 'rgba(255,140,60,0)');
    ctx.fillStyle = g; ctx.fillRect(l.x - 270, l.y - 300, 540, 560);
  }
  if (room.glow) {
    const g = ctx.createRadialGradient(fox.x, fox.y - 40, 4, fox.x, fox.y - 40, 190);
    g.addColorStop(0, `rgba(255,190,120,${.10 * room.glow})`); g.addColorStop(1, 'rgba(255,160,90,0)');
    ctx.fillStyle = g; ctx.fillRect(fox.x - 200, fox.y - 240, 400, 400);
  }
  ctx.restore();
}

function drawPages() {
  const im = IMG.pages; if (!im) return;
  for (const pg of pages) {
    if (pg.got) continue;
    const t = on2(T + pg.seed) / 12;
    const y = pg.y + Math.sin(t * 2.2 + pg.seed) * 5, r = Math.sin(t * 1.3 + pg.seed) * .18;
    ctx.save(); ctx.translate(pg.x, y); ctx.rotate(r);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .22 + .06 * Math.sin(t * 3 + pg.seed);
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 46); g.addColorStop(0, '#fff1d0'); g.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = g; ctx.fillRect(-46, -46, 92, 92);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.drawImage(im, (pg.k * 3 + pg.seed) % 8 * 120, 0, 120, 120, -30, -30, 60, 60);
    ctx.restore();
  }
}

function foxFrame() {
  if (fox.hurt > 0) return FOX.jump[2];
  if (!fox.ground) return fox.vy < -260 ? FOX.jump[0] : fox.vy < 240 ? FOX.jump[1] : FOX.jump[2];
  if (fox.landT > 0) return FOX.land;
  if (Math.abs(fox.vx) > 30) return FOX.run[Math.floor(((fox.dist / 82) % 1) * 12) % 12];
  const inp = { down: keys.ArrowDown || keys.KeyS, up: keys.ArrowUp || keys.KeyW };
  if (inp.down) return FOX.crouch;
  if (fox.idleT > 2.5 && Math.floor(fox.idleT / 3.3) % 3 === 1) return FOX.look;
  const b = (fox.idleT % 3.1);
  if (b > 2.9) return FOX.idle[2];          // a real blink, held
  if (fox.idleT % 7 > 6) return FOX.idle[3];
  return FOX.idle[0];
}
function drawFox() {
  const im = IMG['fox_' + room.fox]; if (!im) return;
  const f = foxFrame(), S = FOX.S;
  const sx = (f % FOX.cols) * FOX.w, sy = ((f / FOX.cols) | 0) * FOX.h;
  // contact shadow on whatever is under the fox
  let gy = null;
  if (fox.ground) gy = fox.y;
  else {
    for (const p of plats) if (p.k === 'row' || (fox.x > p.x && fox.x < p.x + p.w)) if (p.y >= fox.y && (gy == null || p.y < gy)) gy = p.y;
    if (room.ground != null && onGroundSpan(fox.x) && room.ground >= fox.y && (gy == null || room.ground < gy)) gy = room.ground;
  }
  if (gy != null) shadowEllipse(fox.x - 4 * fox.face, gy + 1, 46 * clamp(1 - (gy - fox.y) / 400, .3, 1), .32 * clamp(1 - (gy - fox.y) / 400, .15, 1));
  ctx.save();
  if (fox.hurt > 0 && on2(T) % 2) ctx.globalAlpha = .45;
  ctx.translate(Math.round(fox.x), Math.round(fox.y));
  if (fox.face < 0) ctx.scale(-1, 1);
  ctx.drawImage(im, sx, sy, FOX.w, FOX.h, -FOX.gx * S, -FOX.gy * S, FOX.w * S, FOX.h * S);
  ctx.restore();
  if (DEBUG) { ctx.strokeStyle = '#f0f'; ctx.strokeRect(fox.x - HB.w / 2, fox.y - HB.h, HB.w, HB.h); }
}

function drawFalling() {
  for (const b of falling) {
    if (b.warn > 0) {   // dust sifting down first
      ctx.save(); ctx.globalAlpha = .35 * (1 - b.warn / .75) + .1; ctx.strokeStyle = '#c9c0d8'; ctx.lineWidth = 1.2;
      for (let k = 0; k < 5; k++) {
        const x = b.x + Math.sin(k * 2.1 + on2(T)) * 9, len = 70 + k * 40;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + Math.sin(k) * 3, len * (1 - b.warn / .75) + 20); ctx.stroke();
      }
      ctx.restore(); continue;
    }
    const a = b.land ? clamp(1 - (b.land - 1.2), 0, 1) : 1;
    if (!b.land) shadowEllipse(b.x, room.ground || H, 50 * clamp(b.y / (room.ground || H), .2, 1), .3);
    drawBook(room.books, b.i, b.x - 70, b.y, .5, b.land ? 0 : Math.round(b.r * 4) / 4, a);
  }
}

function drawMotes(front) {
  for (const m of motes) {
    if (m.kind === 'moon' || m.kind === 'dust') {
      if (front) continue;
      const tw = .6 + .4 * Math.sin(T * 1.3 + m.ph);
      ctx.fillStyle = m.kind === 'moon' ? `rgba(200,214,255,${m.a * tw * .7})` : `rgba(230,200,170,${m.a * tw * .55})`;
      ctx.fillRect(m.x, m.y, m.sz, m.sz);
    } else {
      if (front !== (m.s > .2)) continue;
      const im = IMG.pages; if (!im) continue;
      ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(Math.round(m.r * 3) / 3); ctx.scale(m.s, m.s * (.6 + .4 * Math.abs(Math.sin(on2(T) * .5 + m.ph))));
      ctx.globalAlpha = m.kind === 'gold' ? .85 : .7;
      ctx.drawImage(im, m.pg * 120, 0, 120, 120, -60, -60, 120, 120);
      ctx.restore();
    }
  }
}
function drawFlock() {
  for (const b of flock) drawBird(b.row, (on2(T * 1.4 + b.ph)) % 7, b.x, b.y, b.s, b.v < 0, .9);
}
function drawStreaks() {
  ctx.save(); ctx.strokeStyle = '#fff6e0'; ctx.lineCap = 'round';
  for (const s of streaks) {
    ctx.globalAlpha = s.a; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.quadraticCurveTo(s.x + s.len * .5, s.y - 8, s.x + s.len, s.y + 3); ctx.stroke();
  }
  ctx.restore();
}
function drawHUD() {
  const im = IMG.pages; if (!im || !room.pages.length) return;
  const a = clamp(hudT, 0, 1) * .9 + .25;
  ctx.save(); ctx.globalAlpha = a;
  pages.forEach((pg, k) => {
    const x = W - 40 - (pages.length - 1 - k) * 30, y = 38;
    ctx.globalAlpha = a * (pg.got ? 1 : .28);
    ctx.drawImage(im, (k * 3) % 8 * 120, 0, 120, 120, x - 18, y - 18, 36, 36);
  });
  ctx.restore();
}
function finish() {
  ctx.drawImage(VIGNETTE, 0, 0);
  ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = .07;
  const g = GRAIN[on2(T) % 4], ox = (on2(T) * 97) % 256, oy = (on2(T) * 57) % 256;
  for (let y = -oy; y < H; y += 256) for (let x = -ox; x < W; x += 256) ctx.drawImage(g, x, y);
  ctx.restore();
}
function drawTouch() {
  if (!touch.used || state !== 'play') return;
  ctx.save(); ctx.globalAlpha = .18; ctx.fillStyle = '#fff3d8';
  const c = (x, y, r, on) => { ctx.globalAlpha = on ? .32 : .14; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); };
  c(80, H - 90, 52, touch.left); c(230, H - 90, 52, touch.right); c(W - 110, H - 100, 64, touch.jump);
  ctx.globalAlpha = .5; ctx.fillStyle = '#2b2233'; ctx.font = '28px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('‹', 80, H - 92); ctx.fillText('›', 230, H - 92); ctx.fillText('↑', W - 110, H - 102);
  ctx.restore();
}

function drawRoom() {
  const sx = shake > 0 ? (Math.sin(T * 61) * 6 + Math.sin(T * 37) * 4) * shake : 0, sy = shake > 0 ? Math.sin(T * 53) * 4 * shake : 0;
  ctx.save(); ctx.translate(Math.round(sx), Math.round(sy));
  // the plate drifts a little against the fox: slow camera, on ones
  drawPlate(room.bg, 1, room.still ? 0 : -(fox.x / W - .5) * 18, room.still ? 0 : -(fox.y / H - .6) * 10);
  drawMotes(false);
  drawFlock();
  drawLanterns();
  drawPlats();
  if (room.blank && IMG.blank_page) {
    const b = room.blank;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .32 + .08 * Math.sin(on2(T) * .8);
    const g = ctx.createRadialGradient(b.x, b.y - 6, 4, b.x, b.y - 6, 90); g.addColorStop(0, '#fff3d0'); g.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = g; ctx.fillRect(b.x - 90, b.y - 96, 180, 180); ctx.restore();
    ctx.drawImage(IMG.blank_page, b.x - 62, b.y - 74, 124, 124);
  }
  drawPages();
  drawFox();
  drawFalling();
  drawGlow();
  drawMotes(true);
  drawStreaks();
  ctx.restore();
  drawHUD();
}

// ------------------------------------------------------------------ title and ending
let titleT = -1;
function drawTitle() {
  drawPlate('s1_0150', 1, Math.sin(T * .05) * 6, 0);
  drawMotes(false);
  if (titleT >= 0) {
    const t = titleT;
    const c = inkTitle.at(clamp(t / 2.6, 0, 1));
    ctx.drawImage(c, 56, 44, c.width * .5, c.height * .5);
    if (t > 3) {
      const p = inkPress.at(clamp((t - 3) / 1.2, 0, 1));
      ctx.globalAlpha = .55 + .35 * Math.sin(T * 2.2);
      ctx.drawImage(p, 96, 232, p.width * .62, p.height * .62);
      ctx.globalAlpha = 1;
    }
  } else {
    ctx.globalAlpha = .5 + .3 * Math.sin(T * 2);
    const p = inkPress.at(1);
    ctx.drawImage(p, W / 2 - p.width * .38, H - 150, p.width * .76, p.height * .76);
    ctx.globalAlpha = 1;
  }
}

function startEnding() {
  if (state !== 'play') return;
  state = 'end'; endT = 0; xfade = snapshot(); xfadeT = 0;
  setMusic('ending');
  sfx('page', .6);
}
let paperPat = null;
function drawEnding() {
  const t = endT;
  // 0..3.2 the balcony and the fox; 3.2..6.4 close on the page; then fade to paper and the ink writes
  if (t < 6.6) {
    drawPlate(t < 3.2 ? 's9_0060' : 's9_0140', 1, t < 3.2 ? -t * 3 : -(t - 3.2) * 2, 0);
    if (t > 3.2 && t < 3.9) { ctx.globalAlpha = 1 - (t - 3.2) / .7; drawPlate('s9_0060', 1, -9.6, 0); ctx.globalAlpha = 1; }
    drawMotes(true);
  }
  if (t > 6.0) {
    const k = clamp((t - 6.0) / 1.0, 0, 1);
    ctx.globalAlpha = k;
    if (!paperPat && IMG.paper) paperPat = ctx.createPattern(IMG.paper, 'repeat');
    ctx.fillStyle = paperPat || '#f1e4c6'; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  if (t > 7.2) {
    if (!drawEnding.noted) { drawEnding.noted = true; sfx('piano_end', .8); }
    const c = inkLine.at(clamp((t - 7.2) / 4.2, 0, 1));
    const s = .62;
    ctx.drawImage(c, W / 2 - c.width * s / 2 - 40, 250, c.width * s, c.height * s);
  }
  if (t > 11.8) {
    if (!drawEnding.sealed) { drawEnding.sealed = true; sfx('snap', .7, .8); sfx('slap', .4, .7); }
    const k = clamp((t - 11.8) / .25, 0, 1), sc = .42 * (1 + (1 - k) * .35);
    ctx.globalAlpha = k * .92;
    ctx.drawImage(IMG.seal, W / 2 + 545 - 75 * sc, 262 - 10, 150 * sc, 270 * sc);
    ctx.globalAlpha = 1;
  }
  if (t > 13) {
    // the pages found, laid out as a row of little sheets
    const got = Object.keys(collected).filter(k => !k.startsWith('L')).length;
    const n = totalPages, cols = Math.min(n, 25), sz = 30;
    const x0 = W / 2 - (cols - 1) * (sz + 6) / 2;
    for (let k = 0; k < n; k++) {
      const x = x0 + (k % cols) * (sz + 6), y = 480 + ((k / cols) | 0) * (sz + 10);
      ctx.globalAlpha = clamp((t - 13 - k * .04) * 3, 0, 1) * (k < got ? 1 : .16);
      ctx.drawImage(IMG.pages, (k * 3) % 8 * 120, 0, 120, 120, x - sz / 2, y - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
  }
  if (t > 15) {
    const p = inkPressDark.at(clamp((t - 15) / 1.2, 0, 1));
    ctx.globalAlpha = .75;
    ctx.drawImage(p, W / 2 - p.width * .3, 600, p.width * .6, p.height * .6);
    ctx.globalAlpha = 1;
    if (!anyKeyFn && t > 16) anyKeyFn = () => { collected = {}; pianoStep = 0; drawEnding.noted = drawEnding.sealed = false; startGame(); };
  }
}

function startGame() {
  state = 'play'; xfade = snapshot(); xfadeT = 0;
  const r0 = Q.has('room') ? clamp(+Q.get('room') | 0, 0, ROOMS.length - 1) : 0;
  room = null; enterRoom(r0, 'next');
}

// ------------------------------------------------------------------ main loop
let last = performance.now(), acc = 0;
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  musicTick();
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  if (state === 'play') {
    acc += dt;
    while (acc >= 1 / 120) { update(1 / 120); if (state !== 'play') break; acc -= 1 / 120; }
    if (state === 'play') drawRoom();
  } else {
    T += dt;
    if (state === 'title') {
      if (titleT >= 0) titleT += dt;
      for (const m of motes) { m.x += m.vx * dt; m.y += m.vy * dt; }
      motes = motes.map(m => (m.y > H + 40) ? newMote(false) : m);
    }
    if (state === 'end') { endT += dt; for (const m of motes) { m.x += m.vx * dt; m.y += m.vy * dt; if (m.r !== undefined) m.r += m.vr * dt; } }
  }
  if (state === 'title') drawTitle();
  if (state === 'end') drawEnding();
  if (xfade) {
    xfadeT += dt;
    const a = 1 - xfadeT / .55;
    if (a <= 0) xfade = null;
    else { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = ease(a); ctx.drawImage(xfade, 0, 0); ctx.restore(); }
  }
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  if (state !== 'load') { finish(); drawTouch(); }
  requestAnimationFrame(frame);
}

async function boot() {
  const bar = document.getElementById('bar');
  const jobs = [...PLATES.map(n => () => loadImg(n, 'img/plates/')), ...SPRITES.map(n => () => loadImg(n, 'img/')), () => loadImg('paper', 'img/'),
                ...SOUNDS.map(n => () => fetchAudio(n))];
  let done = 0;
  await Promise.all(jobs.map(j => j().catch(e => console.warn(e)).then(() => { done++; bar.style.width = (done / jobs.length * 100) + '%'; })));
  document.getElementById('load').remove();
  makeFinish();
  inkTitle = new Ink(IMG.ink_title, IMG.ink_title_time, [243, 230, 200]);
  inkPress = new Ink(IMG.ink_press, IMG.ink_press_time, [243, 230, 200]);
  inkLine = new Ink(IMG.ink_line, IMG.ink_line_time, [46, 30, 40]);
  inkPressDark = new Ink(IMG.ink_press, IMG.ink_press_time, [70, 52, 58]);
  state = 'title'; room = { motes: 'moon' };
  for (let k = 0; k < 40; k++) motes.push(newMote(true));
  if (Q.has('room')) { anyKeyFn = () => { startAudio(); startGame(); }; }
  else anyKeyFn = () => {
    startAudio().then(() => setMusic('title'));
    titleT = 0;
    setTimeout(() => { anyKeyFn = () => startGame(); }, 1800);
  };
  window.__lp = { get state() { return state; }, fox, get room() { return room && room.id; }, enterRoom: i => enterRoom(i, 'next'), startGame, ROOMS,
                  get collected() { return collected; }, get buffers() { return Object.keys(BUF).length; }, startEnding, get endT() { return endT; }, set endT(v) { endT = v; } };
}
boot();
requestAnimationFrame(frame);
})();
