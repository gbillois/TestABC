'use strict';
/* ------------------------------------------------------------------
   Viewer: transport, scrubbing timeline, shot list, optional synth beat.
------------------------------------------------------------------- */
(() => {
  const $ = id => document.getElementById(id);
  const canvas = $('film'), g = canvas.getContext('2d');
  const stage = $('stage'), timeline = $('timeline'), headEl = $('head');
  const qs = new URLSearchParams(location.search);

  let frame = 0, playing = false, speed = 1, loop = true, loopCut = false, sound = false;
  let t0 = 0, f0 = 0, raf = 0, lastDrawn = -1;

  /* ---------- build timeline + shot list ---------- */
  const segs = [], shots = [];
  CUT_INFO.forEach((c, i) => {
    const s = document.createElement('div');
    s.className = 'seg'; s.style.flex = String(BOUNDS[i + 1] - BOUNDS[i]);
    s.textContent = String(i + 1).padStart(2, '0'); s.title = `Cut ${i + 1} — ${c.title} (${c.tc}s)`;
    timeline.insertBefore(s, headEl); segs.push(s);

    const b = document.createElement('button');
    b.className = 'shot' + (i >= 11 ? ' proposed' : '');
    b.innerHTML = `<span class="n">${String(i + 1).padStart(2, '0')}</span><span class="t">${c.title}</span><span class="tc">${c.tc}s · ${BOUNDS[i + 1] - BOUNDS[i]} frames</span><p>${c.desc}</p>`;
    b.addEventListener('click', () => { seek(BOUNDS[i]); stage.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
    $('shots').appendChild(b); shots.push(b);
  });

  /* ---------- render + readouts ---------- */
  function draw(force) {
    if (frame === lastDrawn && !force) return;
    lastDrawn = frame;
    const i = renderFrame(g, frame);
    headEl.style.left = (frame / (TOTAL - 1) * 100) + '%';
    const sec = Math.floor(frame / FPS), ff = frame % FPS;
    $('tc').textContent = String(sec).padStart(2, '0') + ':' + String(ff).padStart(2, '0');
    $('fr').textContent = String(frame).padStart(3, '0');
    $('cutName').textContent = String(i + 1).padStart(2, '0') + ' ' + CUT_INFO[i].title;
    segs.forEach((s, n) => { s.classList.toggle('on', n === i); s.classList.toggle('done', n < i); });
    shots.forEach((s, n) => s.classList.toggle('on', n === i));
  }

  /* ---------- transport ---------- */
  function tick(now) {
    if (!playing) return;
    let f = f0 + Math.floor((now - t0) / 1000 * FPS * speed);
    const lo = loopCut ? BOUNDS[cutAt(f0)] : 0, hi = loopCut ? BOUNDS[cutAt(f0) + 1] : TOTAL;
    if (f >= hi) {
      if (loop || loopCut) { f0 = lo; t0 = now; f = lo; startAudio(lo); }
      else { frame = hi - 1; draw(); pause(); return; }
    }
    frame = f; draw();
    raf = requestAnimationFrame(tick);
  }
  function play() {
    if (playing) return;
    if (frame >= TOTAL - 1) frame = 0;
    playing = true; f0 = frame; t0 = performance.now();
    stage.classList.add('playing'); $('play').textContent = 'Pause';
    startAudio(frame);
    raf = requestAnimationFrame(tick);
  }
  function pause() {
    playing = false; cancelAnimationFrame(raf); stopAudio();
    stage.classList.remove('playing'); $('play').textContent = 'Play';
  }
  function seek(f, keepPlaying) {
    const was = playing && keepPlaying;
    pause();
    frame = clamp(Math.round(f), 0, TOTAL - 1); stage.classList.add('scrubbed'); draw();
    if (was) play();
  }
  const toggle = () => (playing ? pause() : (stage.classList.remove('scrubbed'), play()));
  const stepCut = d => { const i = cutAt(frame); seek(d < 0 ? (frame > BOUNDS[i] ? BOUNDS[i] : BOUNDS[Math.max(0, i - 1)]) : BOUNDS[Math.min(12, i + 1)]); };

  $('play').addEventListener('click', toggle);
  stage.addEventListener('click', toggle);
  $('prevF').addEventListener('click', () => seek(frame - 1));
  $('nextF').addEventListener('click', () => seek(frame + 1));
  $('prevCut').addEventListener('click', () => stepCut(-1));
  $('nextCut').addEventListener('click', () => stepCut(1));
  $('speed').addEventListener('change', e => { const was = playing; pause(); speed = +e.target.value; if (was) play(); });
  const press = (id, v) => $(id).setAttribute('aria-pressed', String(v));
  $('loop').addEventListener('click', () => { loop = !loop; press('loop', loop); });
  $('loopCut').addEventListener('click', () => { loopCut = !loopCut; press('loopCut', loopCut); if (playing) { pause(); play(); } });
  $('sound').addEventListener('click', () => { sound = !sound; press('sound', sound); if (playing) { stopAudio(); startAudio(frame); } });
  $('fs').addEventListener('click', () => (document.fullscreenElement ? document.exitFullscreen() : stage.requestFullscreen && stage.requestFullscreen()));

  // scrubbing
  let drag = false;
  const scrub = e => { const r = timeline.getBoundingClientRect(); seek(clamp((e.clientX - r.left) / r.width) * (TOTAL - 1)); };
  timeline.addEventListener('pointerdown', e => { drag = true; timeline.setPointerCapture(e.pointerId); scrub(e); });
  timeline.addEventListener('pointermove', e => { if (drag) scrub(e); });
  timeline.addEventListener('pointerup', () => { drag = false; });
  timeline.addEventListener('pointercancel', () => { drag = false; });

  addEventListener('keydown', e => {
    if (e.target.tagName === 'SELECT' || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === ' ') { e.preventDefault(); toggle(); }
    else if (k === 'ArrowLeft') { e.preventDefault(); seek(frame - (e.shiftKey ? 6 : 1)); }
    else if (k === 'ArrowRight') { e.preventDefault(); seek(frame + (e.shiftKey ? 6 : 1)); }
    else if (k === 'ArrowUp') { e.preventDefault(); stepCut(-1); }
    else if (k === 'ArrowDown') { e.preventDefault(); stepCut(1); }
    else if (k === 'l' || k === 'L') $('loop').click();
    else if (k === 'c' || k === 'C') $('loopCut').click();
    else if (k === 'm' || k === 'M') $('sound').click();
    else if (k === 'f' || k === 'F') $('fs').click();
    else if (k === 'Home') seek(0);
    else if (k === 'End') seek(TOTAL - 1);
  });

  /* ---------- optional synth beat (WebAudio), scheduled from the hit list ---------- */
  // [frame, type]  K = kick, S = snare/shutter, T = tick, W = whoosh
  const HITS = [
    [2, 'K'], [5, 'W'], [12, 'K'], [17, 'K'], [17, 'S'],
    [24, 'W'], [26, 'S'], [34, 'T'], [40, 'S'], [42, 'K'], [42, 'S'],
    [48, 'K'], [56, 'S'], [56, 'W'], [68, 'W'],
    [74, 'K'], [77, 'S'], [82, 'S'], [87, 'K'], [92, 'T'], [93, 'T'], [94, 'T'],
    [96, 'K'], [96, 'W'], [105, 'T'], [113, 'K'], [113, 'S'],
    [122, 'K'], [126, 'S'], [130, 'K'], [134, 'W'],
    [144, 'K'], [150, 'T'], [156, 'S'], [161, 'T'], [165, 'K'],
    [168, 'K'], [168, 'S'], [174, 'K'], [174, 'S'], [180, 'K'], [180, 'S'], [186, 'K'], [186, 'S'],
    [192, 'K'], [196, 'T'], [199, 'T'], [202, 'T'], [205, 'S'], [206, 'K'], [208, 'T'], [209, 'T'], [211, 'T'], [213, 'T'],
    [216, 'K'], [218, 'S'], [224, 'S'], [224, 'K'], [230, 'S'], [230, 'K'], [235, 'W'],
    [242, 'K'], [242, 'S'], [248, 'K'], [248, 'S'], [254, 'K'], [254, 'S'], [260, 'K'], [260, 'S'],
    [266, 'W'], [271, 'K'], [271, 'S'], [290, 'T'], [293, 'T'], [296, 'T'], [299, 'T'], [302, 'T'],
    [312, 'K'], [316, 'K'], [316, 'S'], [320, 'W'], [324, 'T'], [327, 'T'], [330, 'T'], [352, 'K'], [352, 'S'],
  ];
  let ac = null, master = null;
  function stopAudio() { if (master) { try { master.gain.cancelScheduledValues(0); master.gain.value = 0; master.disconnect(); } catch (e) {} master = null; } }
  function startAudio(from) {
    stopAudio();
    if (!sound || speed !== 1) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);
      const now = ac.currentTime + 0.03, m = master;
      const noise = (() => { const b = ac.createBuffer(1, ac.sampleRate * 0.6, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; })();
      const env = (t, a, d, peak) => { const v = ac.createGain(); v.gain.setValueAtTime(0.0001, t); v.gain.exponentialRampToValueAtTime(peak, t + a); v.gain.exponentialRampToValueAtTime(0.0001, t + a + d); v.connect(m); return v; };
      for (const [f, type] of HITS) {
        if (f < from) continue;
        const t = now + (f - from) / FPS;
        if (type === 'K') {
          const o = ac.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(170, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.16);
          o.connect(env(t, 0.004, 0.3, 1)); o.start(t); o.stop(t + 0.4);
        } else if (type === 'S') {
          const s = ac.createBufferSource(); s.buffer = noise; const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
          s.connect(hp); hp.connect(env(t, 0.002, 0.12, 0.5)); s.start(t); s.stop(t + 0.2);
        } else if (type === 'T') {
          const o = ac.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(2400, t);
          o.connect(env(t, 0.001, 0.03, 0.12)); o.start(t); o.stop(t + 0.06);
        } else {
          const s = ac.createBufferSource(); s.buffer = noise; const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
          bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(4200, t + 0.28);
          s.connect(bp); bp.connect(env(t, 0.12, 0.2, 0.4)); s.start(t); s.stop(t + 0.4);
        }
      }
    } catch (e) { master = null; }
  }

  /* ---------- boot ---------- */
  window.AO_FILM = { FPS, TOTAL, BOUNDS, canvas, renderFrame: f => renderFrame(g, f), seek, play, pause };
  const fonts = document.fonts ? Promise.all([document.fonts.load("400 100px 'Anton'"), document.fonts.load("700 20px 'JetBrains Mono'")]) : Promise.resolve();
  const boot = () => {
    $('loading').remove();
    const f = qs.get('f');
    if (f != null) { frame = clamp(parseInt(f, 10) || 0, 0, TOTAL - 1); stage.classList.add('scrubbed'); }
    draw(true);
    window.AO_FILM.ready = true;
  };
  fonts.then(boot, boot);
})();
