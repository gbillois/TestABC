# Audit de sécurité — html-presentation-editor

| | |
| --- | --- |
| Repo | https://github.com/matheusbeccalli/html-presentation-editor |
| Commit audité | `fd03cd517d0112a8bbde8e73c25f3e0676cebb74` (2026-11-19) |
| Licence | MIT (© 2026 Matheus Beccalli) — fichier `LICENSE` copié ici |
| Date de l'audit | 2026-11-19 |
| Verdict | ✅ **OK pour intégration** (aucun problème bloquant, 3 points d'attention mineurs) |

## Ce qui est intégré dans TestABC

Seulement trois fichiers de la repo, sans modification :

| Fichier | Origine | SHA-256 |
| --- | --- | --- |
| `editor.html` | `dist/editor.html` | `8b98b9c19a5a3742f9fd5224572ea7ad587dc108090ca75a8675ceaeac3fec48` |
| `contract-deck.html` | `samples/contract-deck.html` | `522942ebb2adb920a2494f58fb824acaa2b44c53d7b80754ad56b2a40a05f135` |
| `LICENSE` | `LICENSE` | — |

Rien d'autre (tests Python, scripts de build, docs, autres samples) n'est copié.
`index.html` et `poster.jpg` dans ce dossier sont produits par nous.

## Profil de la repo

- Projet jeune : 141 commits entre le 2026-10-28 et le 2026-11-19, un seul auteur.
  Pas d'historique de confiance → on **fige le commit** et on ne fait jamais de mise à jour automatique.
- Application 100 % front-end, livrée en **un seul fichier HTML** (~1,8 Mo) construit par `build.py`
  (Python, bibliothèque standard uniquement) à partir de `src/` (~60 modules JS) et `vendor/`.
- Une seule dépendance tierce : **PptxGenJS 4.0.1** (MIT), qui embarque JSZip 3.10.1, pako, lie,
  setImmediate, readable-stream (MIT / zlib). Aucune licence GPL utilisée.
- Pas de `package.json`, pas de dépendances npm à l'exécution, pas de serveur, pas de télémétrie.

## Vérifications effectuées

### 1. Chaîne d'approvisionnement

| Contrôle | Résultat |
| --- | --- |
| `dist/editor.html` correspond-il au code source ? Rebuild avec `python3 -I build.py` puis `cmp` | ✅ **Identique octet pour octet** — le binaire livré ne cache rien qui ne soit pas dans `src/` |
| `vendor/pptxgenjs/pptxgen.bundle.js` correspond-il au paquet npm officiel ? Téléchargement de `pptxgenjs-4.0.1.tgz` depuis registry.npmjs.org | ✅ SHA-1 de l'archive = shasum npm (`cd0f202f…`), SHA-256 du bundle identique (`4fb9eac5…`) |
| Le build vérifie-t-il lui-même le hash des libs ? | ✅ `build.py` refuse de construire si le SHA-256 ne correspond pas |

### 2. Accès réseau / exfiltration

| Contrôle | Résultat |
| --- | --- |
| Content-Security-Policy | ✅ `default-src 'none'; connect-src 'none'; img-src data: blob:; font-src data:; …` — le navigateur bloque toute connexion sortante |
| APIs réseau dans le code source (`fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`) | ✅ Aucune occurrence dans `src/` (et `build.py` échoue si une apparaît) |
| URLs distantes dans `src=`, `href=`, `url(` | ✅ Aucune |
| Code obfusqué / dynamique : `eval`, `new Function`, `import()`, `importScripts`, `document.write`, Workers, Service Worker | ✅ Aucune occurrence |
| Seul `XMLHttpRequest` présent | Dans PptxGenJS (chargement d'une image par chemin), jamais appelé par l'éditeur et de toute façon bloqué par la CSP |

### 3. Ouverture de decks non fiables (XSS)

| Contrôle | Résultat |
| --- | --- |
| Rendu des slides | ✅ Toutes les iframes (canvas, miniatures, diaporama, mode présentateur, PDF, collage de tableaux) ont `sandbox="allow-same-origin"` **sans** `allow-scripts` |
| Nettoyage à l'import (`importer.js`) | ✅ Supprime `<script>`, gestionnaires `on*=`, liens `javascript:`, `<iframe>`, `<object>`, `<embed>`, `<base>`, `<meta http-equiv>` ; rapporte les ressources distantes |
| Liens hypertexte | ✅ Liste blanche : `http(s):`, `mailto:`, `#slide-…` uniquement ; ouverture avec `noopener` |
| `innerHTML` construit avec des données | ✅ Les 43 usages n'interpolent que des constantes / nombres ; `App.util.escapeHtml` existe pour le reste |

### 4. Test dynamique (Chromium headless)

Un deck piégé a été ouvert dans l'éditeur : `<script>` en tête, `<svg><script>`, `<img onerror>`,
lien `javascript:`, `<iframe>` distante, feuille de style, `@import`, image CSS et image distantes.

- ✅ Aucun script exécuté (variable témoin `PWNED` restée `undefined`).
- ✅ Aucune requête n'a atteint la couche réseau : les 4 ressources distantes ont toutes été bloquées
  par la CSP (`net::ERR_BLOCKED_BY_CSP`) ; l'iframe a été retirée.
- ✅ Le rapport d'import affiche correctement ce qui a été supprimé et bloqué.

## Points d'attention (non bloquants)

1. **Stockage partagé avec le reste du site.** Hébergé sur le même domaine que les autres tests,
   l'éditeur écrit dans `localStorage` (préférences) et `IndexedDB` (brouillons de récupération,
   fichiers récents). Ces données restent dans le navigateur de l'utilisateur, mais toute autre page
   du même domaine pourrait les lire. → Ne pas éditer de decks confidentiels via la version hébergée ;
   télécharger `editor.html` et l'ouvrir en local (c'est la recommandation de l'auteur lui-même).
2. **Repo très récente, mono-auteur.** → Commit figé ci-dessus. Toute mise à jour = nouvel audit
   (rebuild + diff + comparaison npm) avant de remplacer `editor.html`.
3. **Sample `copilot-messy-deck.html` volontairement « sale »** (charge chart.js et Google Fonts depuis
   des CDN pour tester l'import). Non copié dans TestABC : ouvert directement, il ferait des requêtes
   externes. Seul `contract-deck.html` (aucun script exécutable, aucune ressource distante) est fourni.

## Mettre à jour l'éditeur (procédure)

```bash
git clone https://github.com/matheusbeccalli/html-presentation-editor && cd html-presentation-editor
git checkout <nouveau-commit>
cp dist/editor.html /tmp/editor.dist.html
python3 -I build.py && cmp dist/editor.html /tmp/editor.dist.html      # doit être identique
# comparer vendor/*/ au paquet npm de la version annoncée dans vendor/README.md
# relire le diff src/ depuis fd03cd5 (git diff fd03cd5..HEAD -- src build.py vendor)
# refaire le test du deck piégé, puis mettre à jour ce fichier (commit + SHA-256)
```
