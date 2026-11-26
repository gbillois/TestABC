# Games copied from ABCDEMO

Copied on 2026-11-26 from `gbillois/ABCDEMO`, branch `main`, commit `6194163`, at the owner's request.
These are the **built, playable files only**. The tools that build them stay in ABCDEMO
(`outils/…`, `blender/…`): to change a game, change and rebuild it there, then copy it again.

| Menu entry | Files here | Built in ABCDEMO by | Third-party code / content |
|---|---|---|---|
| Les Pics du Dragon | `pics-dragon/` | written by hand (`pics-dragon/js/`) | three.js 0.170 from cdn.jsdelivr.net (MIT); only the *techniques* of ChetasLua's “Crimson Loong” film (no code copied) |
| La Balade de Millépoques | `balade/` (`jeu/` is a Vite build, `ville/` the baked images) | `outils/balade/fabriquer.sh` | Luminati engine (MIT, `balade/jeu/LICENCE-Luminati.txt`); images baked by the owner's private game Millépoques |
| Le Village de Millépoques | `village/` | `outils/village/` (images), code by hand | three.js 0.170 from CDN; images baked by Millépoques |
| Les Trois Lueurs | `lueurs/` (`jeu/` is a Vite build) | `outils/lumina/fabriquer.sh` | Luminati engine (MIT, `lueurs/jeu/LICENCE-Luminati.txt`) |
| Panda Fighter | `jeux/panda-fighter.html`, `jeux/panda-fighter/*.glb`, `jeux/chateau/lapin.bin` + `lapin.jpg` (rabbits) and `balade.mp3` (music, supplied by the owner) | `outils/panda/fabriquer.sh` | code from ChetasLua's “Crimson Loong” film (used with the author's agreement, as reported by the owner; that repo has no licence file); panda models from Meshy, supplied by the owner |
| Panda Fighter: le Dojo | `panda-dojo/` (Vite build, three.js bundled) | `outils/panda-dojo/fabriquer.sh` | three.js 0.171 and lil-gui (MIT), bundled; panda models from Meshy, supplied by the owner |
| La Ville du Pélican | `jeux/la-ville-du-pelican.html` | `outils/tea-ride/fabriquer.sh` | ChetasLua's “The Tea Ride” (used with the author's agreement); three.js r180 inlined (MIT) |
| Le Gardien de Mousse | `jeux/moss-keeper.html`, `jeux/moss-keeper/` (film.mp4 36 MB, affiche.jpg) | copied from ChetasLua's `moss-keeper` repo, commit `75148b8` | the film and player are by ChetasLua (“Feel free to copy it, remix it, and learn from it”; no licence file) |

Network at run time: only same-site files, the jsDelivr CDN for three.js, and Google Fonts. No server, no API.
The games' “home” buttons point to `../index.html`, which is this repo's menu.

Not a full audit in the sense of `CLAUDE.md` (no rebuild of the Vite bundles): these files come from
the owner's own repository, where the third-party sources were already reviewed.
