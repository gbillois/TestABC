// Le son, tout synthétisé (Web Audio) : vent de la course, souffle du feu, rugissement, cascades, cithare et tambours, carillon.
export const Son = (() => {
  let ctx = null, maitre, echo, bruit, ventG, ventF, feuG, feuF, eauG, prochaine = 0, degre = 5, tambour = 0, actif = true;
  const GAMME = [0, 2, 4, 7, 9];
  const freq = d => { const o = Math.floor(d / 5), n = ((d % 5) + 5) % 5; return 146.83 * Math.pow(2, o + GAMME[n] / 12); };
  function demarrer(on) {
    actif = on;
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    maitre = ctx.createGain(); maitre.gain.value = on ? 0.9 : 0; maitre.connect(ctx.destination);
    echo = ctx.createDelay(1.2); echo.delayTime.value = 0.46; const fb = ctx.createGain(), lp = ctx.createBiquadFilter(); fb.gain.value = 0.36; lp.frequency.value = 1700;
    echo.connect(lp); lp.connect(fb); fb.connect(echo); const eg = ctx.createGain(); eg.gain.value = 0.45; lp.connect(eg); eg.connect(maitre);
    bruit = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate); const d = bruit.getChannelData(0); let b = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b = (b + 0.02 * w) / 1.02; d[i] = w * 0.5 + b * 3; }
    const boucle = (gain, filtre, f, Q, rate = 1) => { const s = ctx.createBufferSource(); s.buffer = bruit; s.loop = true; s.playbackRate.value = rate; const fl = ctx.createBiquadFilter(); fl.type = filtre; fl.frequency.value = f; fl.Q.value = Q; const g = ctx.createGain(); g.gain.value = gain; s.connect(fl); fl.connect(g); g.connect(maitre); s.start(); return [g, fl]; };
    [ventG, ventF] = boucle(0.1, "lowpass", 300, 0.8);
    [feuG, feuF] = boucle(0, "bandpass", 700, 0.6, 1.4);
    [eauG] = boucle(0, "bandpass", 1100, 0.5, 1.2);
    for (const [f, g] of [[73.4, 0.04], [110, 0.02]]) { const o = ctx.createOscillator(); o.frequency.value = f; const og = ctx.createGain(); og.gain.value = g; o.connect(og); og.connect(maitre); o.start(); }
    prochaine = ctx.currentTime + 1;
  }
  function pincer(f, q, fort = 0.12, duree = 2.6) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
    o.type = "triangle"; o2.type = "sine"; o.frequency.setValueAtTime(f * 1.012, q); o.frequency.exponentialRampToValueAtTime(f, q + 0.08); o2.frequency.value = f * 2.004;
    fl.type = "lowpass"; fl.frequency.setValueAtTime(f * 9, q); fl.frequency.exponentialRampToValueAtTime(f * 1.6, q + duree);
    g.gain.setValueAtTime(0, q); g.gain.linearRampToValueAtTime(fort, q + 0.006); g.gain.exponentialRampToValueAtTime(0.0005, q + duree);
    o.connect(fl); o2.connect(fl); fl.connect(g); g.connect(maitre); g.connect(echo); o.start(q); o2.start(q); o.stop(q + duree + 0.1); o2.stop(q + duree + 0.1);
  }
  function coup(q, f = 70, fort = 0.35) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(f * 2, q); o.frequency.exponentialRampToValueAtTime(f, q + 0.12);
    g.gain.setValueAtTime(fort, q); g.gain.exponentialRampToValueAtTime(0.001, q + 0.6); o.connect(g); g.connect(maitre); o.start(q); o.stop(q + 0.7);
  }
  function maj(dt, vitesse, feu, eau) {
    if (!ctx) return; const t = ctx.currentTime;
    ventG.gain.setTargetAtTime(0.05 + 0.32 * Math.min(1, vitesse / 46) ** 1.5, t, 0.2); ventF.frequency.setTargetAtTime(220 + vitesse * 22, t, 0.2);
    feuG.gain.setTargetAtTime(feu * 0.5, t, 0.05); feuF.frequency.setTargetAtTime(500 + feu * 500 + Math.random() * 200, t, 0.03);
    eauG.gain.setTargetAtTime(eau * 0.25, t, 0.3);
    if (t > prochaine) {
      const n = 1 + Math.floor(Math.random() * 4); let q = t + 0.05;
      for (let i = 0; i < n; i++) { degre = Math.max(3, Math.min(13, degre + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)])); pincer(freq(degre), q, 0.09 + Math.random() * 0.05); q += [0.33, 0.5, 0.66, 1.0][Math.floor(Math.random() * 4)]; }
      if (++tambour % 3 === 0) { coup(q, 62, 0.25); coup(q + 0.75, 62, 0.15); }
      prochaine = q + 1.2 + Math.random() * 3;
    }
  }
  function rugir() {
    if (!ctx) return; const q = ctx.currentTime, o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = o2.type = "sawtooth"; o.frequency.setValueAtTime(110, q); o.frequency.exponentialRampToValueAtTime(55, q + 1.8); o2.frequency.setValueAtTime(113, q); o2.frequency.exponentialRampToValueAtTime(57, q + 1.8);
    lp.frequency.setValueAtTime(300, q); lp.frequency.linearRampToValueAtTime(1000, q + 0.25); lp.frequency.exponentialRampToValueAtTime(200, q + 1.9);
    g.gain.setValueAtTime(0, q); g.gain.linearRampToValueAtTime(0.35, q + 0.2); g.gain.exponentialRampToValueAtTime(0.001, q + 2.0);
    const n = ctx.createBufferSource(); n.buffer = bruit; const nf = ctx.createBiquadFilter(); nf.type = "bandpass"; nf.frequency.value = 500; const ng = ctx.createGain(); ng.gain.setValueAtTime(0.3, q); ng.gain.exponentialRampToValueAtTime(0.001, q + 1.6);
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(maitre); g.connect(echo); n.connect(nf); nf.connect(ng); ng.connect(maitre);
    o.start(q); o2.start(q); n.start(q); o.stop(q + 2.1); o2.stop(q + 2.1); n.stop(q + 2.1);
  }
  function carillon(grand) {
    if (!ctx) return; const q = ctx.currentTime;
    (grand ? [7, 9, 11, 12, 14, 16, 19] : [9, 12, 14]).forEach((dg, i) => { const f = freq(dg), t0 = q + i * 0.14;
      for (const [m, a] of [[1, 0.12], [2.76, 0.04], [5.4, 0.02]]) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f * m; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(a, t0 + 0.005); g.gain.exponentialRampToValueAtTime(0.0005, t0 + 2.6 / m); o.connect(g); g.connect(maitre); g.connect(echo); o.start(t0); o.stop(t0 + 2.8); } });
    if (grand) coup(q, 50, 0.5);
  }
  function couper(on) { actif = on; if (maitre) maitre.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.05); }
  return { demarrer, maj, rugir, carillon, couper };
})();
