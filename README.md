# Video Lab

A menu of video-technique tests. Open `index.html` for the main menu; each test lives in its own folder under `videos/`.

| # | Test | Folder |
|---|------|--------|
| 01 | AO // Character Reveal: motion-graphics trailer, 13 cuts, 24 fps, 16:9 | `videos/01-ao-reveal/` |

Each test page plays live (Canvas 2D + Web Audio) and ships a rendered `*.mp4` + `poster.jpg`.

Re-render a test (needs Playwright/Chromium and ffmpeg):

```
node tools/render-video.js videos/01-ao-reveal
```

Shared fonts (SIL OFL: Anton, Archivo Black, Space Mono) and styles live in `assets/`.
