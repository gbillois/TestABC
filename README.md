# TestABC

Banc d'essai de tests rangés par catégorie. Ouvrir `index.html` pour la page d'accueil.

| Catégorie | Menu | Tests |
|---|---|---|
| Vidéo création | `videos/index.html` | 01 AO Character Reveal · 02 AO Reveal Trailer v2 |
| Slides création / édition | `slides/index.html` | 01 HTML Presentation Editor (repo externe, [audit](slides/01-html-presentation-editor/AUDIT.md)) |
| Jeux & divers | — | Breakout (`breakout.html`) |

Toute repo externe intégrée passe d'abord par un audit du code source (voir `CLAUDE.md`).

## Video Lab

A menu of video-technique tests. Open `videos/index.html` for the video menu; each test lives in its own folder under `videos/`.

| # | Test | Folder |
|---|------|--------|
| 01 | AO // Character Reveal: motion-graphics trailer, 13 cuts, 24 fps, 16:9 | `videos/01-ao-reveal/` |
| 02 | AO // Reveal Trailer v2: frame-exact canvas player, vector rig, shot list (live only, no MP4 yet) | `videos/02-ao-reveal-trailer/` |

Each test page plays live (Canvas 2D + Web Audio) and ships a rendered `*.mp4` + `poster.jpg`.

Re-render a test (needs Playwright/Chromium and ffmpeg):

```
node tools/render-video.js videos/01-ao-reveal
```

Shared fonts (SIL OFL: Anton, Archivo Black, Space Mono) and styles live in `assets/`.
