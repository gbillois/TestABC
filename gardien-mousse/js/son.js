// Sound: the film's soundtrack as music, plus small synthesized effects (Web Audio, no files).
//   Sound.start()  must be called from a click / key press (browser rule)
//   Sound.step(), Sound.thump(), Sound.wake(), Sound.launch(), Sound.chime(), Sound.ring()
//   Sound.setThrust(0..1), Sound.setWind(0..1), Sound.setMuted(bool)
import { CONFIG } from "./config.js";

export const Sound = (() => {
  let ctx = null, master, sfx, music, musicEl, noiseBuf, thrust, thrustGain, wind, windGain, hum, humGain, muted = false;

  function noise() {
    const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5 + w * 0.15; }
    return b;
  }
  function loopNoise(freq, q, type = "lowpass") {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f).connect(g).connect(sfx); src.start();
    return { f, g };
  }
  function env(node, t, a, peak, d) { node.gain.setValueAtTime(0.0001, t); node.gain.exponentialRampToValueAtTime(peak, t + a); node.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function tone(freq, dur, type = "sine", vol = 0.3, slideTo = null, delay = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    env(g, t, 0.01, vol, dur); o.connect(g).connect(sfx); o.start(t); o.stop(t + dur + 0.05);
  }
  function burst(freq, dur, vol = 0.5, type = "lowpass", delay = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + delay, s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; const g = ctx.createGain();
    env(g, t, 0.01, vol, dur); s.connect(f).connect(g).connect(sfx); s.start(t, Math.random()); s.stop(t + dur + 0.1);
  }

  return {
    start() {
      if (ctx) { ctx.resume(); return; }
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.connect(ctx.destination);
      sfx = ctx.createGain(); sfx.gain.value = CONFIG.sound.sfxVolume; sfx.connect(master);
      music = ctx.createGain(); music.gain.value = CONFIG.sound.musicVolume; music.connect(master);
      noiseBuf = noise();
      ({ f: thrust, g: thrustGain } = loopNoise(500, 0.8, "bandpass"));
      ({ f: wind, g: windGain } = loopNoise(400, 0.5));
      windGain.gain.value = 0.08;
      hum = ctx.createOscillator(); hum.type = "sawtooth"; hum.frequency.value = 55; humGain = ctx.createGain(); humGain.gain.value = 0;
      const hf = ctx.createBiquadFilter(); hf.type = "lowpass"; hf.frequency.value = 300; hum.connect(hf).connect(humGain).connect(sfx); hum.start();
      musicEl = new Audio(CONFIG.sound.music); musicEl.loop = true; musicEl.crossOrigin = "anonymous";
      ctx.createMediaElementSource(musicEl).connect(music);
      musicEl.play().catch(() => {});
      // birdsong now and then
      setInterval(() => { if (!muted && Math.random() < 0.5) { const f = 2400 + Math.random() * 1600; for (let i = 0; i < 2 + Math.random() * 4; i++) tone(f, 0.07, "sine", 0.025, f * 1.3, i * 0.11); } }, 2600);
    },
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 1; },
    get muted() { return muted; },
    setThrust(v, boost) { if (!ctx) return; thrustGain.gain.setTargetAtTime(v * (boost ? 0.35 : 0.18), ctx.currentTime, 0.1); thrust.frequency.setTargetAtTime(300 + v * 500 + (boost ? 600 : 0), ctx.currentTime, 0.2); },
    setWind(v) { if (!ctx) return; windGain.gain.setTargetAtTime(0.05 + v * 0.3, ctx.currentTime, 0.3); wind.frequency.setTargetAtTime(300 + v * 900, ctx.currentTime, 0.3); },
    setHum(v) { if (!ctx) return; humGain.gain.setTargetAtTime(v * 0.08, ctx.currentTime, 0.1); hum.frequency.setTargetAtTime(45 + v * 40, ctx.currentTime, 0.2); },
    step() { tone(60, 0.25, "sine", 0.45, 35); burst(260, 0.18, 0.25); },
    thump() { tone(48, 0.5, "sine", 0.7, 28); burst(180, 0.5, 0.6); },
    wake() { tone(110, 2.5, "sawtooth", 0.06, 220); [523, 659, 784, 1046].forEach((f, i) => tone(f, 1.4, "triangle", 0.08, null, 0.25 + i * 0.18)); },
    launch() { burst(900, 1.2, 0.7, "bandpass"); tone(90, 1.2, "sawtooth", 0.12, 400); },
    chime() { [880, 1175, 1568].forEach((f, i) => tone(f, 0.9, "sine", 0.12, null, i * 0.09)); },
    ring() { [659, 988, 1319, 1760].forEach((f, i) => tone(f, 1.2, "triangle", 0.1, null, i * 0.07)); },
  };
})();
