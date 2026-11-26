# Le Gardien de Mousse : le jeu

A playable version of the short film « The Moss Keeper » by ChetasLua (the film itself is in `../jeux/moss-keeper.html`).
You are the moss-covered giant: wake it up in the glade, walk among the trees, take off and fly above the sea of clouds.
Goal: 6 golden seeds in the forest (half of them on top of the trees) and 6 rings of light above the clouds.

Open `index.html` through a web server (ES modules do not load from `file://`).

## How to adapt it

**Start with `js/config.js`.** Every colour, size, speed, count and quality level is there, with a comment.
Some examples:

| You want… | Change in `config.js` |
|---|---|
| a bigger or smaller keeper | `robot.scale` |
| more or less moss | `robot.mossDensity` (0.3 to 1.5) |
| other robot colours | `robot.metal`, `robot.panel`, `robot.teal`, `robot.rust`, `robot.glow` |
| no little tree on the shoulder | `robot.shoulderTree: false` |
| a denser or taller forest | `world.treeCount`, `world.treeHeight` |
| a different time of day | `sun.*`, `sky.*`, `fog.*` |
| faster flight | `move.flyCruise`, `move.flyBoost` |
| more goals | `goals.seeds`, `goals.rings` |
| a lighter or stronger painted look | `quality.*.paint` (Kuwahara radius, 0 = off), `post.*` |

## Files

| File | What it does |
|---|---|
| `js/config.js` | all tunable values |
| `js/jeu.js` | game loop and states (title, sleep, wake, play), controls, camera, HUD |
| `js/gardien.js` | the keeper: shapes, moss, porthole, fans, rig and **all animations** (`POSES` section: sleep, stand, crouch, stretch, jump, hover, fly; walk cycle in `targetPose`) |
| `js/foret.js` | ground, trees, vines, grass and flowers that follow the player, mist, sun shafts, falling leaves, tree collisions |
| `js/ciel.js` | painted sunrise sky, far bird flocks |
| `js/nuages.js` | the sea of clouds (appears as you climb) |
| `js/oiseau.js` | the little blue bird that perches on the keeper and follows it |
| `js/effets.js` | dust clouds, moss debris, sparkles, light beams, shock rings, flight trails |
| `js/objectifs.js` | seeds and rings |
| `js/post.js` | bloom, painterly Kuwahara filter, colour grade, vignette, paper grain |
| `js/son.js` | music (the film's soundtrack) and synthesized sound effects |
| `js/commun.js` | shared helpers: the painted toon material, noise, terrain height, textures |
| `son/musique.m4a` | soundtrack, extracted unchanged from `../jeux/moss-keeper/film.mp4` |

To add a pose: copy one of the objects in the `POSES` section of `gardien.js` (angles in radians) and use it in `targetPose`.
To add a state (swimming, sitting…): add a `mode` case in `targetPose` and set it from `jeu.js`.

## Controls

Keyboard: hold Space to wake the keeper. ZQSD / WASD / arrows to walk, Shift to run, Space to jump, F to take off.
In flight: forward to fly, Q/D (A/D) to turn, Space to climb, C or Ctrl to dive, Shift for turbo, F to land.
Mouse drag to look around, wheel to zoom, Esc for pause, M for sound.
Touch: joystick on the left, buttons on the right (▲ jump / climb, ▼ dive, ✈ take off / land, ⚡ turbo).

Test helpers in the URL: `?q=haute|moyenne|rapide` forces the picture quality, `?perf` shows frame rate,
`?etat=sol` or `?etat=vol` skips the wake-up, `?d=40&a=0.5` frames the title camera.

## Origin

All code was written for this game. Only three.js 0.170 (MIT) is loaded, from cdn.jsdelivr.net, like the other 3D games here,
and the fonts come from Google Fonts. The look follows the film's frames; no code from the film's repository was used
(that repository only holds the rendered video). The music is the film's own soundtrack: the author wrote
« Feel free to copy it, remix it, and learn from it » (see `../ABCDEMO-GAMES.md`).
No new external repository or library was integrated, so no `AUDIT.md` is needed under the rule in `CLAUDE.md`.
