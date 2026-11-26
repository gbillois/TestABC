# Audit — The Last Page (ChetasLua/the-last-page)

| | |
| --- | --- |
| Repo | https://github.com/ChetasLua/the-last-page |
| Version auditée | commit `c41fef30b607a2498ee325f9549729d9a8e940c0` (2026-11-24, seul commit, clone `--depth 1`) |
| Ce qui est intégré | **Aucun code de la repo.** Seulement des images, des sprites et des sons **produits en exécutant** le code du film (peintures des plans, renard, livres, oiseaux et feuilles de papier, lettrage pinceau, sceau, musique et bruitages). Le moteur de jeu (`game.js`, `index.html`) est écrit par nous |
| Licence | ❗ **Aucun fichier de licence** dans la repo (tous droits réservés par défaut). Utilisation avec l'accord de l'auteur, **tel que rapporté par le propriétaire de TestABC** (même situation que « Crimson Loong » et « The Tea Ride » dans `ABCDEMO-GAMES.md`). Le README précise : « unofficial concept film, not made or endorsed by Anthropic » |
| Date de l'audit | 2026-11-26 |
| Verdict | ✅ **OK avec réserves** (voir la fin) |

## Profil de la repo

- 1 commit, 1 auteur (`ChetasLua`), 69 fichiers, environ 23 000 lignes de Python + 1 page HTML d'outillage et 1 script Node de test.
- Pas de binaire, pas d'image, pas de son, pas de police dans la repo : tout est calculé par le code (numpy, opencv, pycairo, scipy, numba, Pillow, soundfile). Graines aléatoires fixes : les rendus sont déterministes.
- Pas de dépendance vendorisée. Les dépendances viennent du registre officiel PyPI (voir 3).

## Vérifications effectuées

### 1. Code exécuté, réseau, code dynamique (lecture des sources)

| Contrôle | Résultat |
| --- | --- |
| Réseau | ✅ Aucun `socket`, `urllib`, `requests`, `http` en Python. Seul `tools/playtest.mjs` fait un `fetch` vers `http://127.0.0.1:<port>/json` (protocole de débogage Chrome local). Ce script **n'a pas été exécuté** |
| Sous-processus | `subprocess.Popen` uniquement vers `ffmpeg` dans `tools/master.py`, `render.py`, `diffs.py`, `assemble.py`. **Aucun de ces scripts n'a été exécuté** (nos scripts appellent les classes `Shot` directement) |
| Code dynamique | `importlib.import_module('shots.' + nom)` et `__import__(mod)` (`audio/build.py`) sur des noms de modules locaux codés en dur. Aucun `eval`, `exec`, `compile`, `pickle`, `marshal`, `ctypes`, aucune chaîne encodée |
| Écriture de fichiers | Caches `.npy` dans `cache/`, sons dans `out/`, à l'intérieur de la copie de travail. `tools/assemble.py` encode une vidéo en base64 dans une page HTML (non exécuté) |
| Télémétrie | ✅ Aucune |

### 2. Exécution en isolation

- Copie de travail dans un dossier scratch hors de TestABC (sans `.git`), lancée avec `python3 -I` (pas de `PYTHONPATH`, pas de site utilisateur, pas de dossier courant dans `sys.path`), dans un venv dédié.
- Exécuté : `audio/build.py` (bande-son et stems) ; les classes `Shot` de s1, s2, s5, s6, s7, s8, s9 (une image finie par plan choisi, via `comp.finish`) ; les fonctions de dessin `lp.foxside.side/trot`, `lp.books.book_free`, `lp.pages.bird/page`, `lp.props.lantern`, `lp.ink_letters.line_strokes` + `lp.brush.Sheet`, `lp.ink_letters.seal_mask`, `audio/sfx.py` et `audio/inst.piano_note`.
- Nos scripts de fabrication sont dans `tools/` (voir « Reproduire »). Pour les décors, le renard du film est retiré en remplaçant `foxact.draw` par une fonction neutre (`nofox`), sauf pour les deux plans de la fin (`s9_0060`, `s9_0140`).

### 3. Dépendances (PyPI officiel, roues binaires)

numpy 2.5.5, opencv-python-headless 5.1.0.95, pycairo 1.29.2, scipy 1.18.1, pillow 13.0.0, numba 0.68.1 (llvmlite 0.50.0), soundfile 0.14.0.
Le README prévoit conda-forge (micromamba) ; ici les paquets PyPI équivalents ont suffi. Aucune n'est livrée dans le jeu.

### 4. Fichiers livrés (dist, bundles, minifiés)

La repo n'en contient aucun (`dist/`, `out/`, `cache/` sont dans `.gitignore`). Rien à comparer octet pour octet : tous nos fichiers sont produits depuis les sources du commit figé.
Empreintes : `SOURCES.sha256` (les 69 fichiers de la repo) et `ASSETS.sha256` (les 58 fichiers produits, dans `img/` et `audio/`).

### 5. Le jeu (notre code)

| Contrôle | Résultat |
| --- | --- |
| CSP | `default-src 'self'` ; images `self data: blob:` ; médias et `connect-src` limités à `'self'` ; scripts `'self'` (pas de script inline) |
| Réseau | Uniquement `fetch('audio/*.mp3')` sur le même dossier. Pas de CDN, pas de police distante, pas de télémétrie |
| Code dynamique | Aucun `eval`, `new Function`, `import()`, Worker ou Service Worker |
| Contenu non fiable | Aucun : pas d'entrée utilisateur, pas d'`innerHTML` |

### 6. Test dynamique (Chromium headless, page servie en HTTP local, toute requête hors `127.0.0.1` journalisée)

| Scénario | Résultat |
| --- | --- |
| Titre, chaque salle (11), fin, rejouer | **0 requête externe**, 0 erreur JS, 0 violation CSP |
| Audio | 26 tampons décodés (Web Audio) |
| Parcours | sortie par le haut de la cage d'escalier, courant ascendant vers le balcon, sortie à droite des salles du ciel, chute et réapparition : OK |

## Reproduire

```bash
python3 -m venv venv && ./venv/bin/pip install numpy opencv-python-headless pycairo scipy pillow numba soundfile
git clone https://github.com/ChetasLua/the-last-page work && git -C work checkout c41fef30b607a2498ee325f9549729d9a8e940c0
(cd work && ../venv/bin/python -I audio/build.py)                                   # out/soundtrack.wav, out/stem_*.wav
./venv/bin/python -I tools/plates.py $PWD/work plates s2 30,150 nofox              # idem s1 150, s5 10,100, s6 60,120,160, s7 30, s8 60,120, s9 20 (nofox) et s9 60,140
./venv/bin/python -I tools/fox_sprites.py $PWD/work gen lantern gold
./venv/bin/python -I tools/props_sprites.py $PWD/work gen
./venv/bin/python -I tools/book_sprites.py $PWD/work gen
./venv/bin/python -I tools/raft_sprites.py $PWD/work gen
./venv/bin/python -I tools/ink_line.py $PWD/work gen "Every story begins with a blank page." .62 ink_line   # idem "the last page" 1.1 ink_title, "press any key" .42 ink_press
./venv/bin/python -I tools/sfx_render.py $PWD/work gen/sfx
```

Puis : décors redimensionnés en 1920×1080 (JPEG q85), sons encodés en MP3 (ffmpeg, 160 kb/s pour la musique, 96 kb/s pour les bruitages).
Le premier rendu de chaque plan peint ses fonds (de 1 à 7 minutes par plan sur 4 cœurs), les suivants lisent le cache.

## Réserves

1. **Licence** : pas de fichier de licence. L'accord de l'auteur a été rapporté oralement par le propriétaire ; il vaut mieux en garder une trace écrite (issue, message) ou demander l'ajout d'une licence à la repo.
2. Le film se présente comme un film de lancement non officiel pour un modèle. Le jeu n'en reprend ni le titre de produit ni le plan titre : la fin n'utilise que la phrase « Every story begins with a blank page. » et le sceau, réécrits par le pinceau du film.
3. Les plans `s9_0060` et `s9_0140` (scène finale) contiennent le renard peint du film, tels quels.
