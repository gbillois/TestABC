# TestABC

Banc d'essai de tests rangés par catégorie. Ouvrir `index.html` pour la page d'accueil « My little sandbox ».

| Catégorie | Menu | Tests |
|---|---|---|
| Vidéo création | `videos/index.html` | 01 AO Character Reveal · 02 AO Reveal Trailer v2 |
| Slides création / édition | `slides/index.html` | 01 HTML Presentation Editor ([audit](slides/01-html-presentation-editor/AUDIT.md)) · 02 Bento Slides ([audit](slides/02-bento-slides/AUDIT.md)) |
| Games | — | Breakout (`breakout.html`) · The Last Page (`last-page/`, [audit](last-page/AUDIT.md)) |
| 3D adventures | — | Les Pics du Dragon · La Balade de Millépoques · Le Village de Millépoques · Les Trois Lueurs · Panda Fighter · Panda Fighter : le Dojo · La Ville du Pélican · Le Gardien de Mousse (copiés depuis ABCDEMO, voir `ABCDEMO-GAMES.md`) |
| The Cyber Book | — | The Cyber Book (`cyber-book/`) · night edition (`radar-rssi/`) · Radar concepts (`radar-concepts/`) |

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
