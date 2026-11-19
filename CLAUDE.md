# TestABC — règles du projet

Banc d'essai de tests rangés par catégorie. Page d'accueil : `index.html` (tableau `CATEGORIES`).

## Structure

- `index.html` — accueil, une section par catégorie.
- `videos/` — catégorie « Vidéo création » (menu `videos/index.html`, un dossier `NN-nom/` par test).
- `slides/` — catégorie « Slides création / édition » (menu `slides/index.html`, un dossier `NN-nom/` par test).
- `breakout.html` — catégorie « Jeux & divers ».
- `assets/` — polices (OFL), `lab.css` (styles partagés), `cards.js` (cartes de tests).

Ajouter un test = un dossier + une entrée dans le menu de la catégorie **et** dans `CATEGORIES` de l'accueil.

## Règle : audit obligatoire de toute repo externe

Dès qu'une repo / bibliothèque externe est ajoutée (ou mise à jour), faire un audit du code source
**avant** de l'intégrer, et écrire `AUDIT.md` dans le dossier du test. Modèle :
`slides/01-html-presentation-editor/AUDIT.md`. Minimum à vérifier :

1. Licence compatible (pas de GPL/AGPL sans accord), maturité de la repo, nombre d'auteurs.
2. Figer un commit précis ; noter le SHA-256 de chaque fichier copié.
3. Fichiers livrés (dist, bundles, minifiés) : les reconstruire depuis les sources et comparer octet pour octet.
   Si le build exige d'exécuter du code tiers (npm install, vite…) et n'est pas autorisé ici : ne pas contourner ;
   vérifier à la place la signature / le hash publiés par le mainteneur, décompresser et analyser le binaire,
   et le noter comme réserve dans `AUDIT.md` (exemple : `slides/02-bento-slides/AUDIT.md`).
4. Dépendances vendorisées : comparer au paquet officiel du registre (npm, PyPI…).
5. Réseau : CSP, `fetch` / XHR / WebSocket / beacon, URLs distantes, télémétrie.
6. Code dynamique / obfusqué : `eval`, `new Function`, `import()`, Workers, Service Workers, chaînes encodées.
7. Contenu non fiable (XSS) : sandbox des iframes, nettoyage à l'import, `innerHTML`, schémas de liens.
8. Test dynamique dans Chromium (requêtes externes interceptées et annulées) : entrée piégée, aucun script exécuté,
   inventaire des requêtes sortantes par défaut. Si l'outil contacte Internet par défaut, la page de test l'ouvre en mode hors ligne.
9. Ne copier que le strict nécessaire, sans le modifier ; scripts de build/tests de la repo exécutés uniquement en isolation (`python3 -I`, dossier scratch).

Verdict explicite dans `AUDIT.md` : OK / OK avec réserves / refusé.
