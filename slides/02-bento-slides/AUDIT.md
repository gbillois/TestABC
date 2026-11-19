# Audit de sécurité — Bento Slides (bento.page)

| | |
| --- | --- |
| Site / repo | https://bento.page · https://github.com/nyblnet/bento |
| Version auditée | **v1.2.13** : tag `7de22de76e264170931e0fa0534f8a82fcddef4f` (2026-11-09) |
| Fichier intégré | `Bento_Slides.bento.html` de la release v1.2.13 |
| Licence | MIT (© 2026 The Bento authors). Composants embarqués : reveal.js, Moveable, Selecto (MIT) ; polices Fraunces et Instrument Sans (OFL). Voir `THIRD_PARTY_NOTICES.md` |
| Date de l'audit | 2026-11-19 |
| Verdict | ✅ **OK avec réserves** : à utiliser en **mode hors ligne** (c'est le lien par défaut de notre page de test) |

## Ce qui est intégré dans TestABC

| Fichier | Origine | SHA-256 |
| --- | --- | --- |
| `Bento_Slides.bento.html` | Release GitHub v1.2.13 (identique à celle de bento.page) | `12cbb62c3a6b70937396f9faa955708c955c0bab9ef2e6a2cabe965233bccede` |
| `LICENSE`, `THIRD_PARTY_NOTICES.md` | Tag v1.2.13 | — |

Rien d'autre de la monorepo n'est copié : ni les apps Dash, Spaces ou Type, ni le serveur, ni les apps desktop/Android, ni les scripts.
Le service `server/directory/` est sous AGPL-3.0, mais il ne fait pas partie du fichier Slides et n'est pas intégré.
Les fichiers `index.html` et `poster.jpg` de ce dossier sont produits par nous.

## Profil de la repo

- Monorepo active : 1 317 commits entre le 2026-07-15 et le 2026-11-15, 22 contributeurs. Un mainteneur principal (`nyblnet`) a fait environ 96 % des commits.
- Politique de sécurité publique (`SECURITY.md`, signalement privé via GitHub). Des advisories ont été traités, par exemple GHSA-5c3x-xqp6-g94r sur le mode hors ligne. Les versions 1.2.12 et 1.2.13 sont des correctifs de sécurité.
  → Le projet est suivi activement, mais sa surface d'attaque est réelle : il faut **suivre les mises à jour**.
- L'application est en TypeScript, construite avec Vite en un seul fichier HTML. La release est **compressée** : le JS et le CSS sont dans des blocs `deflate` encodés en base86, décompressés au lancement par un loader d'environ 11 Ko.

## Vérifications effectuées

### 1. Authenticité et chaîne d'approvisionnement

| Contrôle | Résultat |
| --- | --- |
| Fichier bento.page = fichier de la release GitHub v1.2.13 | ✅ SHA-256 identique |
| Manifeste de release signé | ✅ Signature **ECDSA P-256 vérifiée** (Python `cryptography`) avec la clé publique présente dans `kernel/src/update.ts` (v1.2.13). Le manifeste épingle exactement le SHA-256 ci-dessus |
| Clé de confiance figée dans le binaire | ✅ La même clé publique est présente dans le runtime décompressé |
| Rebuild depuis les sources | ⚠️ **Non réalisé**. `npm ci` + `vite build` exécuteraient du code tiers non audité (dépendances de build), et le contrôle de permissions de l'environnement l'a refusé. Compensation : signature vérifiée, runtime décompressé et analysé (voir 2), et toutes les URL du binaire retrouvées dans les sources v1.2.13 |
| Dépendances d'exécution | 3 (reveal.js, moveable, selecto, MIT). Les outils de build (Vite, TypeScript, zopfli…) ne sont pas embarqués |

### 2. Accès réseau (analyse du runtime décompressé, 1,58 Mo)

| Contrôle | Résultat |
| --- | --- |
| Appels réseau | 1 `fetch` applicatif et 1 `new WebSocket`, tous deux dans `kernel/src/net.ts`, qui refuse tout si le **mode hors ligne** est actif ou si le fichier est ouvert dans une vue intégrée sandboxée. Un 2ᵉ `fetch` est le polyfill `modulepreload` de Vite, inactif dans un fichier unique. Aucun `XMLHttpRequest`, `EventSource`, `sendBeacon` ni `RTCPeerConnection` |
| Destinations codées en dur | `https://bento.page/releases/slides/manifest.json` (mises à jour), `wss://sync.bento.page` (collaboration), packs de langue sur bento.page, plus des liens d'aide. Toutes présentes dans les sources |
| Télémétrie | ✅ Aucune. La vérification de mise à jour est un simple GET, sans identifiant |
| Code dynamique | Le loader exécute le runtime décompressé par un script inline (repli : `new Function`, puis `import()` d'un blob). C'est le fonctionnement prévu, et le contenu est celui couvert par la signature. Aucun autre `eval`, `new Function` ou `import()` dans le runtime |
| CSP | ❗ Aucune (contrairement à html-presentation-editor). Le confinement réseau dépend du code et non du navigateur |

### 3. Test dynamique (Chromium headless, servi en HTTP local, toutes les requêtes externes interceptées et annulées)

| Scénario | Requêtes vers l'extérieur |
| --- | --- |
| Lancement par défaut | **1** : `GET https://bento.page/releases/slides/manifest.json` (vérification automatique de mise à jour) |
| Lancement avec `localStorage['bento-offline'] = 'on'` | **0** |
| WebSocket de collaboration | Aucun dans les deux cas : la collaboration n'est active que si on la démarre |

### 4. Mises à jour automatiques

- Une mise à jour n'est **jamais installée silencieusement**. Elle est proposée dans l'application et produit un **nouveau** fichier téléchargé ; l'ancien reste intact.
- Elle n'est acceptée qu'avec une signature valide, un hash identique et une version strictement supérieure (pas de rétrogradation).
- Les packs de langue passent par la même vérification de signature.

### 5. Contenu non fiable

- Le presse-papiers et les opérations reçues du relais sont reconstruits clé par clé selon le schéma du format (`untrusted.ts`). Les valeurs CSS sont échappées et validées au rendu.
- Limite assumée par le projet : un fichier `.bento.html` **est** du code. N'ouvrir que des fichiers Bento de confiance, exactement comme un exécutable.

## Points d'attention (réserves)

1. **Appel au lancement vers bento.page.** Par défaut, chaque ouverture révèle l'IP et l'heure au serveur de Bento.
   → Notre page de test ouvre Bento **avec le mode hors ligne activé** (préférence `bento-offline` posée avant l'ouverture). Un second bouton permet le mode en ligne.
2. **Surcharges « dev » lues dans `localStorage`.** Sur un vrai domaine comme le nôtre, Bento accepte `bento-update-url`, ainsi que des hôtes alternatifs pour le relais et les packs. Une autre page du même domaine pourrait donc rediriger ces appels.
   Impact limité : le code reste soumis à la signature de la clé figée, et la collaboration est chiffrée de bout en bout (AES-GCM).
   → Ne jamais héberger de page non maîtrisée sur le même domaine que Bento.
3. **Stockage partagé avec le reste du site** (brouillons, préférences en `localStorage` / IndexedDB). Même remarque que pour le test 01 : pour un deck confidentiel, télécharger le fichier et l'utiliser en local, en mode hors ligne.
4. **Collaboration en ligne.** Elle passe par le relais `sync.bento.page`, qui voit le chiffré, le timing et un hash de la salle. À n'activer que pour des contenus non sensibles.
5. **Pas de rebuild reproductible fait ici.** L'authenticité est établie par la signature du mainteneur, pas par une reconstruction indépendante.
   → Si on veut aller plus loin, faire le rebuild dans un conteneur isolé dédié (`npm ci --ignore-scripts`, puis `npm run build:single`, puis comparer le SHA-256).
6. **Galerie bento.page.** Les decks de la galerie sont eux-mêmes des applications complètes ; aucun n'est copié ici.

## Mettre à jour Bento (procédure)

```bash
curl -sSLO https://github.com/nyblnet/bento/releases/download/vX.Y.Z/Bento_Slides.bento.html
curl -sS https://bento.page/releases/slides/manifest.json -o manifest.json
# 1. vérifier la signature ECDSA du manifeste avec la clé de kernel/src/update.ts (inchangée ?)
# 2. sha256sum du fichier == "sha256" du payload signé
# 3. décompresser les blocs #bento-rt / #bento-rt-css (base86 + deflate-raw) et refaire l'inventaire réseau
# 4. relire le diff de kernel/src/net.ts, update.ts, untrusted.ts depuis v1.2.13
# 5. refaire le test Chromium (défaut / hors ligne) puis mettre à jour ce fichier
```
