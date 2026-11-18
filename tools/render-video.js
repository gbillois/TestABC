#!/usr/bin/env node
/*
 * Render a Video Lab test page to MP4 (H.264 + AAC) and a poster JPEG.
 *   node tools/render-video.js videos/01-ao-reveal [--out ao-reveal.mp4] [--poster 296] [--crf 18]
 * The page must expose window.VIDEO_TEST = { width, height, fps, frames, poster?, ready(), frame(F, type, q), audioWav()? }
 * when opened with ?export. Needs Playwright (Chromium) and ffmpeg on PATH.
 */
const path = require('path'), fs = require('fs'), os = require('os'), { spawn } = require('child_process');
const { chromium } = require('playwright');

const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : def; };
if (!argv[0] || argv[0].startsWith('--')) { console.error('usage: node tools/render-video.js <test-folder> [--out file.mp4] [--poster F] [--crf N]'); process.exit(1); }
const dir = path.resolve(argv[0]);
const out = path.join(dir, opt('--out', path.basename(dir).replace(/^\d+-/, '') + '.mp4'));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => console.error('page error:', e.message));
  await page.goto('file://' + path.join(dir, 'index.html') + '?export=1');
  await page.waitForFunction(() => window.VIDEO_TEST);
  await page.evaluate(() => window.VIDEO_TEST.ready());
  const meta = await page.evaluate(() => { const v = window.VIDEO_TEST; return { w: v.width, h: v.height, fps: v.fps, frames: v.frames, poster: v.poster, audio: !!v.audioWav }; });
  console.log(`rendering ${meta.frames} frames @ ${meta.fps} fps, ${meta.w}x${meta.h} -> ${path.relative(process.cwd(), out)}`);

  let wav = null;
  if (meta.audio) {
    const b64 = await page.evaluate(() => window.VIDEO_TEST.audioWav());
    wav = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vlab-')), 'audio.wav');
    fs.writeFileSync(wav, Buffer.from(b64, 'base64'));
  }

  const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(meta.fps), '-c:v', 'mjpeg', '-i', '-'];
  if (wav) args.push('-i', wav);
  args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', opt('--crf', '18'), '-pix_fmt', 'yuv420p', '-r', String(meta.fps), '-movflags', '+faststart');
  if (wav) args.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
  args.push(out);
  const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg exited ' + c)))));

  for (let F = 0; F < meta.frames; F++) {
    const url = await page.evaluate(f => window.VIDEO_TEST.frame(f, 'image/jpeg', 0.95), F);
    const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (F % 48 === 0) process.stdout.write(`  frame ${F}/${meta.frames}\r`);
  }
  ff.stdin.end();
  await done;

  const pf = meta.poster != null ? meta.poster : Math.floor(meta.frames / 2);
  const purl = await page.evaluate(f => window.VIDEO_TEST.frame(f, 'image/jpeg', 0.85), pf);
  fs.writeFileSync(path.join(dir, 'poster.jpg'), Buffer.from(purl.slice(purl.indexOf(',') + 1), 'base64'));
  await browser.close();
  console.log(`done: ${path.relative(process.cwd(), out)} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB) + poster.jpg (frame ${pf})`);
})().catch(e => { console.error(e); process.exit(1); });
